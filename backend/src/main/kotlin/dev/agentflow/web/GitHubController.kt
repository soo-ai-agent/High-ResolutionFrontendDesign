package dev.agentflow.web

import dev.agentflow.dto.*
import dev.agentflow.service.GitHubService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/github")
class GitHubController(private val gh: GitHubService) {

  @GetMapping("/status")
  fun status(): StatusResponse = gh.status()

  @PostMapping("/connect")
  fun connect(@RequestBody req: ConnectRequest): StatusResponse = gh.connect(req.token)

  @PostMapping("/disconnect")
  fun disconnect(): StatusResponse = gh.disconnect()

  @PostMapping("/issues")
  fun createIssue(@RequestBody req: IssueCreateRequest): ResponseEntity<CreatedIssue> {
    val owner = req.owner; val repo = req.repo; val title = req.title?.trim()
    if (owner.isNullOrBlank() || repo.isNullOrBlank() || title.isNullOrBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "owner·repo·title 이 필요해요.")
    return ResponseEntity.status(HttpStatus.CREATED).body(gh.createIssue(owner, repo, req))
  }

  @PostMapping("/claude")
  fun claude(@RequestBody req: ClaudeRequest): ResponseEntity<CommentResult> {
    val owner = req.owner; val repo = req.repo; val number = req.number; val prompt = req.prompt?.trim()
    if (owner.isNullOrBlank() || repo.isNullOrBlank() || number == null || prompt.isNullOrBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "owner·repo·number·prompt 가 필요해요.")
    return ResponseEntity.status(HttpStatus.CREATED).body(gh.claudeComment(owner, repo, number, prompt))
  }

  @GetMapping("/hooks")
  fun listHooks(@RequestParam owner: String?, @RequestParam repo: String?): List<GHHook> {
    if (owner.isNullOrBlank() || repo.isNullOrBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "owner·repo가 필요해요.")
    return gh.listHooks(owner, repo)
  }

  @PostMapping("/hooks")
  fun createHook(@RequestBody req: HookCreateRequest): ResponseEntity<GHHook> {
    val owner = req.owner; val repo = req.repo; val url = req.url?.trim()
    if (owner.isNullOrBlank() || repo.isNullOrBlank() || url.isNullOrBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "owner·repo·url 이 필요해요.")
    return ResponseEntity.status(HttpStatus.CREATED).body(gh.createHook(owner, repo, url, req.secret, req.events))
  }

  @PostMapping("/hooks/ping")
  fun pingHook(@RequestBody req: HookPingRequest): Map<String, Any> {
    val owner = req.owner; val repo = req.repo; val id = req.id
    if (owner.isNullOrBlank() || repo.isNullOrBlank() || id == null)
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "owner·repo·id 가 필요해요.")
    gh.pingHook(owner, repo, id)
    return mapOf("ok" to true, "pinged" to id)
  }

  @PostMapping("/backfill")
  fun backfill(@RequestBody req: BackfillRequest): BackfillResult {
    val owner = req.owner; val repo = req.repo
    if (owner.isNullOrBlank() || repo.isNullOrBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "owner·repo 가 필요해요.")
    val include = req.include?.takeIf { it.isNotEmpty() } ?: listOf("issues", "pulls", "runs")
    return gh.backfill(owner, repo, include)
  }
}
