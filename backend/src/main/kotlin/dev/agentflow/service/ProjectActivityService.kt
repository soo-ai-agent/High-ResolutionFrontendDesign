package dev.agentflow.service

import dev.agentflow.domain.EventRepository
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.domain.RunRepository
import dev.agentflow.domain.TaskActivityRepository
import dev.agentflow.domain.TaskRepository
import dev.agentflow.dto.MirrorRunDto
import dev.agentflow.dto.ProjectActivityDto
import dev.agentflow.util.RepoCoords
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

// 에이전트 활동 피드 — 태스크 활동 로그 + Actions 실행 + 웹훅 이벤트를 프로젝트 단위로
// 합쳐 시간 역순 타임라인으로 내려요. "지금 에이전트가 뭘 하고 있나"를 한 화면에서 보게.
@Service
@Transactional(readOnly = true)
class ProjectActivityService(
  private val projects: ProjectRepository,
  private val tasks: TaskRepository,
  private val activities: TaskActivityRepository,
  private val runs: RunRepository,
  private val events: EventRepository,
) {
  fun feed(projectId: String, limit: Int): List<ProjectActivityDto> {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val out = mutableListOf<ProjectActivityDto>()

    tasks.findByProjectIdOrderBySeq(projectId).forEach { t ->
      activities.findByTaskIdOrderBySeqDesc(t.id).forEach { a ->
        out += ProjectActivityDto(a.at, "task", a.kind, "[${t.code}] ${t.title}", a.note, t.issueUrl)
      }
    }

    val fullRepos = project.repos.map { r -> RepoCoords.of(project.org, r).let { (o, n) -> "$o/$n" } }
    fullRepos.forEach { f ->
      runs.findByRepo(f).forEach { r ->
        out += ProjectActivityDto(
          r.updatedAt ?: "", "run", r.conclusion ?: r.status ?: "run", r.name ?: "workflow",
          "$f · ${r.headBranch ?: ""} · ${r.status ?: ""}" + (r.conclusion?.let { c -> " → $c" } ?: ""), r.htmlUrl,
        )
      }
      // workflow_run 이벤트는 위 실행 목록과 중복이라 제외해요.
      events.findByRepoOrderBySeqDesc(f).filterNot { it.event == "workflow_run" }.forEach { e ->
        out += ProjectActivityDto(e.at, "event", e.event + (e.action?.let { ":$it" } ?: ""), f, e.summary)
      }
    }

    return out
      .sortedByDescending { runCatching { Instant.parse(it.at) }.getOrElse { Instant.EPOCH } }
      .take(limit)
  }

  // Actions 실행 내역 — 프로젝트 저장소들의 workflow_run 미러를 최신순으로 내려요.
  // 대시보드 실행이든 에이전트·CI 가 유발한 실행이든, 웹훅으로 들어온 모든 실행이 잡혀요.
  fun runs(projectId: String, limit: Int): List<MirrorRunDto> {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    return project.repos
      .map { r -> RepoCoords.of(project.org, r).let { (o, n) -> "$o/$n" } }
      .flatMap { f -> runs.findByRepo(f) }
      .map { MirrorRunDto(it.repo, it.runId, it.name, it.status, it.conclusion, it.headBranch, it.htmlUrl, it.updatedAt) }
      .sortedByDescending { runCatching { Instant.parse(it.updated_at ?: "") }.getOrElse { Instant.EPOCH } }
      .take(limit)
  }
}
