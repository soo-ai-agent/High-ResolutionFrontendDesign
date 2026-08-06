package dev.agentflow.service

import dev.agentflow.domain.ProjectRepository
import dev.agentflow.dto.RepoWorkflowsDto
import dev.agentflow.dto.WorkflowDispatchRequest
import dev.agentflow.dto.WorkflowDispatchResponse
import dev.agentflow.util.RepoCoords
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

// 외부 워크플로 실행 — 프로젝트 저장소들의 Actions 워크플로를 나열하고,
// workflow_dispatch 로 원격 실행해요. 실행 결과는 웹훅(workflow_run)으로 미러에 돌아와요.
@Service
class ProjectWorkflowService(
  private val projects: ProjectRepository,
  private val gitHub: GitHubService,
) {
  fun list(projectId: String): List<RepoWorkflowsDto> {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    return project.repos.mapNotNull { r ->
      val (owner, name) = RepoCoords.of(project.org, r)
      // 접근 불가(404·403)한 저장소는 조용히 건너뛰되, PAT 미연결(401)은 삼키지 않아요 —
      // "워크플로 없음"이 아니라 "연결 필요"로 안내해야 하니까.
      val flows = try {
        gitHub.listWorkflows(owner, name)
      } catch (e: ResponseStatusException) {
        if (e.statusCode.value() == 401) throw e
        return@mapNotNull null
      }
      RepoWorkflowsDto("$owner/$name", r.name, flows.filter { it.state == "active" })
    }
  }

  fun dispatch(projectId: String, req: WorkflowDispatchRequest): WorkflowDispatchResponse {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val repo = project.repos.firstOrNull { r -> RepoCoords.of(project.org, r).let { (o, n) -> "$o/$n" } == req.repo }
      ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "프로젝트에 없는 저장소예요: ${req.repo}")
    if (req.workflowId <= 0) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "workflowId 가 필요해요.")
    val (owner, name) = RepoCoords.of(project.org, repo)
    val ref = req.ref?.takeIf { it.isNotBlank() }
      ?: gitHub.repoMeta(owner, name)?.path("default_branch")?.asText()?.takeIf { it.isNotBlank() }
      ?: "main"
    gitHub.dispatchWorkflow(owner, name, req.workflowId, ref)
    return WorkflowDispatchResponse(true, ref, "실행을 요청했어요 ($ref) — 잠시 후 GitHub 미러·활동 피드에 실행이 표시돼요.")
  }
}
