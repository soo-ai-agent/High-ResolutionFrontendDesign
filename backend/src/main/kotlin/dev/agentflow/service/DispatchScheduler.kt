package dev.agentflow.service

import dev.agentflow.domain.ProjectRepository
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

// 자동화 주기 실행(30초) — ① 상태 동기화(reconcile): 모든 프로젝트에서 이슈 전이(닫힘→검토
// 대기 등)를 반영해요. 과거엔 UI 조회의 부수효과로만 돌아서 화면을 안 열면 상태 기계가
// 멈췄는데, 스케줄러가 돌면서 조회와 무관하게 전이돼요. ② CI 실패 자동 회복(끈 프로젝트
// 제외, 실행당 1회). ③ 자동 디스패치: 켜져 있는 프로젝트의 빈 슬롯 채우기.
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
      runCatching { taskService.reconcileSweep(p.id) }
      if (p.ciRecovery) runCatching { ciRecovery.sweep(p.id) }
      if (p.autoDispatch) runCatching { taskService.runDispatch(p.id) }
    }
  }
}
