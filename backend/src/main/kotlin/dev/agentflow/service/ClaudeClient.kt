package dev.agentflow.service

import dev.agentflow.util.Json
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

// Claude API 호출 (Messages API, 비스트리밍). ANTHROPIC_API_KEY 가 없거나
// 호출이 실패·거절되면 null 을 돌려 호출부가 템플릿으로 폴백하게 한다.
@Service
class ClaudeClient {
  private val log = LoggerFactory.getLogger(javaClass)
  private val apiKey: String? = System.getenv("ANTHROPIC_API_KEY")?.takeIf { it.isNotBlank() }
  private val http: HttpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

  val enabled: Boolean get() = apiKey != null

  fun complete(system: String, user: String, maxTokens: Int = 8192): String? {
    val key = apiKey ?: return null
    return try {
      val body = Json.mapper.writeValueAsString(
        mapOf(
          "model" to "claude-opus-5",
          "max_tokens" to maxTokens,
          "system" to system,
          "messages" to listOf(mapOf("role" to "user", "content" to user)),
        ),
      )
      val req = HttpRequest.newBuilder(URI("https://api.anthropic.com/v1/messages"))
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .timeout(Duration.ofMinutes(5))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build()
      val res = http.send(req, HttpResponse.BodyHandlers.ofString())
      if (res.statusCode() != 200) {
        log.warn("Claude API {} — 템플릿으로 폴백", res.statusCode())
        return null
      }
      val json = Json.mapper.readTree(res.body())
      // 안전 분류기 거절(stop_reason=refusal)은 본문이 비거나 부분 출력 — 폴백
      if (json.path("stop_reason").asText() == "refusal") return null
      json.path("content").firstOrNull { it.path("type").asText() == "text" }
        ?.path("text")?.asText()?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
      log.warn("Claude API 호출 실패 — 템플릿으로 폴백: {}", e.message)
      null
    }
  }
}
