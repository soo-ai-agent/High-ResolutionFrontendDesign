package dev.agentflow.service

import dev.agentflow.domain.ProjectRepository
import dev.agentflow.domain.PullRepository
import dev.agentflow.domain.RunEntity
import dev.agentflow.domain.RunRepository
import dev.agentflow.domain.TaskActivityEntity
import dev.agentflow.domain.TaskActivityRepository
import dev.agentflow.domain.TaskEntity
import dev.agentflow.domain.TaskRepository
import dev.agentflow.dto.CiRecoveryItemDto
import dev.agentflow.dto.CiRecoveryResultDto
import dev.agentflow.util.RepoCoords
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

// CI 실패 자동 회복 — 미러에 쌓인 실패 Actions 실행을 담당 작업에 매칭해,
// 실패 로그 링크와 함께 @claude 수정 지시 코멘트를 보내요. 실행당 1회만(recoveryNotified).
// 상태는 바꾸지 않아요 — 작업은 그대로 '진행 중'이고, 에이전트가 수정 커밋으로 CI 를 되살려요.
@Service
class CiRecoveryService(
  private val projects: ProjectRepository,
  private val tasks: TaskRepository,
  private val activities: TaskActivityRepository,
  private val runs: RunRepository,
  private val pulls: PullRepository,
  private val dispatcher: AgentDispatchService,
) {
  fun sweep(projectId: String): CiRecoveryResultDto {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val notified = mutableListOf<CiRecoveryItemDto>()
    var pending = 0
    var failMsg: String? = null

    project.repos.forEach repo@{ r ->
      val (owner, name) = RepoCoords.of(project.org, r)
      val full = "$owner/$name"
      val failed = runs.findByRepo(full).filter { it.conclusion == "failure" && !it.recoveryNotified }
      if (failed.isEmpty()) return@repo
      // 회복 지시 대상은 이 저장소를 담당하는, 아직 끝나지 않은 ai 작업이에요.
      val active = tasks.findByProjectIdOrderBySeq(project.id)
        .filter { it.owner == "ai" && it.repo == r.name && (it.status == "진행 중" || it.status == "검토 대기") }
      failed.forEach { run ->
        val (task, prNumber) = matchTask(full, run, active) ?: run { pending++; return@forEach }
        val target = prNumber ?: task.issueNumber ?: run { pending++; return@forEach }
        try {
          dispatcher.instruct(owner, name, target, recoveryPrompt(task, run), task.code, task.id)
        } catch (e: ResponseStatusException) {
          failMsg = "지시 실패: ${e.reason ?: e.message}" // PAT 미연결 등 — 다음 스윕에 재시도.
          pending++
          return@forEach
        }
        run.recoveryNotified = true
        runs.save(run)
        record(task.id, "CI 회복", "실패한 워크플로 '${run.name ?: "workflow"}' → @claude 수정 지시 (${if (prNumber != null) "PR #$prNumber" else "이슈 #${task.issueNumber}"})")
        notified += CiRecoveryItemDto(task.code, run.name ?: "workflow", run.htmlUrl, prNumber, task.issueNumber)
      }
    }
    return CiRecoveryResultDto(notified, pending, failMsg)
  }

  // 실패 실행 → 작업 매칭: ① 연결 PR 제목의 [T-00x] ② 브랜치명에 작업 코드 ③ 그 저장소의 유일한 활성 ai 작업.
  private fun matchTask(full: String, run: RunEntity, active: List<TaskEntity>): Pair<TaskEntity, Long?>? {
    if (active.isEmpty()) return null
    run.prNumbers?.split(",")?.mapNotNull { it.trim().toLongOrNull() }?.forEach { n ->
      val title = pulls.findById("$full#$n").orElse(null)?.title
      if (title != null) active.firstOrNull { title.contains("[${it.code}]") }?.let { return it to n }
    }
    val branch = run.headBranch?.lowercase() ?: ""
    active.firstOrNull { branch.contains(it.code.lowercase()) }?.let { return it to null }
    return active.singleOrNull()?.let { it to null }
  }

  private fun recoveryPrompt(t: TaskEntity, run: RunEntity) = buildString {
    appendLine("[${t.code}] CI 실패 — 자동 회복 요청")
    appendLine()
    appendLine("워크플로 '${run.name ?: "workflow"}' 실행이 실패했어요" + (run.headBranch?.let { " (브랜치 `$it`)" } ?: "") + ".")
    run.htmlUrl?.let { appendLine("- 실패 로그: $it") }
    appendLine()
    appendLine("실패 로그를 확인해 원인을 수정하고, 같은 브랜치에 수정 커밋을 push 해서 CI 를 다시 통과시켜 주세요.")
    appendLine("PR 제목의 `[${t.code}]` 접두는 유지해 주세요 — 어드민이 이 작업에 자동 연결해요.")
  }

  private fun record(taskId: String, kind: String, note: String) {
    activities.save(TaskActivityEntity(taskId = taskId, at = Instant.now().toString(), kind = kind, note = note))
  }
}
