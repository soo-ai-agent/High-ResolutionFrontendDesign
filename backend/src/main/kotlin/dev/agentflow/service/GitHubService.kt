package dev.agentflow.service

import com.fasterxml.jackson.databind.JsonNode
import dev.agentflow.config.AppProps
import dev.agentflow.config.GitHubTokenStore
import dev.agentflow.dto.*
import dev.agentflow.util.Json
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
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
  private val settings: SettingService,
) {
  // 부팅 시 저장된 연결 복원 — PAT 는 데이터 폴더 DB에 영속화돼 재시작에도 유지돼요.
  @EventListener(ApplicationReadyEvent::class)
  fun restoreConnection() {
    if (tokenStore.token != null) return
    val saved = settings.get(SettingService.GITHUB_TOKEN) ?: return
    tokenStore.token = saved
    tokenStore.user = settings.get(SettingService.GITHUB_USER)?.let {
      runCatching { Json.mapper.readValue(it, GHUser::class.java) }.getOrNull()
    }
  }

  private fun persistConnection() {
    tokenStore.token?.let { settings.put(SettingService.GITHUB_TOKEN, it) }
    tokenStore.user?.let { settings.put(SettingService.GITHUB_USER, Json.mapper.writeValueAsString(it)) }
  }

  private fun clearPersistedConnection() {
    settings.remove(SettingService.GITHUB_TOKEN)
    settings.remove(SettingService.GITHUB_USER)
  }
  private val client: RestClient by lazy { RestClient.builder().baseUrl(props.githubApiBase).build() }

  private fun messageFor(status: Int) = when (status) {
    401 -> "토큰이 유효하지 않아요. 다시 확인해 주세요."
    403 -> "요청 한도를 초과했거나 접근 권한이 없어요."
    404 -> "대상을 찾을 수 없어요."
    410 -> "저장소에서 Issues 기능이 꺼져 있어요. GitHub 저장소 Settings → Features 에서 Issues 를 켜 주세요."
    422 -> "실행할 수 없어요 — 워크플로에 workflow_dispatch 트리거가 있는지, 브랜치(ref)가 맞는지 확인하세요."
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
    if (code == 401) { tokenStore.clear(); clearPersistedConnection() }
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
    persistConnection()
    return StatusResponse(true, tokenStore.user)
  }

  fun disconnect(): StatusResponse { tokenStore.clear(); clearPersistedConnection(); return StatusResponse(false, null) }

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

  // 일반 코멘트 — @claude 접두를 붙이지 않아요. 분해 요약처럼 에이전트를 깨우면 안 되는 회신용.
  fun comment(owner: String, repo: String, number: Long, body: String): CommentResult {
    val t = tokenOr401()
    val j = translate {
      client.post().uri("/repos/{o}/{r}/issues/{n}/comments", owner, repo, number).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(mapOf("body" to body)).retrieve().body(JsonNode::class.java)
    }!!
    return CommentResult(j.path("id").asLong(), j.path("html_url").asText(), body)
  }

  // ---- 이슈 라벨 — 분해 트리거 라벨의 붙이기·떼기(재트리거 방지)에 써요 ----
  fun addLabels(owner: String, repo: String, number: Long, labels: List<String>) {
    if (labels.isEmpty()) return
    val t = tokenOr401()
    translate {
      client.post().uri("/repos/{o}/{r}/issues/{n}/labels", owner, repo, number).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(mapOf("labels" to labels)).retrieve().toBodilessEntity()
    }
  }

  fun removeLabel(owner: String, repo: String, number: Long, label: String) {
    val t = tokenOr401()
    translate {
      client.delete().uri("/repos/{o}/{r}/issues/{n}/labels/{l}", owner, repo, number, label).headers(auth(t)).retrieve().toBodilessEntity()
    }
  }

  // 파일 쓰기(contents API) — 있으면 갱신(sha 필요), 없으면 생성. CLAUDE.md·스킬 동기화에 써요.
  // 문서 동기화는 읽기와 같은 폴백을 허용해요: UI PAT → 서버 환경 GITHUB_TOKEN.
  fun putFile(owner: String, repo: String, path: String, content: String, message: String): String {
    val t = tokenStore.token ?: envToken
      ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "GitHub에 연결되어 있지 않아요.")
    val existing = runCatching {
      client.get().uri("/repos/{o}/{r}/contents/{p}", owner, repo, path).headers(auth(t)).retrieve().body(JsonNode::class.java)
    }.getOrNull()
    val sha = existing?.path("sha")?.asText()?.takeIf { it.isNotBlank() }
    val payload = mutableMapOf<String, Any>(
      "message" to message,
      "content" to java.util.Base64.getEncoder().encodeToString(content.toByteArray(Charsets.UTF_8)),
    )
    if (sha != null) payload["sha"] = sha
    val j = translate {
      client.put().uri("/repos/{o}/{r}/contents/{p}", owner, repo, path).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(payload).retrieve().body(JsonNode::class.java)
    }!!
    return j.path("content").path("html_url").asText("")
  }

  // ---- Actions 워크플로 — 목록 조회 · workflow_dispatch 실행 ----
  fun listWorkflows(owner: String, repo: String): List<WorkflowDto> {
    val t = tokenOr401()
    val j = translate {
      client.get().uri("/repos/{o}/{r}/actions/workflows?per_page=100", owner, repo).headers(auth(t)).retrieve().body(JsonNode::class.java)
    }
    val arr = j?.path("workflows") ?: return emptyList()
    return arr.map { WorkflowDto(it.path("id").asLong(), it.path("name").asText(""), it.path("path").asText(""), it.path("state").asText("")) }
  }

  fun dispatchWorkflow(owner: String, repo: String, workflowId: Long, ref: String) {
    val t = tokenOr401()
    translate {
      client.post().uri("/repos/{o}/{r}/actions/workflows/{w}/dispatches", owner, repo, workflowId)
        .headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(mapOf("ref" to ref)).retrieve().toBodilessEntity()
    }
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

  // ---- 조직 웹훅 — 보드 이동(projects_v2_item)은 조직 레벨 이벤트로만 와요.
  // PAT 에 admin:org_hook 스코프가 필요해요(없으면 404/403 로 응답돼요).
  fun listOrgHooks(org: String): List<GHHook> {
    val t = tokenOr401()
    val j = translate {
      client.get().uri("/orgs/{o}/hooks?per_page=100", org).headers(auth(t)).retrieve().body(JsonNode::class.java)
    }
    return if (j != null && j.isArray) j.map { mapHook(it) } else emptyList()
  }

  fun createOrgHook(org: String, url: String, secret: String?): GHHook {
    val t = tokenOr401()
    val config = mutableMapOf<String, Any>("url" to url, "content_type" to "json", "insecure_ssl" to "0")
    if (!secret.isNullOrBlank()) config["secret"] = secret
    val body = mapOf("name" to "web", "active" to true, "events" to listOf("projects_v2_item"), "config" to config)
    val j = translate {
      client.post().uri("/orgs/{o}/hooks", org).headers(auth(t)).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode::class.java)
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

  // ---- PR — 로컬 브리지가 결과 브랜치의 PR 을 보장할 때 써요 ----
  fun openPullNumberByHead(owner: String, repo: String, branch: String): Long? = runCatching {
    val j = client.get().uri("/repos/{o}/{r}/pulls?state=open&head={h}", owner, repo, "$owner:$branch")
      .headers(readHeaders()).retrieve().body(JsonNode::class.java)
    j?.firstOrNull()?.path("number")?.asLong()?.takeIf { it > 0 }
  }.getOrNull()

  fun createPull(owner: String, repo: String, title: String, head: String, base: String, body: String): CreatedIssue {
    val t = tokenStore.token ?: envToken
      ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "GitHub에 연결되어 있지 않아요.")
    val j = translate {
      client.post().uri("/repos/{o}/{r}/pulls", owner, repo).headers(auth(t)).contentType(MediaType.APPLICATION_JSON)
        .body(mapOf("title" to title, "head" to head, "base" to base, "body" to body)).retrieve().body(JsonNode::class.java)
    }!!
    return CreatedIssue(j.path("number").asLong(), j.path("html_url").asText(), j.path("title").asText())
  }

  fun defaultBranch(owner: String, repo: String): String =
    repoMeta(owner, repo)?.path("default_branch")?.asText("")?.takeIf { it.isNotBlank() } ?: "main"

  // 로컬 브리지의 git 클론 인증 — UI PAT → 서버 환경 GITHUB_TOKEN 순.
  fun cloneToken(): String? = tokenStore.token ?: envToken

  // 이슈 본문 — 미러에는 제목만 있어서, 승격(가져오기) 시 상세로 쓸 본문을 읽어요. 실패는 null.
  fun issueBody(owner: String, repo: String, number: Long): String? = runCatching {
    client.get().uri("/repos/{o}/{r}/issues/{n}", owner, repo, number).headers(readHeaders()).retrieve().body(JsonNode::class.java)
      ?.path("body")?.let { if (it.isNull || it.isMissingNode) null else it.asText() }
  }.getOrNull()

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
    // issue_comment·pull_request_review_comment: 코멘트 미러(인사이트 패널) 근거 데이터.
    // 기존에 등록한 웹훅에는 없어요 — 미러 화면에서 웹훅을 다시 등록하면 추가돼요.
    val DEFAULT_HOOK_EVENTS = listOf("issues", "pull_request", "workflow_run", "push", "issue_comment", "pull_request_review_comment")
  }
}
