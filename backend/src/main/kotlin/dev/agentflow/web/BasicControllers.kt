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
  // 프론트 빌드(dist/bootstrap.json)가 static/ 으로 번들돼요. 단일 소스 = src/data.source.ts.
  // (`pnpm build` 전이면 없을 수 있고, 그 경우 빈 시드로 동작해요.)
  private val body: String by lazy {
    val res = ClassPathResource("static/bootstrap.json")
    if (res.exists()) res.inputStream.readBytes().toString(Charsets.UTF_8) else "{}"
  }

  @GetMapping("/api/bootstrap", produces = [MediaType.APPLICATION_JSON_VALUE])
  fun bootstrap(): ResponseEntity<String> =
    ResponseEntity.ok().header("Cache-Control", "no-store").body(body)
}
