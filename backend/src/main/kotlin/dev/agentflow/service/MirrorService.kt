package dev.agentflow.service

import com.fasterxml.jackson.databind.JsonNode
import dev.agentflow.domain.*
import dev.agentflow.dto.*
import dev.agentflow.util.Json
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

// 보드 이동 이벤트 — GitHub Projects 카드의 Status 변경이 미러에 반영될 때 발행돼요.
// TaskService 가 구독해 In Progress 이동 시 매칭 작업을 자동 착수해요(순환 의존 없이).
data class BoardStatusMoved(
  val repo: String,
  val number: Long,
  val title: String?,
  val htmlUrl: String?,
  val issueState: String?,
  val boardStatus: String,
)

// PR 웹훅 이벤트 — 자동 리뷰 루프가 구독해요. 백필에서는 발행하지 않아요(과거 PR 에 리뷰 지시 방지).
data class PullActivity(
  val repo: String,
  val number: Long,
  val title: String?,
  val state: String?,
  val merged: Boolean,
  val action: String?,
)

// 분해 트리거 라벨 — GitHub 이슈에 이 라벨을 붙이면 어드민이 정식 [T-00x] 작업들로 분해해요.
// 처리 후엔 완료 라벨로 교체돼 재트리거를 막아요(다시 분해하려면 완료 라벨을 떼고 다시 붙이세요).
const val DECOMPOSE_LABEL = "agent-flow:분해"
const val DECOMPOSE_DONE_LABEL = "agent-flow:분해완료"

// 라벨 분해 요청 이벤트 — TaskService 가 구독해 이슈를 작업 계획으로 분해해요(순환 의존 없이).
data class IssueDecomposeRequested(
  val repo: String,
  val number: Long,
  val title: String?,
  val body: String?,
  val htmlUrl: String?,
  val labels: List<String>,
)

