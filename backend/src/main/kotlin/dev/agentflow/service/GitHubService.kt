package dev.agentflow.service

import com.fasterxml.jackson.databind.JsonNode
import dev.agentflow.config.AppProps
import dev.agentflow.config.GitHubTokenStore
import dev.agentflow.dto.*
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import org.springframework.web.server.ResponseStatusException

@Service
class GitHubService(
  private val props: AppProps,
  private val tokenStore: GitHubTokenStore,
  private val mirror: MirrorService,
) {
  private val client: RestClient by lazy { RestClient.builder().baseUrl(props.githubApiBase).build() }

  private fun messageFor(status: Int) = when (status) {
    401 -> "토큰이 유효하지 않아요. 다시 확인해 주세요."
    403 -> "요청 한도를 초과했거나 접근 권한이 없어요."
    404 -> "대상을 찾을 수 없어요."
    410 -> "저장소에서 Issues 기능이 꺼져 있어요. GitHub 저장소 Settings → Features 에서 Issues 를 켜 주세요."
    else -> "GitHub 요청에 실패했어요 ($status)."
  }

  private fun tokenOr401(): String = tokenStore.token ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "GitHub에 연결되어 있지 않아요.")

  // 인증 헤더를 Consumer 로 적용 — 스펙의 구체 타입(RequestBodySpec 등)을 보존해요.
  private fun auth(token: String): (HttpHeaders) -> Unit = { h ->
    h.set("Authorization", "Bearer $token")
    h.set("Accept", "application/vnd.github+json")
    h.set("X-GitHub-Api-Version", "2022-11-28")
  }

  private fun <T> translate(block: () -> T): T = try {
    block()
  } catch (e: RestClientResponseException) {
    val code = e.statusCode.value()
    if (code == 401) tokenStore.clear()
    throw ResponseStatusException(e.statusCode, messageFor(code))
  }

  // ---- 연결 상태 ----
  fun status() = StatusResponse(tokenStore.token != null, tokenStore.user)

  fun connect(token: String?): StatusResponse {
    val t = token?.trim().orEmpty()
    if (t.isEmpty()) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "토큰을 입력해 주세요.")
    val j = translate {
      client.get().uri("/user").headers(auth(t)).retrieve().body(JsonNode::class.java)
    } ?: throw ResponseStatusException(HttpStatus.BAD_GATEWAY, "사용자 정보를 못 읽었어요.")
    tokenStore.token = t
    tokenStore.user = GHUser(
      j.path("login").asText(),
      j.path("name").let { if (it.isNull || it.isMissingNode) null else it.asText() },
      j.path("avatar_url").let { if (it.isNull || it.isMissingNode) null else it.asText() },
    )
    return StatusResponse(true, tokenStore.user)
  }

  fun disconnect(): StatusResponse { tokenStore.clear(); return StatusResponse(false, null) }

  // ---- 쓰기 ----
  fun createIssue(owner: String, repo: String, req: IssueCreateRequest): CreatedIssue {
    val t = tokenOr401()
    val payload = mutableMapOf<String, Any>("title" to (req.title?.trim() ?: ""), "body" to (req.body ?: ""))
    if (!req.labels.isNullOrEmpty()) payload["labels"] = req.labels
    val j = translate {
      client.post().uri("/repos/{o}/{r}/issues", owner, repo).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(payload).retrieve().body(JsonNode::class.java)
    }!!
    return CreatedIssue(j.path("number").asLong(), j.path("html_url").asText(), j.path("title").asText())
  }

  fun claudeComment(owner: String, repo: String, number: Long, prompt: String): CommentResult {
    val t = tokenOr401()
    val text = if (prompt.startsWith("@claude")) prompt else "@claude $prompt"
    val j = translate {
      client.post().uri("/repos/{o}/{r}/issues/{n}/comments", owner, repo, number).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(mapOf("body" to text)).retrieve().body(JsonNode::class.java)
    }!!
    return CommentResult(j.path("id").asLong(), j.path("html_url").asText(), text)
  }

  fun reopenIssue(owner: String, repo: String, number: Long) {
    val t = tokenOr401()
    translate {
      client.patch().uri("/repos/{o}/{r}/issues/{n}", owner, repo, number).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(mapOf("state" to "open")).retrieve().toBodilessEntity()
    }
  }

  // ---- 웹훅(레포지토리 훅) 관리 ----
  fun listHooks(owner: String, repo: String): List<GHHook> {
    val t = tokenOr401()
    val j = translate {
      client.get().uri("/repos/{o}/{r}/hooks?per_page=100", owner, repo).headers(auth(t)).retrieve().body(JsonNode::class.java)
    }
    return if (j != null && j.isArray) j.map { mapHook(it) } else emptyList()
  }

  fun createHook(owner: String, repo: String, url: String, secret: String?, events: List<String>?): GHHook {
    val t = tokenOr401()
    val config = mutableMapOf<String, Any>("url" to url, "content_type" to "json", "insecure_ssl" to "0")
    if (!secret.isNullOrBlank()) config["secret"] = secret
    val body = mapOf("name" to "web", "active" to true, "events" to (events?.takeIf { it.isNotEmpty() } ?: DEFAULT_HOOK_EVENTS), "config" to config)
    val j = translate {
      client.post().uri("/repos/{o}/{r}/hooks", owner, repo).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode::class.java)
    }!!
    return mapHook(j)
  }

  fun pingHook(owner: String, repo: String, id: Long) {
    val t = tokenOr401()
    translate {
      client.post().uri("/repos/{o}/{r}/hooks/{id}/pings", owner, repo, id).headers(auth(t)).retrieve().toBodilessEntity()
    }
  }

  // ---- 백필 ----
  fun backfill(owner: String, repo: String, include: List<String>): BackfillResult {
    val t = tokenOr401()
    val full = "$owner/$repo"
    try {
      val r = translate { client.get().uri("/repos/{o}/{r}", owner, repo).headers(auth(t)).retrieve().body(JsonNode::class.java) }
      if (r != null) mirror.upsertRepo(
        r.path("full_name").asText(full),
        r.path("private").asBoolean(false),
        r.path("default_branch").let { if (it.isNull || it.isMissingNode) null else it.asText() },
        r.path("updated_at").let { if (it.isNull || it.isMissingNode) null else it.asText() },
      )
    } catch (_: Exception) { /* 메타 실패는 무시 */ }

    val issuesData = if (include.contains("issues")) translate { client.get().uri("/repos/{o}/{r}/issues?state=all&per_page=100", owner, repo).headers(auth(t)).retrieve().body(JsonNode::class.java) } else null
    val pullsData = if (include.contains("pulls")) translate { client.get().uri("/repos/{o}/{r}/pulls?state=all&per_page=100", owner, repo).headers(auth(t)).retrieve().body(JsonNode::class.java) } else null
    val runsWrap = if (include.contains("runs")) translate { client.get().uri("/repos/{o}/{r}/actions/runs?per_page=50", owner, repo).headers(auth(t)).retrieve().body(JsonNode::class.java) } else null
    val runsData = runsWrap?.path("workflow_runs")

    return mirror.applyBackfill(full, include, issuesData, pullsData, runsData)
  }

  // ---- 저장소 읽기 (문서 생성용 분석) ----
  // 우선순위: 화면에서 연결한 PAT → 서버 환경변수 GITHUB_TOKEN → 무인증(공개 저장소만).
  // 실패는 조용히 null/빈 목록 — 분석은 부가 기능이라 문서 생성을 막지 않는다.
  private val envToken: String? = System.getenv("GITHUB_TOKEN")?.takeIf { it.isNotBlank() }

  private fun readHeaders(accept: String = "application/vnd.github+json"): (HttpHeaders) -> Unit = { h ->
    (tokenStore.token ?: envToken)?.let { h.set("Authorization", "Bearer $it") }
    h.set("Accept", accept)
    h.set("X-GitHub-Api-Version", "2022-11-28")
  }

  fun repoMeta(owner: String, repo: String): JsonNode? = runCatching {
    client.get().uri("/repos/{o}/{r}", owner, repo).headers(readHeaders()).retrieve().body(JsonNode::class.java)
  }.getOrNull()

  fun readme(owner: String, repo: String): String? = runCatching {
    client.get().uri("/repos/{o}/{r}/readme", owner, repo).headers(readHeaders("application/vnd.github.raw+json")).retrieve().body(String::class.java)
  }.getOrNull()

  fun treePaths(owner: String, repo: String, branch: String): List<String> = runCatching {
    val j = client.get().uri("/repos/{o}/{r}/git/trees/{b}?recursive=1", owner, repo, branch).headers(readHeaders()).retrieve().body(JsonNode::class.java)
    j?.path("tree")?.mapNotNull { it.path("path").asText(null) } ?: emptyList()
  }.getOrElse { emptyList() }

  fun fileText(owner: String, repo: String, path: String): String? = runCatching {
    client.get().uri("/repos/{o}/{r}/contents/{p}", owner, repo, path).headers(readHeaders("application/vnd.github.raw+json")).retrieve().body(String::class.java)
  }.getOrNull()

  private fun mapHook(h: JsonNode) = GHHook(
    id = h.path("id").asLong(),
    active = h.path("active").asBoolean(false),
    events = h.path("events").map { it.asText() },
    url = h.path("config").path("url").asText(""),
    insecure_ssl = h.path("config").path("insecure_ssl").asText("0"),
    last_status = h.path("last_response").path("status").let { if (it.isNull || it.isMissingNode) null else it.asText() },
    last_code = h.path("last_response").path("code").let { if (it.isNull || it.isMissingNode) null else it.asInt() },
    updated_at = h.path("updated_at").let { if (it.isMissingNode) null else it.asText() },
  )

  companion object {
    val DEFAULT_HOOK_EVENTS = listOf("issues", "pull_request", "workflow_run", "push")
  }
}
