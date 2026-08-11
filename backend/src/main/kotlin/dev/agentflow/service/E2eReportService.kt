package dev.agentflow.service

import dev.agentflow.domain.E2eRunEntity
import dev.agentflow.domain.E2eRunRepository
import dev.agentflow.domain.TestCaseEntity
import dev.agentflow.domain.TestCaseRepository
import dev.agentflow.dto.E2eCaseDto
import dev.agentflow.dto.E2eExecStatusDto
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
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

// E2E 테스트 리포트 — 실행별 케이스 결과는 DB, 캡처 이미지는 데이터 디렉터리 파일로 보관해요.
// E2E 스크립트가 실행 끝에 결과·스크린샷을 올리고, 대시보드 '테스트' 화면이 조회해요.
@Service
class E2eReportService(
  private val runs: E2eRunRepository,
  private val cases: TestCaseRepository,
  @Value("\${MIRROR_DATA_DIR:./.data}") private val dataDir: String,
  // 실행 명령 — 예: `node e2e/run.mjs`. 비어 있으면 실행 버튼이 정직하게 미설정 안내를 돌려줘요.
  @Value("\${E2E_COMMAND:}") private val execCommand: String,
  @Value("\${server.port:8443}") private val serverPort: Int,
) {
  private val safeName = Regex("""^[a-zA-Z0-9._-]{1,120}$""")

  // ---- 대시보드에서 E2E 실행 — 설정된 명령을 서버가 스폰하고, 결과 업로드는 러너가
  // 기존 API(/api/e2e/runs)로 해요. 동시에 1개만, 15분 타임아웃. ----
  private val execRunning = AtomicBoolean(false)
  @Volatile private var execStartedAt: String? = null
  @Volatile private var execExit: Int? = null
  @Volatile private var execOutput: String = ""

  fun execStatus() = E2eExecStatusDto(
    running = execRunning.get(),
    configured = execCommand.isNotBlank(),
    startedAt = execStartedAt,
    exit = execExit,
    output = execOutput,
  )

  fun execute(): E2eExecStatusDto {
    val cmd = execCommand.takeIf { it.isNotBlank() }
      ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "실행 명령이 설정되지 않았어요 — 서버 환경 변수 E2E_COMMAND (예: node e2e/run.mjs) 를 설정하세요.")
    if (!execRunning.compareAndSet(false, true))
      throw ResponseStatusException(HttpStatus.CONFLICT, "이미 실행 중이에요 — 끝나면 다시 시도하세요.")
    execStartedAt = Instant.now().toString(); execExit = null; execOutput = ""
    Thread.startVirtualThread {
      try {
        val pb = ProcessBuilder("bash", "-lc", cmd)
        pb.environment()["BASE_URL"] = "http://127.0.0.1:$serverPort"
        pb.redirectErrorStream(true)
        val p = pb.start()
        val out = StringBuilder()
        val reader = Thread.startVirtualThread { p.inputStream.bufferedReader().forEachLine { out.appendLine(it) } }
        if (!p.waitFor(15, TimeUnit.MINUTES)) {
          p.destroyForcibly()
          execExit = -1
          execOutput = (out.toString().takeLast(4000)) + "\n[15분 타임아웃으로 중단]"
        } else {
          reader.join(2000)
          execExit = p.exitValue()
          execOutput = out.toString().takeLast(4000)
        }
      } catch (e: Exception) {
        execExit = -1
        execOutput = "실행 실패: ${e.message}"
      } finally {
        execRunning.set(false)
      }
    }
    return execStatus()
  }

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
