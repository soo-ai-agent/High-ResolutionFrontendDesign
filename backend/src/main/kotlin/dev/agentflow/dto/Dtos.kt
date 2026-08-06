package dev.agentflow.dto

import com.fasterxml.jackson.annotation.JsonInclude

// ---- 공통 ----
data class GHUser(val login: String, val name: String?, val avatar_url: String?)
data class StatusResponse(val connected: Boolean, val user: GHUser?)

// ---- 프로젝트 (어드민 소유) ----
data class ProjectRepo(val name: String = "", val purpose: String = "", val url: String = "")
data class ProjectDto(
  val id: String,
  val name: String,
  val org: String = "",
  val desc: String = "",
  val stage: String = "",
  val progress: Int = 0,
  val repos: List<ProjectRepo> = emptyList(),
  val tasks: Int = 0,
  val prs: Int = 0,
  val fails: Int = 0,
  val updated: String = "",
  val synced: Boolean = false,
  val autoDispatch: Boolean = false,
  val dispatchLimit: Int = 2,
)

// ---- 자동 디스패치 (우선순위·단계 순서 기반 자동 착수) ----
data class DispatchStatusDto(
  val enabled: Boolean,
  val limit: Int,
  val activePhase: String?, // 디스패치 대상 단계 — 단계 순서상 첫 미완료 단계
  val active: Int, // 진행 중 ai 작업 수
  val waiting: Int, // 대상 단계의 대기 중 ai 작업 수
  val started: List<TaskDto> = emptyList(), // 이번 실행에서 착수된 작업
  val message: String? = null,
)
data class DispatchConfigRequest(val enabled: Boolean?, val limit: Int?)

// ---- 외부 워크플로 실행 (workflow_dispatch) ----
data class WorkflowDto(val id: Long, val name: String, val path: String, val state: String)
data class RepoWorkflowsDto(val repo: String, val repoName: String, val workflows: List<WorkflowDto>)
data class WorkflowDispatchRequest(val repo: String = "", val workflowId: Long = 0, val ref: String? = null)
data class WorkflowDispatchResponse(val ok: Boolean, val ref: String, val message: String)

// ---- 보드 카드 착수 (A안) ----
data class BoardKickoffRequest(val repo: String = "", val number: Long = 0)
data class BoardKickoffResponse(
  val mode: String, // task = 작업 계획 착수 | issue = 일반 이슈에 @claude 지시만
  val task: TaskDto? = null,
  val message: String,
)

// ---- CI 실패 자동 회복 ----
data class CiRecoveryItemDto(
  val taskCode: String,
  val runName: String,
  val runUrl: String?,
  val prNumber: Long?, // 지시를 남긴 곳 — PR 이면 번호, 아니면 null(이슈에 남김)
  val issueNumber: Long?,
)
data class CiRecoveryResultDto(
  val notified: List<CiRecoveryItemDto>, // 이번 스윕에서 @claude 지시를 보낸 실행
  val pending: Int, // 매칭 실패·지시 실패로 보류된 실행 수 (다음 스윕에 재시도)
  val message: String? = null,
)

// ---- E2E 테스트 리포트 — 실행별 케이스 결과 + 캡처 스크린샷 ----
data class E2eCaseDto(val name: String, val ok: Boolean)
data class E2eRunDto(
  val id: Long,
  val at: String,
  val name: String,
  val total: Int,
  val passed: Int,
  val cases: List<E2eCaseDto>,
  val shots: List<String>,
)
data class E2eRunCreateRequest(val name: String = "", val cases: List<E2eCaseDto> = emptyList())
data class E2eShotRequest(val file: String = "", val dataBase64: String = "")

// 테스트케이스 레지스트리 — 화면별 케이스 정의(사람이 등록·관리)
data class TestCaseDto(val id: Long, val screen: String, val name: String, val note: String, val createdAt: String)
data class TestCaseCreateRequest(val screen: String = "", val name: String = "", val note: String = "")

// ---- 진행 간트 — 활동 이력에서 파생한 실적 타임라인 (계획이 아니라 실제 시각) ----
data class GanttRowDto(
  val code: String,
  val title: String,
  val phase: String,
  val owner: String,
  val status: String,
  val createdAt: String?, // 분해(생성) 시각
  val startedAt: String?, // 착수 시각 — 대기 작업은 null
  val endedAt: String?, // 완료 시각 — 미완료는 null(진행 중 막대는 '지금'까지)
)

// ---- 프로젝트 활동 피드 — 작업 활동 + Actions 실행 + 웹훅 이벤트 통합 타임라인 ----
data class ProjectActivityDto(
  val at: String,
  val type: String, // task | run | event
  val kind: String, // 착수/검토 대기/… | success/failure/in_progress | issues:closed …
  val title: String,
  val note: String,
  val url: String? = null,
)

