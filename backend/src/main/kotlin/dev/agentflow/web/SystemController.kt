package dev.agentflow.web

import dev.agentflow.config.AppProps
import dev.agentflow.dto.CapabilitiesDto
import dev.agentflow.service.AgentDispatchService
import dev.agentflow.service.GitHubService
import dev.agentflow.service.LocalBridgeService
import org.springframework.beans.factory.annotation.Value
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 서버 구성 상태 — 자동화 루프가 실제로 돌 수 있는 설정인지 한눈에 보여줘요.
// UI(설정 화면)가 조회해 "설정은 됐는데 동작 안 함"을 미리 드러내요.
@RestController
@RequestMapping("/api/system")
class SystemController(
  private val bridge: LocalBridgeService,
  private val dispatch: AgentDispatchService,
  private val gitHub: GitHubService,
  private val props: AppProps,
  @Value("\${E2E_COMMAND:}") private val e2eCommand: String,
) {
  @GetMapping("/capabilities")
  fun capabilities(): CapabilitiesDto = CapabilitiesDto(
    llm = when {
      !System.getenv("ANTHROPIC_API_KEY").isNullOrBlank() -> "anthropic"
      !System.getenv("OPENAI_API_KEY").isNullOrBlank() -> "openai"
      else -> "none"
    },
    webhookSecretSet = props.webhookSecret.isNotBlank(),
    githubConnected = gitHub.status().connected,
    agentMode = dispatch.mode(),
    bridgeCliAvailable = bridge.cliAvailable(),
    gitAvailable = bridge.gitAvailable(),
    e2eCommandSet = e2eCommand.isNotBlank(),
  )
}
