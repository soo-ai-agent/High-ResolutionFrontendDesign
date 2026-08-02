package dev.agentflow.web

import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HealthController {
  @GetMapping("/api/health")
  fun health(): Map<String, Boolean> = mapOf("ok" to true)
}

@RestController
class BootstrapController {
  // 시드 데이터(프로젝트 목록 등 데모) — 프론트가 부팅 시 하이드레이션에 사용.
  private val body: String by lazy {
    val res = ClassPathResource("bootstrap.json")
    if (res.exists()) res.inputStream.readBytes().toString(Charsets.UTF_8) else "{}"
  }

  @GetMapping("/api/bootstrap", produces = [MediaType.APPLICATION_JSON_VALUE])
  fun bootstrap(): ResponseEntity<String> =
    ResponseEntity.ok().header("Cache-Control", "no-store").body(body)
}
