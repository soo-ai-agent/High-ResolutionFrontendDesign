package dev.agentflow.service

import dev.agentflow.domain.ProjectDocRepository
import dev.agentflow.domain.ProjectEntity
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.domain.TaskEntity
import dev.agentflow.domain.TaskRepository
import dev.agentflow.dto.IssueCreateRequest
import dev.agentflow.dto.TaskDto
import dev.agentflow.dto.TaskPatchRequest
import dev.agentflow.util.Json
import dev.agentflow.util.RepoCoords
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

// 프로젝트별 작업 분해. 문서(PRD·IA)를 근거로 에이전트가 분해하고, 키가 없으면
// 저장소 구성 기반의 결정적 템플릿으로 폴백. Claude 호출이 길 수 있어
// 클래스 레벨 트랜잭션 없이 저장소 호출 단위 트랜잭션만 쓴다.
@Service
class TaskService(
  private val tasks: TaskRepository,
  private val projects: ProjectRepository,
  private val docs: ProjectDocRepository,
  private val claude: ClaudeClient,
  private val gitHub: GitHubService,
) {
  fun list(projectId: String): List<TaskDto> = tasks.findByProjectIdOrderBySeq(projectId).map { it.toDto() }

  // 문서를 근거로 작업 분해. 기존 작업(이슈 연결 포함)은 새 계획으로 대체된다.
  fun generate(projectId: String): List<TaskDto> {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val agentTasks = parseAgentTasks(claude.complete(TASKS_SYSTEM, taskBrief(project), maxTokens = 8000))
    val items = agentTasks ?: templateTasks(project)
    val now = Instant.now().toString()
    tasks.deleteAll(tasks.findByProjectIdOrderBySeq(projectId))
    val saved = items.mapIndexed { i, t ->
      t.id = "$projectId:${i + 1}"
      t.projectId = projectId
      t.seq = i + 1
      if (t.code.isBlank()) t.code = "T-%03d".format(i + 1)
      t.source = if (agentTasks != null) "agent" else "template"
      t.updatedAt = now
      tasks.save(t)
    }
    return saved.map { it.toDto() }
  }

  // 관리자 수정 — 넘어온 필드만 반영, 출처는 human 으로.
  fun patch(projectId: String, taskId: String, req: TaskPatchRequest): TaskDto {
    val t = find(projectId, taskId)
    req.title?.takeIf { it.isNotBlank() }?.let { t.title = it }
    req.detail?.let { t.detail = it }
    req.domain?.let { t.domain = it }
    req.phase?.let { t.phase = it }
    req.repo?.let { t.repo = it }
    req.owner?.let { t.owner = it }
    req.priority?.let { t.priority = it }
    req.estimate?.let { t.estimate = it }
    req.status?.let { t.status = it }
    t.source = "human"
    t.updatedAt = Instant.now().toString()
    return tasks.save(t).toDto()
  }

  fun delete(projectId: String, taskId: String) = tasks.delete(find(projectId, taskId))

  // 태스크 → GitHub 이슈 생성(동기화). PAT 연결 필요. 담당 저장소 좌표는 URL 우선.
  fun syncIssue(projectId: String, taskId: String): TaskDto {
    val t = find(projectId, taskId)
    if (t.issueNumber != null) throw ResponseStatusException(HttpStatus.CONFLICT, "이미 이슈 #${t.issueNumber} 로 동기화됐어요.")
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val repo = project.repos.firstOrNull { it.name == t.repo }
      ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "태스크의 담당 저장소(${t.repo})가 프로젝트에 없어요.")
    val (owner, name) = RepoCoords.of(project.org, repo)
    val body = buildString {
      appendLine(t.detail.ifBlank { t.title })
      appendLine()
      appendLine("---")
      appendLine("- 프로젝트: ${project.name}")
      appendLine("- 작업: ${t.code} · 단계: ${t.phase} · 담당: ${t.owner} · 우선순위: ${t.priority} · 추정: ${t.estimate}")
      appendLine("- 출처: Agent Flow 작업 계획")
    }
    val labels = listOfNotNull(t.phase.takeIf { it.isNotBlank() }, t.domain.takeIf { it.isNotBlank() })
    val created = gitHub.createIssue(owner, name, IssueCreateRequest(owner, name, "[${t.code}] ${t.title}", body, labels))
    t.issueNumber = created.number
    t.issueUrl = created.html_url
    t.updatedAt = Instant.now().toString()
    return tasks.save(t).toDto()
  }

  private fun find(projectId: String, taskId: String): TaskEntity {
    val t = tasks.findById(taskId).orElse(null)
    if (t == null || t.projectId != projectId) throw ResponseStatusException(HttpStatus.NOT_FOUND, "작업이 없어요.")
    return t
  }

  private fun taskBrief(p: ProjectEntity) = buildString {
    appendLine("프로젝트명: ${p.name}")
    appendLine("설명: ${p.desc}")
    appendLine("저장소:")
    p.repos.forEach { appendLine("- ${it.name} (${it.purpose})") }
    docs.findByProjectIdAndDocType(p.id, "prd")?.let {
      appendLine()
      appendLine("[PRD 발췌]")
      appendLine(it.contentMd.take(3000))
    }
    docs.findByProjectIdAndDocType(p.id, "ia")?.let {
      appendLine()
      appendLine("[IA·화면설계 발췌]")
      appendLine(it.contentMd.take(3000))
    }
  }

  // 에이전트 출력(JSON 배열)을 파싱 — 앞뒤 산문·코드펜스가 섞여도 배열 구간만 잘라 읽는다.
  private fun parseAgentTasks(text: String?): List<TaskEntity>? {
    if (text == null) return null
    return try {
      val start = text.indexOf('[')
      val end = text.lastIndexOf(']')
      if (start < 0 || end <= start) return null
      val arr = Json.mapper.readTree(text.substring(start, end + 1))
      if (!arr.isArray) return null
      arr.map { n ->
        TaskEntity(
          code = n.path("code").asText(""),
          title = n.path("title").asText(""),
          detail = n.path("detail").asText(""),
          domain = n.path("domain").asText(""),
          phase = n.path("phase").asText(""),
          repo = n.path("repo").asText(""),
          owner = n.path("owner").asText("ai").takeIf { it in setOf("ai", "human", "auto") } ?: "ai",
          priority = n.path("priority").asText("P2"),
          estimate = n.path("estimate").asText("M"),
        )
      }.filter { it.title.isNotBlank() }.take(20).takeIf { it.isNotEmpty() }
    } catch (e: Exception) {
      null
    }
  }

  // 키가 없을 때의 결정적 분해 — 저장소 역할 기반 표준 작업 + 사람 몫 분리.
  private fun templateTasks(p: ProjectEntity): List<TaskEntity> {
    val out = mutableListOf<TaskEntity>()
    fun add(title: String, detail: String, phase: String, repo: String, owner: String, priority: String = "P2", estimate: String = "M") {
      out += TaskEntity(title = title, detail = detail, phase = phase, repo = repo, owner = owner, priority = priority, estimate = estimate)
    }
    val backend = p.repos.filter { it.purpose == "백엔드" }
    val frontend = p.repos.filter { it.purpose == "프론트엔드" }
    val anyRepo = p.repos.firstOrNull()?.name ?: ""
    backend.forEach { r ->
      add("DB 스키마·도메인 모델 정의", "핵심 엔티티와 관계를 정의하고 마이그레이션을 준비해요.", "스키마", r.name, "ai", "P1")
      add("핵심 API 구현", "PRD 핵심 플로우의 조회·생성 API 를 구현해요.", "백엔드", r.name, "ai", "P1", "L")
      add("인증·권한 연동", "로그인 세션과 권한 가드를 붙여요.", "백엔드", r.name, "ai")
    }
    frontend.forEach { r ->
      add("핵심 화면 구현", "IA 문서의 SCR 목록 중 진입·핵심 화면을 구현해요.", "프론트엔드", r.name, "ai", "P1", "L")
      add("공통 컴포넌트·상태 처리", "Loading·Error·Empty 등 공통 상태와 컴포넌트를 정리해요.", "프론트엔드", r.name, "ai")
    }
    add("외부 API 키 발급·등록", "서비스에 필요한 외부 키를 발급받아 등록해요. 사람만 할 수 있어요.", "외부 키 발급", anyRepo, "human", "P1", "S")
    add("E2E 시나리오 작성·실행", "핵심 플로우를 E2E 로 검증해요.", "QA", anyRepo, "ai")
    add("PR 리뷰·머지 승인", "구현 PR 을 검토하고 머지를 승인해요.", "QA", anyRepo, "human", "P2", "S")
    add("스테이징 자동 배포", "머지 시 스테이징에 자동 배포되도록 워크플로를 구성해요.", "릴리즈", anyRepo, "auto")
    add("production 배포 승인", "최종 산출물의 운영 배포를 승인해요. 사람만 할 수 있어요.", "릴리즈", anyRepo, "human", "P1", "S")
    return out
  }

  private fun TaskEntity.toDto() =
    TaskDto(id, projectId, seq, code, title, detail, domain, phase, repo, owner, priority, estimate, status, issueNumber, issueUrl, source, updatedAt)

  companion object {
    private val TASKS_SYSTEM = """
      당신은 시니어 테크리드입니다. 프로젝트 정보와 PRD·IA 발췌를 근거로 구현 작업을 분해하세요.
      JSON 배열만 출력하세요(설명·코드펜스 금지). 각 원소:
      {"code":"T-001","title":"...","detail":"...","domain":"...","phase":"스키마|프론트엔드|백엔드|외부 키 발급|QA|릴리즈",
       "repo":"담당 저장소 이름","owner":"ai|human|auto","priority":"P1|P2|P3","estimate":"S|M|L"}
      규칙: 15개 이내. 사람만 할 수 있는 일(외부 키 발급, PR 머지 승인, production 배포 승인)은 owner:"human".
      CI·자동 배포처럼 워크플로가 하는 일은 owner:"auto". 나머지 구현은 owner:"ai".
      repo 는 주어진 저장소 이름 중에서만 고르세요.
    """.trimIndent()
  }
}
