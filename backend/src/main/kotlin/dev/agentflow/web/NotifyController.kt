package dev.agentflow.web

import dev.agentflow.dto.NotifyConfigRequest
import dev.agentflow.dto.NotifyStatusDto
import dev.agentflow.dto.NotifyTestDto
import dev.agentflow.service.NotificationService
import org.springframework.web.bind.annotation.*

// 외부 알림 채널 설정 — 받는 곳(웹훅·주소)은 여기서 입력, SMTP 서버는 환경 변수.
@RestController
@RequestMapping("/api/notify")
class NotifyController(private val notify: NotificationService) {
  @GetMapping("/status")
  fun status(): NotifyStatusDto = notify.status()

  @PutMapping("/config")
  fun configure(@RequestBody req: NotifyConfigRequest): NotifyStatusDto = notify.configure(req)

  @PostMapping("/test")
  fun test(): NotifyTestDto = notify.test()
}
