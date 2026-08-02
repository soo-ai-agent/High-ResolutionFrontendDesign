package dev.agentflow.web

import dev.agentflow.dto.*
import dev.agentflow.service.MirrorService
import dev.agentflow.service.ProjectService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/mirror")
class MirrorController(
  private val mirror: MirrorService,
  private val projects: ProjectService,
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
    return ResponseEntity.status(HttpStatus.CREATED).body(projects.create(dto))
  }
}
