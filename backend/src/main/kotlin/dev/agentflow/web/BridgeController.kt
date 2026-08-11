package dev.agentflow.web

import dev.agentflow.dto.BridgeConfigRequest
import dev.agentflow.dto.BridgeStatusDto
import dev.agentflow.service.AgentDispatchService
import dev.agentflow.service.LocalBridgeService
import org.springframework.web.bind.annotation.*

// 에이전트 실행 모드(github|local) + 로컬 브리지 큐 상태 API — 설정 화면이 써요.
@RestController
@RequestMapping("/api/bridge")
class BridgeController(
  private val dispatch: AgentDispatchService,
  private val bridge: LocalBridgeService,
) {
  @GetMapping("/status")
  fun status(): BridgeStatusDto = bridge.status(dispatch.mode())

  @PutMapping("/config")
  fun config(@RequestBody req: BridgeConfigRequest): BridgeStatusDto {
    req.mode?.let { dispatch.setMode(it) }
    return bridge.status(dispatch.mode())
  }
}
