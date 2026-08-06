package dev.agentflow.web

import dev.agentflow.dto.E2eRunCreateRequest
import dev.agentflow.dto.E2eRunDto
import dev.agentflow.dto.E2eShotRequest
import dev.agentflow.service.E2eReportService
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

// E2E 테스트 리포트 API — 스크립트가 결과를 올리고, 대시보드 '테스트' 화면이 조회해요.
@RestController
@RequestMapping("/api/e2e")
class E2eController(private val e2e: E2eReportService) {
  @GetMapping("/runs")
  fun list(): List<E2eRunDto> = e2e.list()

  @PostMapping("/runs")
  fun create(@RequestBody req: E2eRunCreateRequest): E2eRunDto = e2e.create(req)

  // 스크린샷은 한 장씩 base64 로 올려요 — 멀티파트 용량 제한을 피하고 클라이언트를 단순하게.
  @PostMapping("/runs/{id}/shots")
  fun addShot(@PathVariable id: Long, @RequestBody req: E2eShotRequest): E2eRunDto =
    e2e.addShot(id, req.file, req.dataBase64)

  @GetMapping("/runs/{id}/shots/{file}")
  fun shot(@PathVariable id: Long, @PathVariable file: String): ResponseEntity<ByteArray> =
    ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(e2e.shot(id, file))
}
