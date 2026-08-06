package dev.agentflow.service

import dev.agentflow.domain.E2eRunEntity
import dev.agentflow.domain.E2eRunRepository
import dev.agentflow.domain.TestCaseEntity
import dev.agentflow.domain.TestCaseRepository
import dev.agentflow.dto.E2eCaseDto
import dev.agentflow.dto.E2eRunCreateRequest
import dev.agentflow.dto.E2eRunDto
import dev.agentflow.dto.TestCaseCreateRequest
import dev.agentflow.dto.TestCaseDto
import dev.agentflow.util.Json
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.io.File
import java.time.Instant
import java.util.Base64

// E2E 테스트 리포트 — 실행별 케이스 결과는 DB, 캡처 이미지는 데이터 디렉터리 파일로 보관해요.
// E2E 스크립트가 실행 끝에 결과·스크린샷을 올리고, 대시보드 '테스트' 화면이 조회해요.
@Service
class E2eReportService(
  private val runs: E2eRunRepository,
  private val cases: TestCaseRepository,
  @Value("\${MIRROR_DATA_DIR:./.data}") private val dataDir: String,
) {
  private val safeName = Regex("""^[a-zA-Z0-9._-]{1,120}$""")

  fun list(): List<E2eRunDto> = runs.findAll().sortedByDescending { it.id }.map { it.toDto() }

  fun create(req: E2eRunCreateRequest): E2eRunDto {
    if (req.name.isBlank() || req.cases.isEmpty())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "name·cases 가 필요해요.")
    val e = E2eRunEntity(
      at = Instant.now().toString(),
      name = req.name.take(200),
      total = req.cases.size,
      passed = req.cases.count { it.ok },
      casesJson = Json.mapper.writeValueAsString(req.cases),
    )
    return runs.save(e).toDto()
  }

  fun addShot(id: Long, file: String, dataBase64: String): E2eRunDto {
    val e = runs.findById(id).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "실행이 없어요.")
    if (!safeName.matches(file) || !file.endsWith(".png"))
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "파일명은 영문·숫자·._- 의 .png 만 돼요.")
    val bytes = try { Base64.getDecoder().decode(dataBase64) } catch (ex: IllegalArgumentException) {
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "base64 디코딩에 실패했어요.")
    }
    val dir = File(dataDir, "e2e-shots/${e.id}").apply { mkdirs() }
    File(dir, file).writeBytes(bytes)
    val names = e.shotsCsv.split(",").filter { it.isNotBlank() }.toMutableList()
    if (file !in names) names += file
    e.shotsCsv = names.joinToString(",")
    return runs.save(e).toDto()
  }

  fun shot(id: Long, file: String): ByteArray {
    if (!safeName.matches(file)) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못된 파일명이에요.")
    val f = File(dataDir, "e2e-shots/$id/$file")
    if (!f.isFile) throw ResponseStatusException(HttpStatus.NOT_FOUND, "스크린샷이 없어요.")
    return f.readBytes()
  }

  // ---- 테스트케이스 레지스트리 — 화면별 케이스 정의 CRUD ----
  fun listCases(): List<TestCaseDto> =
    cases.findAll().sortedBy { it.id }.map { TestCaseDto(it.id, it.screen, it.name, it.note, it.createdAt) }

  fun createCase(req: TestCaseCreateRequest): TestCaseDto {
    if (req.screen.isBlank() || req.name.isBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "screen·name 이 필요해요.")
    if (cases.findAll().any { it.screen == req.screen && it.name == req.name.trim() })
      throw ResponseStatusException(HttpStatus.CONFLICT, "같은 화면에 같은 이름의 케이스가 이미 있어요.")
    val e = cases.save(TestCaseEntity(
      screen = req.screen.take(100), name = req.name.trim().take(500),
      note = req.note.take(1000), createdAt = Instant.now().toString(),
    ))
    return TestCaseDto(e.id, e.screen, e.name, e.note, e.createdAt)
  }

  fun deleteCase(id: Long) {
    val e = cases.findById(id).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "케이스가 없어요.")
    cases.delete(e)
  }

  private fun E2eRunEntity.toDto(): E2eRunDto {
    val cases: List<E2eCaseDto> = runCatching {
      Json.mapper.readValue(casesJson, Json.mapper.typeFactory.constructCollectionType(List::class.java, E2eCaseDto::class.java)) as List<E2eCaseDto>
    }.getOrElse { emptyList() }
    return E2eRunDto(id, at, name, total, passed, cases, shotsCsv.split(",").filter { it.isNotBlank() })
  }
}
