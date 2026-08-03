package dev.agentflow.service

import dev.agentflow.util.Json
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

// OpenAI Chat Completions 호출. OPENAI_API_KEY 가 없거나 호출이 실패하면 null 을
// 돌려 호출부가 다음 수단(템플릿)으로 폴백하게 한다. 모델은 OPENAI_MODEL 로 교체 가능.
@Service
class OpenAiClient {
  private val log = LoggerFactory.getLogger(javaClass)
  private val apiKey: String? = System.getenv("OPENAI_API_KEY")?.takeIf { it.isNotBlank() }
  private val model: String = System.getenv("OPENAI_MODEL")?.takeIf { it.isNotBlank() } ?: "gpt-5.1"
  private val http: HttpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()

  val enabled: Boolean get() = apiKey != null

  fun complete(system: String, user: String): String? {
    val key = apiKey ?: return null
    return try {
      val body = Json.mapper.writeValueAsString(
        mapOf(
          "model" to model,
          "messages" to listOf(
            mapOf("role" to "system", "content" to system),
            mapOf("role" to "user", "content" to user),
          ),
        ),
      )
      val req = HttpRequest.newBuilder(URI("https://api.openai.com/v1/chat/completions"))
        .header("Authorization", "Bearer $key")
        .header("content-type", "application/json")
        .timeout(Duration.ofMinutes(5))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build()
      val res = http.send(req, HttpResponse.BodyHandlers.ofString())
      if (res.statusCode() != 200) {
        log.warn("OpenAI API {} — 다음 수단으로 폴백", res.statusCode())
        return null
      }
      Json.mapper.readTree(res.body())
        .path("choices").firstOrNull()?.path("message")?.path("content")?.asText()
        ?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
      log.warn("OpenAI API 호출 실패 — 다음 수단으로 폴백: {}", e.message)
      null
    }
  }
}
