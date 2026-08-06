package dev.agentflow.service

import dev.agentflow.domain.IssueRepository
import dev.agentflow.domain.ProjectDocRepository
import dev.agentflow.domain.ProjectEntity
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.domain.PullRepository
import dev.agentflow.domain.TaskActivityEntity
import dev.agentflow.domain.TaskActivityRepository
import dev.agentflow.domain.TaskEntity
import dev.agentflow.domain.TaskRepository
import dev.agentflow.dto.BoardKickoffResponse
import dev.agentflow.dto.DispatchConfigRequest
import dev.agentflow.dto.GanttRowDto
import dev.agentflow.dto.DispatchStatusDto
import dev.agentflow.dto.IssueCreateRequest
import dev.agentflow.dto.TaskActivityDto
import dev.agentflow.dto.TaskDto
import dev.agentflow.dto.TaskInsightDto
import dev.agentflow.dto.TaskPatchRequest
import dev.agentflow.dto.TaskPullDto
import dev.agentflow.dto.TaskReviewRequest
import dev.agentflow.util.Json
import dev.agentflow.util.RepoCoords
import org.springframework.context.event.EventListener
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
  private val llm: LlmService,
  private val gitHub: GitHubService,
  private val activities: TaskActivityRepository,
  private val issues: IssueRepository,
  private val pulls: PullRepository,
) {
  fun list(projectId: String): List<TaskDto> {
    val project = projects.findById(projectId).orElse(null) ?: return emptyList()
    return tasks.findByProjectIdOrderBySeq(projectId).map { reconcile(project, it).toDto() }
  }

  // 문서를 근거로 작업 분해. 기존 작업(이슈 연결 포함)은 새 계획으로 대체된다.
  fun generate(projectId: String): List<TaskDto> {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val agentTasks = parseAgentTasks(llm.complete(TASKS_SYSTEM, taskBrief(project), maxTokens = 8000))
    val items = agentTasks ?: templateTasks(project)
    val now = Instant.now().toString()
    tasks.findByProjectIdOrderBySeq(projectId).forEach { old ->
      activities.deleteAll(activities.findByTaskIdOrderBySeqDesc(old.id))
      tasks.delete(old)
    }
    val saved = items.mapIndexed { i, t ->
      t.id = "$projectId:${i + 1}"
      t.projectId = projectId
      t.seq = i + 1
      if (t.code.isBlank()) t.code = "T-%03d".format(i + 1)
      t.source = if (agentTasks != null) "agent" else "template"
      t.updatedAt = now
      val savedTask = tasks.save(t)
      record(savedTask.id, "생성", if (agentTasks != null) "에이전트가 문서(PRD·IA)에서 분해" else "저장소 구성 기반 템플릿 분해")
      savedTask
    }
    return saved.map { it.toDto() }
  }

  // 관리자 수정 — 넘어온 필드만 반영, 출처는 human 으로.
  fun patch(projectId: String, taskId: String, req: TaskPatchRequest): TaskDto {
    val t = find(projectId, taskId)
    val changes = mutableListOf<String>()
    fun <V> apply(label: String, new: V?, cur: V, set: (V) -> Unit) {
      if (new != null && new != cur) { changes += "$label: $cur → $new"; set(new) }
    }
    req.title?.takeIf { it.isNotBlank() }?.let { if (it != t.title) { changes += "제목 수정"; t.title = it } }
    req.detail?.let { if (it != t.detail) { changes += "상세 수정"; t.detail = it } }
    apply("도메인", req.domain, t.domain) { t.domain = it }
    apply("단계", req.phase, t.phase) { t.phase = it }
    apply("저장소", req.repo, t.repo) { t.repo = it }
    apply("담당", req.owner, t.owner) { t.owner = it }
    apply("우선순위", req.priority, t.priority) { t.priority = it }
    apply("추정", req.estimate, t.estimate) { t.estimate = it }
    apply("상태", req.status, t.status) { t.status = it }
    if (changes.isNotEmpty()) {
      t.source = "human"
      t.updatedAt = Instant.now().toString()
      record(t.id, "수정", changes.joinToString(" · "))
    }
    return tasks.save(t).toDto()
  }

  fun delete(projectId: String, taskId: String) {
    val t = find(projectId, taskId)
    activities.deleteAll(activities.findByTaskIdOrderBySeqDesc(t.id))
    tasks.delete(t)
  }

  // 태스크 → GitHub 이슈 생성(동기화). PAT 연결 필요. 담당 저장소 좌표는 URL 우선.
  fun syncIssue(projectId: String, taskId: String): TaskDto {
    val t = find(projectId, taskId)
    if (t.issueNumber != null) throw ResponseStatusException(HttpStatus.CONFLICT, "이미 이슈 #${t.issueNumber} 로 동기화됐어요.")
    val (project, owner, name) = coordsOf(projectId, t)
    createAndLinkIssue(project, t, owner, name)
    return tasks.save(t).toDto()
  }

  // 원클릭 에이전트 착수 — 이슈가 없으면 만들고, @claude 멘션 코멘트로 코딩 에이전트에게
  // 작업 지시(내용·PR 제목 규칙·완료 기준)를 전달해요. 저장소에 Claude GitHub App
  // (claude-code-action)이 설치돼 있어야 코멘트가 실제 구현 작업으로 이어져요.
  fun kickoff(projectId: String, taskId: String): TaskDto {
    val t = find(projectId, taskId)
    if (t.owner != "ai") throw ResponseStatusException(HttpStatus.BAD_REQUEST, "에이전트 착수는 담당이 ai 인 작업만 할 수 있어요.")
    when (t.status) {
      "완료" -> throw ResponseStatusException(HttpStatus.CONFLICT, "이미 완료된 작업이에요.")
      "검토 대기" -> throw ResponseStatusException(HttpStatus.CONFLICT, "검토 대기 중이에요 — 보완이 필요하면 피드백으로 재개하세요.")
    }
    val (project, _, _) = coordsOf(projectId, t)
    startTask(project, t)
    return t.toDto()
  }

  // 보드 카드 착수(A안) — 앱 보드의 카드 버튼으로 실행. 카드의 이슈가 작업 계획과 매칭되면
  // 기존 착수 경로(상태 전환 포함)를 타고, 매칭이 없는 일반 이슈면 @claude 지시만 보내요.
  fun boardKickoff(repoFull: String, number: Long): BoardKickoffResponse {
    if (repoFull.isBlank() || !repoFull.contains("/") || number <= 0)
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "repo(owner/이름)·number 가 필요해요.")
    val issue = issues.findByRepoAndNumber(repoFull, number)
    for (p in projects.findAll()) {
      val repoName = p.repos.firstOrNull { r -> RepoCoords.of(p.org, r).let { (o, n) -> "$o/$n" } == repoFull }?.name
        ?: continue
      val all = tasks.findByProjectIdOrderBySeq(p.id).filter { it.repo == repoName }
      val code = issue?.title?.let { Regex("""\[(T-\d{3})\]""").find(it)?.groupValues?.get(1) }
      val t = all.firstOrNull { it.issueNumber == number }
        ?: code?.let { c -> all.firstOrNull { it.code == c && it.issueNumber == null } }
        ?: continue
      if (t.owner != "ai")
        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "${t.code} 는 담당이 ${t.owner} 라 에이전트 착수 대상이 아니에요.")
      when (t.status) {
        "완료" -> throw ResponseStatusException(HttpStatus.CONFLICT, "${t.code} 는 이미 완료된 작업이에요.")
        "검토 대기" -> throw ResponseStatusException(HttpStatus.CONFLICT, "${t.code} 는 검토 대기 중이에요 — 작업 계획에서 피드백으로 재개하세요.")
      }
      if (t.issueNumber == null) {
        t.issueNumber = number
        t.issueUrl = issue?.htmlUrl
        t.lastIssueState = issue?.state
        record(t.id, "이슈 연결", "보드 카드의 이슈 #$number 연결 (제목 매칭)")
      }
      startTask(p, t, via = "보드 착수 — ")
      return BoardKickoffResponse("task", t.toDto(), "${t.code} 착수 — 이슈 #$number 에 @claude 지시를 보냈어요.")
    }
    // 작업 계획 매칭 없음 — 일반 이슈에 바로 지시
    val (owner, name) = repoFull.split("/", limit = 2).let { it[0] to it[1] }
    gitHub.claudeComment(owner, name, number, genericIssuePrompt(issue?.title))
    return BoardKickoffResponse("issue", null, "이슈 #$number 에 @claude 지시를 보냈어요 (작업 계획 매칭 없음).")
  }

  private fun genericIssuePrompt(title: String?) = buildString {
    appendLine((title?.let { "'$it' " } ?: "") + "이슈를 처리해 주세요.")
    appendLine()
    appendLine("- 이 저장소에 브랜치를 만들어 구현하고 PR 을 올려 주세요.")
    appendLine("- 구현이 끝나면 PR 로 이 이슈를 닫아 주세요.")
    appendLine("- Agent Flow 보드에서 착수한 요청이에요.")
  }

  // 보드 이동 트리거(B안) — GitHub Projects 카드가 In Progress 로 이동하면, 그 이슈에
  // 매칭되는 대기 중 ai 작업을 자동 착수해요. 이슈 미연결이면 제목의 [T-00x] 로 먼저 연결.
  // 착수 실패(PAT 미연결 등)는 웹훅 처리를 막지 않게 조용히 넘겨요.
  @EventListener
  fun onBoardMoved(e: BoardStatusMoved) {
    if (e.boardStatus.trim().lowercase() !in setOf("in progress", "in-progress")) return
    runCatching {
      projects.findAll().forEach { p ->
        val repoName = p.repos.firstOrNull { r -> RepoCoords.of(p.org, r).let { (o, n) -> "$o/$n" } == e.repo }?.name
          ?: return@forEach
        val all = tasks.findByProjectIdOrderBySeq(p.id).filter { it.repo == repoName }
        val code = e.title?.let { Regex("""\[(T-\d{3})\]""").find(it)?.groupValues?.get(1) }
        val t = all.firstOrNull { it.issueNumber == e.number }
          ?: code?.let { c -> all.firstOrNull { it.code == c && it.issueNumber == null } }
          ?: return@forEach
        if (t.owner != "ai" || t.status != "대기") return@forEach
        if (t.issueNumber == null) {
          t.issueNumber = e.number
          t.issueUrl = e.htmlUrl
          t.lastIssueState = e.issueState
          record(t.id, "이슈 연결", "보드 카드의 이슈 #${e.number} 연결 (제목 매칭)")
        }
        record(t.id, "보드 트리거", "GitHub Projects 카드 '${e.boardStatus}' 이동 감지 → 자동 착수")
        startTask(p, t, via = "보드 트리거 — ")
      }
    }
  }

  // ---- 자동 디스패치 — 단계 순서(스키마→…→릴리즈) 안에서 우선순위(P1→P3)·seq 순으로,
  // 진행 중 ai 작업이 dispatchLimit 미만일 때만 대기 작업을 자동 착수해요. ----

  fun dispatchStatus(projectId: String): DispatchStatusDto {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val all = tasks.findByProjectIdOrderBySeq(projectId).map { reconcile(project, it) }
    return statusOf(project, all)
  }

  fun setDispatchConfig(projectId: String, req: DispatchConfigRequest): DispatchStatusDto {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    req.enabled?.let { project.autoDispatch = it }
    req.limit?.let { project.dispatchLimit = it.coerceIn(1, 5) }
    projects.save(project)
    // 켜는 즉시 한 번 실행 — 슬롯이 비어 있으면 바로 착수돼요.
    return if (project.autoDispatch) runDispatch(projectId) else dispatchStatus(projectId)
  }

  // force=true 는 수동 "지금 실행" — 자동 디스패치가 꺼져 있어도 한 번 실행해요.
  fun runDispatch(projectId: String, force: Boolean = false): DispatchStatusDto {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val all = tasks.findByProjectIdOrderBySeq(projectId).map { reconcile(project, it) }
    if (!project.autoDispatch && !force)
      return statusOf(project, all, message = "자동 디스패치가 꺼져 있어요 — 켜거나 '지금 실행'을 누르세요.")
    val phase = activePhaseOf(all)
    val slots = (project.dispatchLimit - all.count { it.owner == "ai" && it.status == "진행 중" }).coerceAtLeast(0)
    val candidates = all
      .filter { it.owner == "ai" && it.status == "대기" && phaseRank(it.phase) == phaseRank(phase ?: "") }
      .sortedWith(compareBy({ priorityRank(it.priority) }, { it.seq }))
    val started = mutableListOf<TaskEntity>()
    var failMsg: String? = null
    for (t in candidates.take(slots)) {
      try {
        startTask(project, t, via = "자동 디스패치 — ")
        started += t
      } catch (e: ResponseStatusException) {
        failMsg = "착수 실패 (${t.code}): ${e.reason ?: e.message}"
        break // PAT 미연결 등 시스템 원인일 가능성이 높아 이번 회차는 중단 — 다음 주기에 재시도.
      }
    }
    val msg = failMsg ?: when {
      started.isNotEmpty() -> "${started.joinToString(", ") { it.code }} 착수했어요."
      phase == null -> "모든 작업이 완료됐어요."
      candidates.isEmpty() && slots > 0 -> "현재 단계($phase)에 착수할 대기 ai 작업이 없어요 — 사람·자동 몫이 끝나면 다음 단계로 넘어가요."
      slots == 0 -> "동시 실행 한도(${project.dispatchLimit})가 가득 찼어요 — 슬롯이 비면 자동으로 이어가요."
      else -> null
    }
    return statusOf(project, all, started.map { it.toDto() }, msg)
  }

  private fun statusOf(project: ProjectEntity, all: List<TaskEntity>, started: List<TaskDto> = emptyList(), message: String? = null): DispatchStatusDto {
    val phase = activePhaseOf(all)
    return DispatchStatusDto(
      enabled = project.autoDispatch,
      limit = project.dispatchLimit,
      activePhase = phase,
      active = all.count { it.owner == "ai" && it.status == "진행 중" },
      waiting = all.count { it.owner == "ai" && it.status == "대기" && phaseRank(it.phase) == phaseRank(phase ?: "") },
      started = started,
      message = message,
    )
  }

  // 디스패치 대상 단계 = 단계 순서상 첫 미완료 작업이 있는 단계. 앞 단계가 모두 완료돼야 다음 단계로.
  private fun activePhaseOf(all: List<TaskEntity>): String? =
    all.filter { it.status != "완료" }.minByOrNull { phaseRank(it.phase) }?.phase

  private fun phaseRank(p: String): Int = PHASE_ORDER.indexOf(p).let { if (it < 0) PHASE_ORDER.size else it }

  private fun priorityRank(p: String): Int = when (p) { "P1" -> 0; "P2" -> 1; "P3" -> 2; else -> 3 }

  // 착수 공통 경로 — 이슈 보장 + @claude 지시 + 진행 중 전환.
  // kickoff(수동)·자동 디스패치·보드 트리거가 함께 쓰고, via 로 경로를 활동 이력에 남겨요.
  private fun startTask(project: ProjectEntity, t: TaskEntity, via: String = "") {
    val repo = project.repos.firstOrNull { it.name == t.repo }
      ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "태스크의 담당 저장소(${t.repo})가 프로젝트에 없어요.")
    val (owner, name) = RepoCoords.of(project.org, repo)
    if (t.issueNumber == null) createAndLinkIssue(project, t, owner, name)
    gitHub.claudeComment(owner, name, t.issueNumber!!, kickoffPrompt(project, t))
    t.status = "진행 중"
    t.updatedAt = Instant.now().toString()
    record(t.id, "착수", via + "@claude 멘션으로 에이전트 착수 지시 — 구현 PR 은 [${t.code}] 제목으로 자동 연결돼요")
    tasks.save(t)
  }

  private fun coordsOf(projectId: String, t: TaskEntity): Triple<ProjectEntity, String, String> {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val repo = project.repos.firstOrNull { it.name == t.repo }
      ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "태스크의 담당 저장소(${t.repo})가 프로젝트에 없어요.")
    val (owner, name) = RepoCoords.of(project.org, repo)
    return Triple(project, owner, name)
  }

  private fun createAndLinkIssue(project: ProjectEntity, t: TaskEntity, owner: String, name: String) {
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
    t.lastIssueState = "open"
    t.updatedAt = Instant.now().toString()
    record(t.id, "이슈 연결", "GitHub 이슈 #${created.number} 생성·연결")
  }

  private fun kickoffPrompt(p: ProjectEntity, t: TaskEntity) = buildString {
    appendLine("[${t.code}] ${t.title} 작업을 시작해 주세요.")
    appendLine()
    appendLine("## 작업 내용")
    appendLine(t.detail.ifBlank { t.title })
    appendLine()
    appendLine("## 진행 방법")
    appendLine("- 저장소에 CLAUDE.md 가 있으면 그 코드 작성 규칙을 반드시 따라 주세요.")
    appendLine("- 이 저장소에 브랜치를 만들어 구현하고 PR 을 올려 주세요.")
    appendLine("- PR 제목은 반드시 `[${t.code}]` 로 시작해 주세요 — 어드민이 이 작업에 자동으로 연결해요.")
    appendLine("- 구현이 끝나고 PR 이 머지되면 이 이슈를 닫아 주세요. 이슈가 닫히면 어드민에서 '검토 대기'가 되고, 완료 승인은 사람이 해요.")
    appendLine("- 컨텍스트: 프로젝트 '${p.name}' · 단계 ${t.phase} · 우선순위 ${t.priority} · 추정 ${t.estimate}")
  }

  // 진행·결과 조회 — 활동 이력 + 미러의 연결 이슈 상태 + 코드([T-00x])로 매칭되는 PR.
  fun insight(projectId: String, taskId: String): TaskInsightDto {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val t = reconcile(project, find(projectId, taskId))
    val full = fullRepoOf(project, t.repo)
    val issueState = t.issueNumber?.let { n -> full?.let { issues.findByRepoAndNumber(it, n)?.state } }
    val prs = full?.let { f ->
      pulls.findByRepo(f).filter { it.title?.contains("[${t.code}]") == true }
        .map { TaskPullDto(it.number, it.title ?: "", it.state, it.merged, it.htmlUrl) }
    } ?: emptyList()
    val acts = activities.findByTaskIdOrderBySeqDesc(t.id).map { TaskActivityDto(it.at, it.kind, it.note) }
    return TaskInsightDto(acts, issueState, prs)
  }

  // 미러와 동기화: 이슈 미연결이면 제목 접두([T-00x])로 자동 연결.
  // 이슈 상태는 "전이"에만 반응해요(lastIssueState 비교) — 닫히면 검토 대기(완료는 사람만),
  // 검토 대기 중 이슈가 다시 열리면 진행 중으로 복귀. 피드백으로 재개한 태스크가
  // 여전히 닫혀 있는 이슈 때문에 검토 대기로 되돌아가지 않게 하기 위한 구조예요.
  private fun reconcile(project: ProjectEntity, t: TaskEntity): TaskEntity {
    val full = fullRepoOf(project, t.repo) ?: return t
    var dirty = false
    if (t.issueNumber == null) {
      issues.findByRepo(full).firstOrNull { it.title?.startsWith("[${t.code}]") == true }?.let { m ->
        t.issueNumber = m.number
        t.issueUrl = m.htmlUrl
        record(t.id, "이슈 연결", "미러에서 이슈 #${m.number} 자동 연결 (제목 매칭)")
        dirty = true
      }
    }
    val n = t.issueNumber
    if (n != null) {
      val state = issues.findByRepoAndNumber(full, n)?.state
      if (state != null && state != t.lastIssueState) {
        if (state == "closed" && t.status != "완료" && t.status != "검토 대기") {
          t.status = "검토 대기"
          record(t.id, "검토 대기", "연결 이슈 #$n 닫힘 → 검토 대기. 완료는 사람이 승인해요.")
        } else if (state == "open" && t.status == "검토 대기") {
          t.status = "진행 중"
          record(t.id, "재개", "이슈 #$n 다시 열림 → 진행 중")
        }
        t.lastIssueState = state
        dirty = true
      }
    }
    if (dirty) {
      t.updatedAt = Instant.now().toString()
      tasks.save(t)
    }
    return t
  }

  // 검토 처리 — 완료 승인(approve)은 사람만의 행동, 피드백(feedback)은 진행 중으로 재개.
  // 피드백은 연결 이슈가 있고 PAT 이 연결돼 있으면 이슈를 다시 열고 @claude 코멘트로 전달해
  // 에이전트가 이어서 작업하게 해요(실패해도 로컬 재개는 유지).
  fun review(projectId: String, taskId: String, req: TaskReviewRequest): TaskDto {
    val t = find(projectId, taskId)
    when (req.action) {
      "approve" -> {
        t.status = "완료"
        record(t.id, "완료", "사람이 검토 승인 → 완료" + (req.comment?.trim().takeUnless { it.isNullOrBlank() }?.let { " — $it" } ?: ""))
      }
      "feedback" -> {
        val fb = req.comment?.trim().orEmpty()
        if (fb.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "피드백 내용을 입력해 주세요.")
        t.status = "진행 중"
        record(t.id, "피드백", "$fb → 진행 중으로 재개")
        val n = t.issueNumber
        if (n != null) {
          val project = projects.findById(projectId).orElse(null)
          val repo = project?.repos?.firstOrNull { it.name == t.repo }
          if (project != null && repo != null) {
            val (owner, name) = RepoCoords.of(project.org, repo)
            runCatching { gitHub.reopenIssue(owner, name, n) }
              .onSuccess { record(t.id, "재개", "이슈 #$n 다시 열음") }
            runCatching { gitHub.claudeComment(owner, name, n, fb) }
              .onSuccess { record(t.id, "이슈 코멘트", "@claude 멘션으로 피드백 전달 — 에이전트 재개 트리거") }
          }
        }
      }
      else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "action 은 approve 또는 feedback 이어야 해요.")
    }
    t.source = "human"
    t.updatedAt = Instant.now().toString()
    return tasks.save(t).toDto()
  }

  // 진행 간트 — 활동 이력에서 실적 시각(생성·착수·완료)을 뽑아요. 단계 순서로 정렬.
  fun gantt(projectId: String): List<GanttRowDto> {
    projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    return tasks.findByProjectIdOrderBySeq(projectId)
      .sortedWith(compareBy({ phaseRank(it.phase) }, { it.seq }))
      .map { t ->
        val acts = activities.findByTaskIdOrderBySeqDesc(t.id).reversed() // 시간순
        val created = acts.firstOrNull()?.at
        // 착수 활동이 정식 시작점 — 없으면(수동 상태 변경 등) 진행 중 전환 기록, 그것도 없으면 생성 시각.
        val started = acts.firstOrNull { it.kind == "착수" }?.at
          ?: acts.firstOrNull { it.kind == "수정" && it.note.contains("→ 진행 중") }?.at
        val ended = acts.lastOrNull { it.kind == "완료" }?.at
        GanttRowDto(
          t.code, t.title, t.phase, t.owner, t.status,
          created,
          if (t.status == "대기") null else (started ?: created),
          if (t.status == "완료") (ended ?: t.updatedAt) else null,
        )
      }
  }

  private fun fullRepoOf(project: ProjectEntity, repoName: String): String? {
    val r = project.repos.firstOrNull { it.name == repoName } ?: return null
    val (owner, name) = RepoCoords.of(project.org, r)
    return "$owner/$name"
  }

  private fun record(taskId: String, kind: String, note: String) {
    activities.save(TaskActivityEntity(taskId = taskId, at = Instant.now().toString(), kind = kind, note = note))
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
    // 디스패치 단계 순서 — 프론트 BUILD_PHASES 와 동일. 목록에 없는 단계는 마지막으로.
    private val PHASE_ORDER = listOf("스키마", "프론트엔드", "백엔드", "외부 키 발급", "QA", "릴리즈")

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
