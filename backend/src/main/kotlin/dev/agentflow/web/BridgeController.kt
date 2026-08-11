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

  // ---- 잡 제어 — 대기 취소·실행 중단·재시도·로그 ----
  @PostMapping("/jobs/{id}/cancel")
  fun cancel(@PathVariable id: Long): BridgeStatusDto {
    bridge.cancel(id)
    return bridge.status(dispatch.mode())
  }

  @PostMapping("/jobs/{id}/retry")
  fun retry(@PathVariable id: Long): BridgeStatusDto {
    bridge.retry(id)
    return bridge.status(dispatch.mode())
  }

  @GetMapping("/jobs/{id}/log", produces = ["text/plain;charset=UTF-8"])
  fun log(@PathVariable id: Long): String = bridge.jobLog(id)
}
