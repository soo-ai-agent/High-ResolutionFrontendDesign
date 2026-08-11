package dev.agentflow.service

import dev.agentflow.dto.NotifyChannelResultDto
import dev.agentflow.dto.NotifyConfigRequest
import dev.agentflow.dto.NotifyStatusDto
import dev.agentflow.dto.NotifyTestDto
import org.springframework.http.MediaType
import org.springframework.mail.SimpleMailMessage
import org.springframework.mail.javamail.JavaMailSenderImpl
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient

// 외부 알림 채널 — 사람이 봐야 하는 순간(검토 대기 도착·리뷰 한도 초과·브리지 실패·CI 회복
// 오류)을 Slack(Incoming Webhook)과 이메일(SMTP)로 보내요. 루프를 막지 않게 비동기·베스트
// 에포트이고, 채널 미설정이면 조용히 건너뛰어요(설정 화면이 상태를 정직하게 보여줘요).
//
// 설정 위치의 원칙: 받는 곳(웹훅 URL·수신 주소)은 UI 에서 입력해 DB 에 영속(SettingService),
// 보내는 인프라(SMTP 서버·계정)는 서버 환경 변수 — SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/
// SMTP_FROM/SMTP_STARTTLS(false 로 끄기).
@Service
class NotificationService(private val settings: SettingService) {
  private val client: RestClient by lazy { RestClient.create() }

  private val smtpHost = System.getenv("SMTP_HOST")?.takeIf { it.isNotBlank() }
  private val smtpPort = System.getenv("SMTP_PORT")?.toIntOrNull() ?: 587
  private val smtpUser = System.getenv("SMTP_USER")?.takeIf { it.isNotBlank() }
  private val smtpPass = System.getenv("SMTP_PASS")
  private val smtpFrom = System.getenv("SMTP_FROM")?.takeIf { it.isNotBlank() } ?: smtpUser ?: "agent-flow@localhost"
  private val smtpStarttls = System.getenv("SMTP_STARTTLS") != "false"

  private fun slackWebhook(): String? = settings.get(SLACK_WEBHOOK)
  private fun emailTo(): String? = settings.get(EMAIL_TO)

  fun status() = NotifyStatusDto(
    slackConfigured = slackWebhook() != null,
    emailTo = emailTo(),
    smtpConfigured = smtpHost != null,
    emailReady = smtpHost != null && emailTo() != null,
  )

  fun configure(req: NotifyConfigRequest): NotifyStatusDto {
    // 빈 문자열은 '지우기' — 키가 요청에 있을 때만 반영해요.
    req.slackWebhook?.let { if (it.isBlank()) settings.remove(SLACK_WEBHOOK) else settings.put(SLACK_WEBHOOK, it.trim()) }
    req.emailTo?.let { if (it.isBlank()) settings.remove(EMAIL_TO) else settings.put(EMAIL_TO, it.trim()) }
    return status()
  }

  // 루프 이벤트 알림 — 비동기, 실패해도 루프에 영향 없음.
  fun notify(title: String, body: String, url: String? = null) {
    Thread.startVirtualThread {
      runCatching { sendSlack(title, body, url) }
      runCatching { sendEmail(title, body, url) }
    }
  }

  // 테스트 발송 — 동기 실행으로 채널별 성공/실패를 그대로 돌려줘요.
  fun test(): NotifyTestDto {
    val slack = if (slackWebhook() == null) NotifyChannelResultDto(false, "미설정")
    else runCatching { sendSlack("테스트 알림", "Agent Flow 알림 채널이 연결됐어요.", null) }
      .fold({ NotifyChannelResultDto(true, "발송 성공") }, { NotifyChannelResultDto(false, "실패: ${it.message}") })
    val email = if (smtpHost == null) NotifyChannelResultDto(false, "SMTP 미설정 (서버 환경 변수 SMTP_HOST)")
    else if (emailTo() == null) NotifyChannelResultDto(false, "받는 주소 미설정")
    else runCatching { sendEmail("테스트 알림", "Agent Flow 알림 채널이 연결됐어요.", null) }
      .fold({ NotifyChannelResultDto(true, "발송 성공") }, { NotifyChannelResultDto(false, "실패: ${it.message}") })
    return NotifyTestDto(slack, email)
  }

  private fun sendSlack(title: String, body: String, url: String?) {
    val hook = slackWebhook() ?: return
    val text = "*$title*\n$body" + (url?.let { "\n$it" } ?: "")
    client.post().uri(hook).contentType(MediaType.APPLICATION_JSON)
      .body(mapOf("text" to text)).retrieve().toBodilessEntity()
  }

  private fun sendEmail(title: String, body: String, url: String?) {
    val host = smtpHost ?: return
    val to = emailTo() ?: return
    val sender = JavaMailSenderImpl().apply {
      this.host = host
      this.port = smtpPort
      username = smtpUser
      password = smtpPass
      javaMailProperties["mail.smtp.auth"] = (smtpUser != null).toString()
      javaMailProperties["mail.smtp.starttls.enable"] = smtpStarttls.toString()
      javaMailProperties["mail.smtp.connectiontimeout"] = "10000"
      javaMailProperties["mail.smtp.timeout"] = "10000"
    }
    val msg = SimpleMailMessage().apply {
      from = smtpFrom
      setTo(to)
      subject = "[Agent Flow] $title"
      text = body + (url?.let { "\n\n$it" } ?: "")
    }
    sender.send(msg)
  }

  companion object {
    const val SLACK_WEBHOOK = "notify_slack_webhook"
    const val EMAIL_TO = "notify_email_to"
  }
}