@Service
@Transactional
class MirrorService(
  private val issues: IssueRepository,
  private val pulls: PullRepository,
  private val runs: RunRepository,
  private val board: BoardItemRepository,
  private val repos: RepoRepository,
  private val events: EventRepository,
  private val projects: ProjectRepository,
  private val meta: MetaRepository,
  private val comments: CommentRepository,
  private val publisher: ApplicationEventPublisher,
) {
  private fun nowIso(): String = Instant.now().toString()
  private fun touch() = meta.save(MetaEntity("meta", nowIso()))
  private fun keyN(repo: String, n: Long) = "$repo#$n"

  // ---------- upserts ----------
  fun upsertRepo(full: String?, priv: Boolean?, defaultBranch: String?, updatedAt: String?) {
    if (full.isNullOrBlank()) return
    val e = repos.findById(full).orElse(RepoEntity(fullName = full))
    e.private = priv ?: e.private
    e.defaultBranch = defaultBranch ?: e.defaultBranch
    e.updatedAt = updatedAt ?: e.updatedAt
    repos.save(e); touch()
  }

  fun upsertIssue(repo: String, number: Long, title: String?, state: String?, labels: List<String>, user: String?, htmlUrl: String?, updatedAt: String?, nodeId: String?) {
    val k = keyN(repo, number)
    val e = issues.findById(k).orElse(IssueEntity(id = k))
    // GitHub 필드는 덮되, 어드민 확장·보드 상태는 보존
    e.repo = repo; e.number = number; e.title = title; e.state = state
    e.labels = labels; e.user = user; e.htmlUrl = htmlUrl; e.updatedAt = updatedAt; e.nodeId = nodeId
    issues.save(e); touch()
  }

  fun upsertPull(repo: String, number: Long, title: String?, state: String?, merged: Boolean, draft: Boolean, user: String?, htmlUrl: String?, updatedAt: String?, nodeId: String?) {
    val k = keyN(repo, number)
    val e = pulls.findById(k).orElse(PullEntity(id = k))
    e.repo = repo; e.number = number; e.title = title; e.state = state
    e.merged = merged; e.draft = draft; e.user = user; e.htmlUrl = htmlUrl; e.updatedAt = updatedAt; e.nodeId = nodeId
    pulls.save(e); touch()
  }

  fun upsertRun(repo: String, runId: Long, name: String?, status: String?, conclusion: String?, headBranch: String?, htmlUrl: String?, updatedAt: String?, prNumbers: String? = null) {
    val k = keyN(repo, runId)
    val e = runs.findById(k).orElse(RunEntity(id = k))
    e.repo = repo; e.runId = runId; e.name = name; e.status = status
    e.conclusion = conclusion; e.headBranch = headBranch; e.htmlUrl = htmlUrl; e.updatedAt = updatedAt
    if (prNumbers != null) e.prNumbers = prNumbers
    runs.save(e); touch()
  }

  fun upsertBoardItem(contentNodeId: String?, contentType: String?, projectNodeId: String?, status: String?, archived: Boolean, action: String?, updatedAt: String?) {
    if (contentNodeId.isNullOrBlank()) return
    val e = board.findById(contentNodeId).orElse(BoardItemEntity(contentNodeId = contentNodeId))
    e.contentType = contentType ?: e.contentType
    e.projectNodeId = projectNodeId ?: e.projectNodeId
    if (status != null) e.status = status
    e.archived = archived; e.action = action; e.updatedAt = updatedAt ?: e.updatedAt
    board.save(e); touch()
  }

  // 실제 보드 이동 반영: nodeId 로 이슈/PR을 찾아 boardStatus 갱신.
  // 이슈 카드는 이동 이벤트를 발행해요 — In Progress 이동이면 매칭 작업이 자동 착수돼요(B안).
  fun setBoardStatusByNode(nodeId: String?, status: String?) {
    if (nodeId.isNullOrBlank()) return
    issues.findByNodeId(nodeId)?.let {
      it.boardStatus = status; it.boardUpdatedAt = nowIso(); issues.save(it); touch()
      if (status != null) publisher.publishEvent(BoardStatusMoved(it.repo, it.number, it.title, it.htmlUrl, it.state, status))
      return
    }
    pulls.findByNodeId(nodeId)?.let { it.boardStatus = status; it.boardUpdatedAt = nowIso(); pulls.save(it); touch() }
  }

  // 어드민 확장 필드만 갱신 — GitHub 로는 안 나감.
  // 요청 본문에 "있는 키"만 반영해요(없는 키는 보존). null 값은 '지우기'로 처리.
  fun setIssueAdmin(repo: String, number: Long, patch: Map<String, Any?>): MirrorIssueDto? {
    val e = issues.findByRepoAndNumber(repo, number) ?: return null
    if (patch.containsKey("stage")) e.stage = patch["stage"] as String?
    if (patch.containsKey("priority")) e.priority = patch["priority"] as String?
    if (patch.containsKey("mapping")) e.mappingJson = patch["mapping"]?.let { Json.mapper.writeValueAsString(it) }
    issues.save(e); touch()
    return e.toDto()
  }

  private fun upsertComment(repo: String, c: JsonNode, issueNumber: Long, kind: String, action: String?) {
    val cid = c.path("id").asLong()
    if (cid <= 0 || repo.isBlank()) return
    val k = "$repo#c$cid"
    if (action == "deleted") { runCatching { comments.deleteById(k) }; return }
    val e = comments.findById(k).orElse(CommentEntity(id = k))
    e.repo = repo; e.issueNumber = issueNumber; e.kind = kind
    e.user = c.path("user").str("login")
    e.body = c.str("body")?.take(2000) ?: ""
    e.htmlUrl = c.str("html_url")
    e.createdAt = c.str("created_at") ?: e.createdAt
    comments.save(e); touch()
  }

  @Transactional(readOnly = true)
  fun listComments(repo: String, issueNumber: Long): List<CommentEntity> =
    comments.findByRepoAndIssueNumberOrderByCreatedAtDesc(repo, issueNumber)

  fun logEvent(deliveryId: String?, event: String, action: String?, repo: String?, verified: Boolean, summary: String) {
    events.save(EventEntity(deliveryId = deliveryId, event = event, action = action, repo = repo, at = nowIso(), verified = verified, summary = summary))
  }

  fun reset() {
    issues.deleteAll(); pulls.deleteAll(); runs.deleteAll(); board.deleteAll(); repos.deleteAll(); events.deleteAll(); comments.deleteAll()
    meta.save(MetaEntity("meta", nowIso()))
  }

  // ---------- 웹훅 인제스트 ----------
  fun ingest(event: String, payload: JsonNode, delivery: String?, verified: Boolean) {
    val repoFull = payload.path("repository").str("full_name")
    if (payload.has("repository")) {
      val r = payload.path("repository")
      upsertRepo(r.str("full_name"), r.bool("private"), r.str("default_branch"), r.str("updated_at"))
    }
    var summary = event
    when {
      event == "issues" && payload.has("issue") -> {
        val i = payload.path("issue")
        upsertIssue(repoFull ?: "", i.path("number").asLong(), i.str("title"), i.str("state"), labelsOf(i.path("labels")), i.path("user").str("login"), i.str("html_url"), i.str("updated_at"), i.str("node_id"))
        summary = "issue #${i.path("number").asLong()} ${payload.str("action") ?: ""}".trim()
        // 분해 라벨이 "붙는 순간"에만 발행 — labeled 액션의 label 필드가 그 한 개를 가리켜요.
        if (payload.str("action") == "labeled" && payload.path("label").str("name") == DECOMPOSE_LABEL) {
          publisher.publishEvent(IssueDecomposeRequested(repoFull ?: "", i.path("number").asLong(), i.str("title"), i.str("body"), i.str("html_url"), labelsOf(i.path("labels"))))
          summary += " · 분해 요청"
        }
      }
      // 코멘트 미러 — 이슈·PR 대화(issue_comment)와 PR 리뷰 라인 코멘트를 저장해요.
      // 에이전트의 리뷰·결과 코멘트가 인사이트 패널에 보이게 하는 근거 데이터예요.
      event == "issue_comment" && payload.has("comment") -> {
        val n = payload.path("issue").path("number").asLong()
        upsertComment(repoFull ?: "", payload.path("comment"), n, "issue", payload.str("action"))
        summary = "comment on #$n ${payload.str("action") ?: ""}".trim()
      }
      event == "pull_request_review_comment" && payload.has("comment") -> {
        val n = payload.path("pull_request").path("number").asLong()
        upsertComment(repoFull ?: "", payload.path("comment"), n, "review", payload.str("action"))
        summary = "review comment on PR #$n"
      }
      event == "pull_request" && payload.has("pull_request") -> {
        val p = payload.path("pull_request")
        upsertPull(repoFull ?: "", p.path("number").asLong(), p.str("title"), p.str("state"), p.bool("merged"), p.bool("draft"), p.path("user").str("login"), p.str("html_url"), p.str("updated_at"), p.str("node_id"))
        publisher.publishEvent(PullActivity(repoFull ?: "", p.path("number").asLong(), p.str("title"), p.str("state"), p.bool("merged"), payload.str("action")))
        summary = "PR #${p.path("number").asLong()} ${payload.str("action") ?: ""}".trim()
      }
      event == "projects_v2_item" -> {
        val item = payload.path("projects_v2_item")
        val contentNode = item.str("content_node_id")
        val contentType = item.str("content_type")
        val action = payload.str("action")
        var status: String? = null
        if (action == "edited") {
          val fv = payload.path("changes").path("field_value")
          if (!fv.isMissingNode && Regex("status", RegexOption.IGNORE_CASE).containsMatchIn(fv.path("field_name").asText(""))) {
            val to = fv.path("to")
            status = to.str("name") ?: if (to.isTextual) to.asText() else null
          }
        }
        val archived = action == "archived" || action == "deleted" || item.has("archived_at") && !item.path("archived_at").isNull
        upsertBoardItem(contentNode, contentType, item.str("project_node_id"), status, archived, action, item.str("updated_at"))
        if (contentNode != null && status != null) setBoardStatusByNode(contentNode, status)
        summary = "board ${contentType ?: "item"} $action" + (if (status != null) " → $status" else "")
      }
      event == "workflow_run" && payload.has("workflow_run") -> {
        val w = payload.path("workflow_run")
        val prs = w.path("pull_requests").mapNotNull { it.path("number").asLong().takeIf { n -> n > 0 } }
          .joinToString(",").ifBlank { null }
        upsertRun(repoFull ?: "", w.path("id").asLong(), w.str("name"), w.str("status"), w.str("conclusion"), w.str("head_branch"), w.str("html_url"), w.str("updated_at"), prs)
        summary = "run ${w.str("name")} ${w.str("status")}" + (w.str("conclusion")?.let { " · $it" } ?: "")
      }
      event == "push" -> {
        summary = "push ${payload.str("ref") ?: ""} (${payload.path("commits").size()} commits)"
      }
    }
    logEvent(delivery, event, payload.str("action"), repoFull, verified, summary)
  }

  // ---------- 백필 (REST 배열 → 미러) ----------
  fun applyBackfill(full: String, include: List<String>, issuesData: JsonNode?, pullsData: JsonNode?, runsData: JsonNode?): BackfillResult {
    val truncated = mutableListOf<String>()
    var ic = 0; var pc = 0; var rc = 0
    if (include.contains("issues") && issuesData != null && issuesData.isArray) {
      val only = issuesData.filter { !it.has("pull_request") }
      for (i in only) upsertIssue(full, i.path("number").asLong(), i.str("title"), i.str("state"), labelsOf(i.path("labels")), i.path("user").str("login"), i.str("html_url"), i.str("updated_at"), i.str("node_id"))
      ic = only.size
      if (issuesData.size() == 100) truncated.add("issues")
    }
    if (include.contains("pulls") && pullsData != null && pullsData.isArray) {
      for (p in pullsData) upsertPull(full, p.path("number").asLong(), p.str("title"), p.str("state"), !p.path("merged_at").isNull && p.has("merged_at"), p.bool("draft"), p.path("user").str("login"), p.str("html_url"), p.str("updated_at"), p.str("node_id"))
      pc = pullsData.size()
      if (pullsData.size() == 100) truncated.add("pulls")
    }
    if (include.contains("runs") && runsData != null && runsData.isArray) {
      for (w in runsData) upsertRun(full, w.path("id").asLong(), w.str("name"), w.str("status"), w.str("conclusion"), w.str("head_branch"), w.str("html_url"), w.str("updated_at"))
      rc = runsData.size()
      if (runsData.size() == 50) truncated.add("runs")
    }
    logEvent(null, "backfill", "sync", full, true, "backfill: $ic issues · $pc PRs · $rc runs")
    return BackfillResult(full, ic, pc, rc, truncated)
  }

  // ---------- 읽기 ----------
  @Transactional(readOnly = true)
  fun summary(): MirrorSummary {
    val active = runs.findAll().count { it.status != null && it.status != "completed" }
    return MirrorSummary(repos.count().toInt(), issues.count().toInt(), pulls.count().toInt(), runs.count().toInt(), active, events.count().toInt(), meta.findById("meta").map { it.updatedAt }.orElse(null))
  }

  @Transactional(readOnly = true)
  fun listIssues(repo: String?): List<MirrorIssueDto> =
    (if (repo != null) issues.findByRepo(repo) else issues.findAll()).map { it.toDto() }

  @Transactional(readOnly = true)
  fun listPulls(repo: String?): List<MirrorPullDto> =
    (if (repo != null) pulls.findByRepo(repo) else pulls.findAll()).map { it.toDto() }

  @Transactional(readOnly = true)
  fun listRuns(repo: String?): List<MirrorRunDto> =
    (if (repo != null) runs.findByRepo(repo) else runs.findAll()).map { MirrorRunDto(it.repo, it.runId, it.name, it.status, it.conclusion, it.headBranch, it.htmlUrl, it.updatedAt) }

  @Transactional(readOnly = true)
  fun listRepos(): List<RepoDto> = repos.findAll().map { RepoDto(it.fullName, it.private, it.defaultBranch, it.updatedAt) }

  @Transactional(readOnly = true)
  fun listEvents(repo: String?): List<MirrorEventDto> =
    (if (repo != null) events.findByRepoOrderBySeqDesc(repo) else events.findTop200ByOrderBySeqDesc())
      .map { MirrorEventDto(it.deliveryId, it.event, it.action, it.repo, it.at, it.verified, it.summary) }

  @Transactional(readOnly = true)
  fun listBoard(): List<BoardItemDto> = board.findAll().map { BoardItemDto(it.contentNodeId, it.contentType, it.projectNodeId, it.status, it.archived, it.action, it.updatedAt) }

  private fun IssueEntity.toDto() = MirrorIssueDto(
    repo, number, title, state, labels, user, htmlUrl, updatedAt, stage, priority,
    mappingJson?.let { Json.mapper.readValue(it, Any::class.java) }, boardStatus,
  )

  private fun PullEntity.toDto() = MirrorPullDto(repo, number, title, state, merged, draft, user, htmlUrl, updatedAt, boardStatus)

  // ---------- JsonNode 헬퍼 ----------
  private fun JsonNode.str(field: String): String? { val n = this.get(field) ?: return null; return if (n.isNull) null else n.asText() }
  private fun JsonNode.bool(field: String): Boolean = this.path(field).asBoolean(false)
  private fun labelsOf(node: JsonNode?): List<String> {
    if (node == null || !node.isArray) return emptyList()
    return node.map { if (it.isTextual) it.asText() else it.path("name").asText("") }.filter { it.isNotEmpty() }
  }
}
