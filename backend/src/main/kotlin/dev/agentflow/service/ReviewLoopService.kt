package dev.agentflow.service

import dev.agentflow.domain.ProjectRepository
import dev.agentflow.domain.TaskActivityEntity
import dev.agentflow.domain.TaskActivityRepository
import dev.agentflow.domain.TaskEntity
import dev.agentflow.domain.TaskRepository
import dev.agentflow.util.RepoCoords
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import java.time.Instant

// 자동 코드리뷰 루프 — 관리 중인 작업의 PR 이 열리거나 커밋이 push 되면(웹훅),
// PR 에 @claude 리뷰 지시를 자동으로 남겨요. 리뷰 → 지적 코멘트 → 수정 push → 재리뷰가
// 왕복하고, 라운드 한도를 넘으면 사람 검토로 에스컬레이션해요(더 지시하지 않음).
// 머지 승인과 최종 완료는 끝까지 사람 몫 — 이 루프는 사람 앞에 가는 PR 의 품질 전처리예요.
@Service
class ReviewLoopService(
  private val projects: ProjectRepository,
  private val tasks: TaskRepository,
  private val activities: TaskActivityRepository,
  private val gitHub: GitHubService,
) {
  @EventListener
  fun onPull(e: PullActivity) {
    if (e.action !in setOf("opened", "ready_for_review", "synchronize")) return
    if (e.state != "open" || e.merged) return
    runCatching {
      for (p in projects.findAll()) {
        val repoEntry = p.repos.firstOrNull { r -> RepoCoords.of(p.org, r).let { (o, n) -> "$o/$n" } == e.repo }
          ?: continue
        val code = e.title?.let { Regex("""\[(T-\d{3})\]""").find(it)?.groupValues?.get(1) } ?: continue
        val t = tasks.findByProjectIdOrderBySeq(p.id)
          .firstOrNull { it.code == code && it.repo == repoEntry.name && it.owner == "ai" && it.status != "완료" }
          ?: continue
        val acts = activities.findByTaskIdOrderBySeqDesc(t.id)
        val rounds = acts.count { it.kind == "리뷰 지시" && it.note.contains("PR #${e.number}") }
        if (rounds >= ROUND_LIMIT) {
          // 한도 도달은 한 번만 기록 — 이후 push 에는 반응하지 않아요.
          if (acts.none { it.kind == "리뷰 한도" && it.note.contains("PR #${e.number}") }) {
            record(t.id, "리뷰 한도", "PR #${e.number} 리뷰 ${ROUND_LIMIT}라운드 초과 — 자동 지시 중단, 사람 검토가 필요해요.")
          }
          return
        }
        val (owner, name) = RepoCoords.of(p.org, repoEntry)
        gitHub.claudeComment(owner, name, e.number, reviewPrompt(t, rounds + 1))
        record(t.id, "리뷰 지시", "PR #${e.number} 자동 리뷰 요청 (라운드 ${rounds + 1}/$ROUND_LIMIT)")
        return
      }
    }
  }

  private fun reviewPrompt(t: TaskEntity, round: Int) = buildString {
    appendLine("[${t.code}] 코드 리뷰 요청 (라운드 $round/$ROUND_LIMIT)")
    appendLine()
    appendLine("이 PR 의 변경을 아래 기준으로 리뷰해 주세요:")
    appendLine("- 저장소 CLAUDE.md 의 코드 작성 규칙 준수 여부")
    appendLine("- 작업 요구사항 충족: ${t.title}" + (t.detail.takeIf { it.isNotBlank() }?.let { " — $it" } ?: ""))
    appendLine("- 버그·보안·성능 문제")
    appendLine()
    appendLine("발견한 문제는 이 PR 에 코멘트로 남기고, 직접 수정 커밋을 push 해 주세요 — push 되면 자동으로 재리뷰가 요청돼요.")
    appendLine("문제가 없으면 \"리뷰 통과 ✅\" 라고 코멘트만 남겨 주세요. 머지는 사람이 해요.")
  }

  private fun record(taskId: String, kind: String, note: String) {
    activities.save(TaskActivityEntity(taskId = taskId, at = Instant.now().toString(), kind = kind, note = note))
  }

  companion object {
    private const val ROUND_LIMIT = 3
  }
}
