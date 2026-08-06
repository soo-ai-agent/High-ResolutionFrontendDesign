package dev.agentflow.web

import dev.agentflow.dto.*
import dev.agentflow.service.CiRecoveryService
import dev.agentflow.service.MirrorService
import dev.agentflow.service.ProjectActivityService
import dev.agentflow.service.ProjectDocService
import dev.agentflow.service.ProjectService
import dev.agentflow.service.ProjectWorkflowService
import dev.agentflow.service.TaskService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/mirror")
class MirrorController(
  private val mirror: MirrorService,
  private val projects: ProjectService,
  private val docs: ProjectDocService,
  private val taskService: TaskService,
  private val activity: ProjectActivityService,
  private val ciRecovery: CiRecoveryService,
  private val workflows: ProjectWorkflowService,
) {
  @GetMapping("", "/", "/summary")
  fun summary(): MirrorSummary = mirror.summary()

  @GetMapping("/issues")
  fun issues(@RequestParam(required = false) repo: String?): List<MirrorIssueDto> = mirror.listIssues(repo)

  @PatchMapping("/issues")
  fun patchIssue(@RequestBody body: Map<String, Any?>): MirrorIssueDto {
    val repo = body["repo"] as? String
    val number = (body["number"] as? Number)?.toLong()
    if (repo.isNullOrBlank() || number == null)
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "repo·number 가 필요해요.")
    return mirror.setIssueAdmin(repo, number, body)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "미러에 없는 이슈예요. 먼저 웹훅으로 동기화되어야 해요.")
  }

  @GetMapping("/pulls")
  fun pulls(@RequestParam(required = false) repo: String?): List<MirrorPullDto> = mirror.listPulls(repo)

  @GetMapping("/runs")
  fun runs(@RequestParam(required = false) repo: String?): List<MirrorRunDto> = mirror.listRuns(repo)

  @GetMapping("/repos")
  fun repos(): List<RepoDto> = mirror.listRepos()

  @GetMapping("/events")
  fun events(@RequestParam(required = false) repo: String?): List<MirrorEventDto> = mirror.listEvents(repo)

  @GetMapping("/board")
  fun board(): List<BoardItemDto> = mirror.listBoard()

  @PostMapping("/reset")
  fun reset(): Map<String, Any> { mirror.reset(); return mapOf("ok" to true, "reset" to true) }

  // ---- 프로젝트 (어드민 소유) ----
  @GetMapping("/projects")
  fun listProjects(): List<ProjectDto> = projects.list()

  @PostMapping("/projects")
  fun createProject(@RequestBody dto: ProjectDto): ResponseEntity<ProjectDto> {
    if (dto.id.isBlank() || dto.name.isBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "id·name 이 필요해요.")
    val created = projects.create(dto)
    // 문서(PRD·IA) → 작업 분해 순서로 백그라운드 생성 — 생성 응답을 막지 않는다.
    Thread.startVirtualThread {
      docs.generateAll(created.id)
      runCatching { taskService.generate(created.id) }
    }
    return ResponseEntity.status(HttpStatus.CREATED).body(created)
  }

  // ---- 작업 (프로젝트별 태스크) ----
  @GetMapping("/projects/{id}/tasks")
  fun listTasks(@PathVariable id: String): List<TaskDto> = taskService.list(id)

  @PostMapping("/projects/{id}/tasks/generate")
  fun generateTasks(@PathVariable id: String): List<TaskDto> = taskService.generate(id)

  @PatchMapping("/projects/{id}/tasks/{taskId}")
  fun patchTask(@PathVariable id: String, @PathVariable taskId: String, @RequestBody req: TaskPatchRequest): TaskDto =
    taskService.patch(id, taskId, req)

  @DeleteMapping("/projects/{id}/tasks/{taskId}")
  fun deleteTask(@PathVariable id: String, @PathVariable taskId: String): Map<String, Any> {
    taskService.delete(id, taskId)
    return mapOf("ok" to true)
  }

  @PostMapping("/projects/{id}/tasks/{taskId}/sync-issue")
  fun syncTaskIssue(@PathVariable id: String, @PathVariable taskId: String): TaskDto = taskService.syncIssue(id, taskId)

  // 원클릭 에이전트 착수 — 이슈 생성(없으면) + @claude 착수 코멘트 + 진행 중 전환.
  @PostMapping("/projects/{id}/tasks/{taskId}/kickoff")
  fun kickoffTask(@PathVariable id: String, @PathVariable taskId: String): TaskDto = taskService.kickoff(id, taskId)

  // ---- 자동 디스패치 — 단계 순서·우선순위 기반, 동시 실행 제한 안에서 ai 작업 자동 착수 ----
  @GetMapping("/projects/{id}/dispatch")
  fun dispatchStatus(@PathVariable id: String): DispatchStatusDto = taskService.dispatchStatus(id)

  @PutMapping("/projects/{id}/dispatch")
  fun setDispatch(@PathVariable id: String, @RequestBody req: DispatchConfigRequest): DispatchStatusDto =
    taskService.setDispatchConfig(id, req)

  @PostMapping("/projects/{id}/dispatch/run")
  fun runDispatch(@PathVariable id: String): DispatchStatusDto = taskService.runDispatch(id, force = true)

  // Actions 실행 내역 — 프로젝트 저장소들의 workflow_run 미러 (실행이 있을 때마다 여기 보여요).
  @GetMapping("/projects/{id}/runs")
  fun projectRuns(@PathVariable id: String, @RequestParam(defaultValue = "10") limit: Int): List<MirrorRunDto> =
    activity.runs(id, limit.coerceIn(1, 50))

  // 진행 간트 — 활동 이력 기반 실적 타임라인.
  @GetMapping("/projects/{id}/gantt")
  fun projectGantt(@PathVariable id: String): List<GanttRowDto> = taskService.gantt(id)

  // 에이전트 활동 피드 — 작업 활동 + Actions 실행 + 웹훅 이벤트 통합 타임라인.
  @GetMapping("/projects/{id}/activity")
  fun projectActivity(@PathVariable id: String, @RequestParam(defaultValue = "50") limit: Int): List<ProjectActivityDto> =
    activity.feed(id, limit.coerceIn(1, 200))

  // CI 실패 자동 회복 수동 실행 — 스케줄러(30초)와 같은 스윕을 즉시 돌려요.
  @PostMapping("/projects/{id}/ci-recovery/run")
  fun runCiRecovery(@PathVariable id: String): CiRecoveryResultDto = ciRecovery.sweep(id)

  // 보드 카드 착수(A안) — 카드 이슈가 작업 계획과 매칭되면 작업 착수, 아니면 이슈에 @claude 지시.
  @PostMapping("/board/kickoff")
  fun boardKickoff(@RequestBody req: BoardKickoffRequest): BoardKickoffResponse =
    taskService.boardKickoff(req.repo, req.number)

  // ---- 외부 워크플로 실행 (workflow_dispatch) ----
  @GetMapping("/projects/{id}/workflows")
  fun listWorkflows(@PathVariable id: String): List<RepoWorkflowsDto> = workflows.list(id)

  @PostMapping("/projects/{id}/workflows/dispatch")
  fun dispatchWorkflow(@PathVariable id: String, @RequestBody req: WorkflowDispatchRequest): WorkflowDispatchResponse =
    workflows.dispatch(id, req)

  @PostMapping("/projects/{id}/tasks/{taskId}/review")
  fun reviewTask(@PathVariable id: String, @PathVariable taskId: String, @RequestBody req: TaskReviewRequest): TaskDto =
    taskService.review(id, taskId, req)

  @GetMapping("/projects/{id}/tasks/{taskId}/insight")
  fun taskInsight(@PathVariable id: String, @PathVariable taskId: String): TaskInsightDto = taskService.insight(id, taskId)

  // ---- 프로젝트 문서 (PRD·IA 등) ----
  @GetMapping("/projects/{id}/docs/{type}")
  fun getDoc(@PathVariable id: String, @PathVariable type: String): ProjectDocDto =
    docs.get(id, type) ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "문서가 아직 없어요.")

  @PostMapping("/projects/{id}/docs/{type}/generate")
  fun generateDoc(@PathVariable id: String, @PathVariable type: String): ProjectDocDto = docs.generate(id, type)

  @PutMapping("/projects/{id}/docs/{type}")
  fun updateDoc(@PathVariable id: String, @PathVariable type: String, @RequestBody req: DocUpdateRequest): ProjectDocDto =
    docs.update(id, type, req)

  // 코드 규칙 → 프로젝트 저장소들의 CLAUDE.md 로 동기화 (코딩 에이전트가 매 작업마다 읽어요).
  @PostMapping("/projects/{id}/docs/rules/sync-repo")
  fun syncRules(@PathVariable id: String): RuleSyncResponse = docs.syncRulesToRepos(id)

  // ---- 문서 버전 이력 (에이전트 초안 보존 · diff 평가용) ----
  @GetMapping("/projects/{id}/docs/{type}/revisions")
  fun docRevisions(@PathVariable id: String, @PathVariable type: String): List<DocRevisionDto> = docs.listRevisions(id, type)

  @GetMapping("/projects/{id}/docs/{type}/revisions/{seq}")
  fun docRevision(@PathVariable id: String, @PathVariable type: String, @PathVariable seq: Long): DocRevisionDto =
    docs.getRevision(id, type, seq)

  @PostMapping("/projects/{id}/docs/{type}/revisions/{seq}/restore")
  fun restoreDocRevision(@PathVariable id: String, @PathVariable type: String, @PathVariable seq: Long): ProjectDocDto =
    docs.restoreRevision(id, type, seq)
}
