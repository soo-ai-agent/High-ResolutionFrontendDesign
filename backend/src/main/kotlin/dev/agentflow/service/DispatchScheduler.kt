package dev.agentflow.service

import dev.agentflow.domain.ProjectRepository
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

// 자동화 주기 실행(30초) — ① CI 실패 자동 회복: 모든 프로젝트의 실패 실행에 @claude 수정
// 지시(실행당 1회). ② 자동 디스패치: 켜져 있는 프로젝트의 빈 슬롯 채우기.
// 실패(PAT 미연결 등)해도 조용히 넘어가고 다음 주기에 재시도해요.
@Component
class DispatchScheduler(
  private val taskService: TaskService,
  private val ciRecovery: CiRecoveryService,
  private val projects: ProjectRepository,
) {
  @Scheduled(fixedDelay = 30_000)
  fun tick() {
    projects.findAll().forEach { p ->
      runCatching { ciRecovery.sweep(p.id) }
      if (p.autoDispatch) runCatching { taskService.runDispatch(p.id) }
    }
  }
}
