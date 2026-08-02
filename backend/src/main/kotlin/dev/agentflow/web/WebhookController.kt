package dev.agentflow.web

import dev.agentflow.config.AppProps
import dev.agentflow.config.HmacVerifier
import dev.agentflow.service.MirrorService
import dev.agentflow.util.Json
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController

@RestController
class WebhookController(
  private val mirror: MirrorService,
  private val hmac: HmacVerifier,
  private val props: AppProps,
) {
  // 원본 바이트를 받아 HMAC 서명(x-hub-signature-256)을 검증한 뒤 미러에 반영.
  @PostMapping("/api/webhook/github")
  fun receive(
    @RequestBody raw: ByteArray,
    @RequestHeader(name = "X-GitHub-Event", required = false) event: String?,
    @RequestHeader(name = "X-GitHub-Delivery", required = false) delivery: String?,
    @RequestHeader(name = "X-Hub-Signature-256", required = false) sig: String?,
  ): ResponseEntity<Any> {
    val ev = event ?: "unknown"
    val verified = hmac.verify(raw, sig, props.webhookSecret) // true / false / null
    if (verified == false) return ResponseEntity.status(401).body(mapOf("error" to "서명 검증 실패"))

    val payload = try {
      Json.mapper.readTree(if (raw.isEmpty()) "{}".toByteArray() else raw)
    } catch (e: Exception) {
      return ResponseEntity.badRequest().body(mapOf("error" to "invalid JSON"))
    }

    if (ev == "ping") {
      val zen = payload.path("zen").let { if (it.isMissingNode || it.isNull) null else it.asText() }
      return ResponseEntity.ok(mapOf("ok" to true, "pong" to true, "zen" to zen))
    }

    mirror.ingest(ev, payload, delivery, verified == true)
    return ResponseEntity.ok(mapOf("ok" to true, "mirrored" to true, "event" to ev, "verified" to (verified == true)))
  }
}
