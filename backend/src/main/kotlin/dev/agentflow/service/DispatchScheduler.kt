package dev.agentflow.service

import dev.agentflow.domain.ProjectRepository
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

// 자동 디스패치 주기 실행 — 30초마다 켜져 있는 프로젝트의 빈 슬롯을 채워요.
// 웹훅으로 이슈가 닫혀 슬롯이 비면 다음 주기에 자동으로 다음 작업이 착수돼요.
// 실패(PAT 미연결 등)해도 조용히 넘어가고 다음 주기에 재시도해요.
@Component
class DispatchScheduler(
  private val taskService: TaskService,
  private val projects: ProjectRepository,
) {
  @Scheduled(fixedDelay = 30_000)
  fun tick() {
    projects.findAll().filter { it.autoDispatch }.forEach { p ->
      runCatching { taskService.runDispatch(p.id) }
    }
  }
}
