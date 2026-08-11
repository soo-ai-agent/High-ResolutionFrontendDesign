package dev.agentflow.service

import dev.agentflow.config.AppProps
import dev.agentflow.domain.TaskActivityEntity
import dev.agentflow.domain.TaskActivityRepository
import dev.agentflow.dto.BridgeJobDto
import dev.agentflow.dto.BridgeStatusDto
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.io.File
import java.time.Instant
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

// 로컬 브리지 — GitHub Actions 없이, 서버가 사는 머신에서 claude CLI 를 직접 실행하는 실행기.
// 순차 큐(동시 1) · 에이전트 20분 타임아웃. 결과는 브랜치 push + PR 보장 + 이슈 회신 코멘트 +
// 작업 활동 기록으로 남아요. 작업 브랜치는 claude/<작업코드> 로 고정 — 재실행(리뷰 수정·피드백)이
// 같은 브랜치에 이어져 PR 이 유지돼요.
@Service
class LocalBridgeService(
  private val props: AppProps,
  private val gitHub: GitHubService,
  private val activities: TaskActivityRepository,
  @Value("\${MIRROR_DATA_DIR:./.data}") private val dataDir: String,
) {
  class Job(
    val at: String,
    val owner: String,
    val repo: String,
    val number: Long,
    val prompt: String,
    val taskCode: String?,
    val taskId: String?,
  ) {
    @Volatile var status: String = "대기" // 대기 / 실행 중 / 완료 / 실패
    @Volatile var note: String = ""
    @Volatile var branch: String? = null
    @Volatile var prUrl: String? = null
  }

  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "local-bridge").apply { isDaemon = true } }
  private val jobs = CopyOnWriteArrayList<Job>()

  fun enqueue(owner: String, repo: String, number: Long, prompt: String, taskCode: String?, taskId: String?): Int {
    val job = Job(Instant.now().toString(), owner, repo, number, prompt, taskCode, taskId)
    jobs.add(0, job)
    while (jobs.size > 30) jobs.removeAt(jobs.size - 1)
    record(taskId, "브리지 접수", "로컬 브리지 큐 등록 — $owner/$repo#$number")
    executor.submit { run(job) }
    return jobs.count { it.status == "대기" }
  }

  fun status(mode: String) = BridgeStatusDto(
    mode = mode,
    queued = jobs.count { it.status == "대기" },
    running = jobs.any { it.status == "실행 중" },
    jobs = jobs.take(10).map { BridgeJobDto(it.at, "${it.owner}/${it.repo}", it.number, it.taskCode, it.status, it.note, it.branch, it.prUrl) },
  )

  private fun run(job: Job) {
    job.status = "실행 중"
    try {
      val ws = File(dataDir, "bridge/${job.owner}__${job.repo}")
      val cloneUrl = cloneUrl(job.owner, job.repo)
      val base = gitHub.defaultBranch(job.owner, job.repo)

      // 1) 작업 공간 준비 — 최초 클론, 이후엔 원격 갱신
      if (!File(ws, ".git").isDirectory) {
        ws.parentFile.mkdirs()
        if (!sh(ws.parentFile, 300, "git", "clone", cloneUrl, ws.name).ok) return fail(job, "클론 실패 — 토큰·주소를 확인하세요.")
      } else {
        sh(ws, 60, "git", "remote", "set-url", "origin", cloneUrl)
        if (!sh(ws, 300, "git", "fetch", "origin").ok) return fail(job, "fetch 실패")
      }
      sh(ws, 30, "git", "config", "user.name", "Claude (Agent Flow bridge)")
      sh(ws, 30, "git", "config", "user.email", "claude@anthropic.com")

      // 2) 작업 브랜치 — 원격에 있으면 이어서(리뷰 수정·피드백), 없으면 기본 브랜치에서 새로
      val branch = "claude/" + (job.taskCode?.lowercase() ?: "issue-${job.number}")
      job.branch = branch
      val hasRemote = sh(ws, 60, "git", "ls-remote", "--heads", "origin", branch).out.isNotBlank()
      val from = if (hasRemote) "origin/$branch" else "origin/$base"
      if (!sh(ws, 60, "git", "checkout", "-B", branch, from).ok) return fail(job, "브랜치 준비 실패 ($from)")

      // 3) 에이전트 실행 — 프롬프트는 파일로 전달(따옴표·개행 안전)
      val promptFile = File(ws, ".agentflow-prompt.txt").apply { writeText(job.prompt) }
      val cmd = props.bridgeCommand.ifBlank { DEFAULT_COMMAND }
      val r = shell(ws, 1200, cmd, mapOf("PROMPT_FILE" to promptFile.absolutePath))
      promptFile.delete()
      if (!r.ok) return fail(job, "에이전트 실행 실패 (exit ${r.exit}) — ${r.out.takeLast(400)}")

      // 4) 변경 반영 — 커밋·push 후 PR 보장([코드] 제목 → 어드민 자동 연결)
      if (sh(ws, 60, "git", "status", "--porcelain").out.isNotBlank()) {
        sh(ws, 60, "git", "add", "-A")
        sh(ws, 60, "git", "commit", "-m", (job.taskCode?.let { "[$it] " } ?: "") + "로컬 브리지 자동 변경")
      }
      val ahead = sh(ws, 60, "git", "rev-list", "--count", "$from..HEAD").out.trim().toIntOrNull() ?: 0
      if (ahead > 0) {
        if (!sh(ws, 300, "git", "push", "-u", "origin", branch).ok) return fail(job, "push 실패 — 토큰의 쓰기 권한을 확인하세요.")
        if (gitHub.openPullNumberByHead(job.owner, job.repo, branch) == null) {
          runCatching {
            gitHub.createPull(
              job.owner, job.repo,
              (job.taskCode?.let { "[$it] " } ?: "") + "로컬 브리지 자동 변경",
              branch, base,
              "로컬 브리지(Agent Flow)가 만든 PR 이에요. 머지는 사람이 결정해요.",
            )
          }.onSuccess { job.prUrl = it.html_url }
        }
      }

      // 5) 회신 — @claude 없이(Actions 오발동 방지) 실행 결과를 이슈/PR 에 남겨요.
      val summary = buildString {
        appendLine("🔧 로컬 브리지 실행 완료${job.taskCode?.let { " [$it]" } ?: ""}")
        appendLine(if (ahead > 0) "- 브랜치 `$branch` 에 커밋 $ahead 개 push" + (job.prUrl?.let { " · PR: $it" } ?: "") else "- 코드 변경 없음 — 분석/리뷰만 수행")
        appendLine()
        appendLine("```")
        appendLine(r.out.takeLast(1200))
        appendLine("```")
      }
      runCatching { gitHub.comment(job.owner, job.repo, job.number, summary) }

      job.status = "완료"
      job.note = if (ahead > 0) "커밋 $ahead 개 push ($branch)" else "변경 없음 — 분석/리뷰만"
      record(job.taskId, "브리지 완료", job.note + (job.prUrl?.let { " · PR $it" } ?: ""))
    } catch (e: Exception) {
      fail(job, "브리지 오류: ${e.message}")
    }
  }

  private fun fail(job: Job, note: String) {
    job.status = "실패"
    job.note = note
    record(job.taskId, "브리지 실패", note)
    runCatching { gitHub.comment(job.owner, job.repo, job.number, "🔧 로컬 브리지 실행 실패 — $note") }
  }

  // 클론 인증 — https 원격이면 토큰을 URL 에 넣어요(작업 공간 .git/config 에 남으니
  // 데이터 폴더 접근 권한 = 토큰 접근 권한이라는 PAT 영속화와 같은 전제). file:// 테스트는 그대로.
  private fun cloneUrl(owner: String, repo: String): String {
    val base = props.bridgeGitBase.trimEnd('/')
    val token = gitHub.cloneToken()
    return if (base.startsWith("http") && token != null) {
      "${base.substringBefore("://")}://x-access-token:$token@${base.substringAfter("://")}/$owner/$repo.git"
    } else "$base/$owner/$repo.git"
  }

  private class Res(val exit: Int, val out: String) { val ok get() = exit == 0 }

  private fun sh(dir: File, timeoutSec: Long, vararg cmd: String): Res = exec(ProcessBuilder(*cmd), dir, timeoutSec)

  private fun shell(dir: File, timeoutSec: Long, script: String, env: Map<String, String>): Res {
    val pb = ProcessBuilder("bash", "-lc", script)
    pb.environment().putAll(env)
    return exec(pb, dir, timeoutSec)
  }

  private fun exec(pb: ProcessBuilder, dir: File, timeoutSec: Long): Res {
    pb.directory(dir)
    pb.redirectErrorStream(true)
    return try {
      val p = pb.start()
      val out = StringBuilder()
      val reader = Thread.startVirtualThread { p.inputStream.bufferedReader().forEachLine { out.appendLine(it) } }
      if (!p.waitFor(timeoutSec, TimeUnit.SECONDS)) {
        p.destroyForcibly()
        Res(-1, out.toString() + "\n[${timeoutSec}s 타임아웃]")
      } else {
        reader.join(2000)
        Res(p.exitValue(), out.toString())
      }
    } catch (e: Exception) {
      Res(-1, "실행 불가: ${e.message}")
    }
  }

  private fun record(taskId: String?, kind: String, note: String) {
    if (taskId == null) return
    runCatching { activities.save(TaskActivityEntity(taskId = taskId, at = Instant.now().toString(), kind = kind, note = note.take(1000))) }
  }

  companion object {
    // 기본 실행 명령 — 서버 머신에 claude CLI 가 설치·로그인돼 있어야 해요(구독 로그인 그대로 과금).
    const val DEFAULT_COMMAND = """claude -p "$(cat "${'$'}PROMPT_FILE")" --permission-mode acceptEdits"""
  }
}
