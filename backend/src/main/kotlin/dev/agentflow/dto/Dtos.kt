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