// ---- 프로젝트 문서 (PRD·IA 등) ----
data class ProjectDocDto(
  val projectId: String,
  val docType: String,
  val title: String,
  val client: String = "내부",
  val author: String = "",
  val docVersion: String = "v1.0",
  val createdDate: String = "",
  val updatedDate: String = "",
  val source: String = "template",
  val contentMd: String = "",
  val updatedAt: String = "",
)
data class DocUpdateRequest(val title: String?, val client: String?, val author: String?, val contentMd: String?)

// 코드 규칙 → 저장소 CLAUDE.md 동기화 결과
data class RuleSyncItemDto(val repo: String, val ok: Boolean, val url: String? = null, val message: String? = null)
data class RuleSyncResponse(val results: List<RuleSyncItemDto>, val docVersion: String)

// 문서 리비전 — 목록 조회에서는 contentMd 를 비워 응답을 가볍게, 단건 조회에서만 전문 포함.
data class DocRevisionDto(
  val seq: Long,
  val docVersion: String,
  val source: String,
  val author: String,
  val note: String,
  val at: String,
  val length: Int,
  val contentMd: String? = null,
)

// ---- 작업 (프로젝트별 태스크) ----
data class TaskDto(
  val id: String,
  val projectId: String,
  val seq: Int,
  val code: String,
  val title: String,
  val detail: String = "",
  val domain: String = "",
  val phase: String = "",
  val repo: String = "",
  val owner: String = "ai",
  val priority: String = "P2",
  val estimate: String = "M",
  val status: String = "대기",
  val issueNumber: Long? = null,
  val issueUrl: String? = null,
  val source: String = "template",
  val updatedAt: String = "",
)
data class TaskReviewRequest(val action: String?, val comment: String?)
data class TaskPatchRequest(
  val title: String? = null,
  val detail: String? = null,
  val domain: String? = null,
  val phase: String? = null,
  val repo: String? = null,
  val owner: String? = null,
  val priority: String? = null,
  val estimate: String? = null,
  val status: String? = null,
)

// ---- 태스크 진행·결과 (활동 로그 + 연결 이슈·PR) ----
data class TaskActivityDto(val at: String, val kind: String, val note: String)
data class TaskPullDto(val number: Long, val title: String, val state: String?, val merged: Boolean, val url: String?)
data class TaskInsightDto(
  val activity: List<TaskActivityDto>,
  val issueState: String?, // 연결 이슈의 미러 상태 (open/closed, 미러에 없으면 null)
  val pulls: List<TaskPullDto>,
)

// ---- GitHub 프록시 요청 ----
data class ConnectRequest(val token: String?)
data class IssueCreateRequest(val owner: String?, val repo: String?, val title: String?, val body: String?, val labels: List<String>?)
data class ClaudeRequest(val owner: String?, val repo: String?, val number: Long?, val prompt: String?)
data class HookCreateRequest(val owner: String?, val repo: String?, val url: String?, val secret: String?, val events: List<String>?)
data class HookPingRequest(val owner: String?, val repo: String?, val id: Long?)
data class BackfillRequest(val owner: String?, val repo: String?, val include: List<String>?)

// ---- GitHub 프록시 응답 ----
data class CreatedIssue(val number: Long, val html_url: String?, val title: String?)
data class CommentResult(val id: Long, val html_url: String?, val body: String? = null)
data class GHHook(
  val id: Long,
  val active: Boolean,
  val events: List<String>,
  val url: String,
  val insecure_ssl: String,
  val last_status: String?,
  val last_code: Int?,
  val updated_at: String?,
)
data class BackfillResult(val repo: String, val issues: Int, val pulls: Int, val runs: Int, val truncated: List<String>)

// ---- 미러 응답 ----
data class MirrorSummary(
  val repos: Int, val issues: Int, val pulls: Int, val runs: Int,
  val activeRuns: Int, val events: Int, val updatedAt: String?,
)

@JsonInclude(JsonInclude.Include.ALWAYS)
data class MirrorIssueDto(
  val repo: String, val number: Long, val title: String?, val state: String?,
  val labels: List<String>, val user: String?, val html_url: String?, val updated_at: String?,
  val stage: String?, val priority: String?, val mapping: Any?, val boardStatus: String?,
)
data class MirrorPullDto(
  val repo: String, val number: Long, val title: String?, val state: String?,
  val merged: Boolean, val draft: Boolean, val user: String?, val html_url: String?,
  val updated_at: String?, val boardStatus: String?,
)
data class MirrorRunDto(
  val repo: String, val id: Long, val name: String?, val status: String?,
  val conclusion: String?, val head_branch: String?, val html_url: String?, val updated_at: String?,
)
data class MirrorEventDto(
  val id: String?, val event: String, val action: String?, val repo: String?,
  val at: String, val verified: Boolean, val summary: String,
)
data class RepoDto(val full_name: String, val private: Boolean?, val default_branch: String?, val updated_at: String?)
data class BoardItemDto(
  val contentNodeId: String, val contentType: String?, val projectNodeId: String?,
  val status: String?, val archived: Boolean, val action: String?, val updatedAt: String?,
)

// ---- 미러 어드민 패치 ----
data class IssueAdminPatch(val repo: String?, val number: Long?, val stage: String?, val priority: String?, val mapping: Any?)
