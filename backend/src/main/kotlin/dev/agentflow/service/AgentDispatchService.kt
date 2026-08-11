package dev.agentflow.service

import org.springframework.stereotype.Service

// 에이전트 지시 디스패처 — 착수·피드백·리뷰·CI 회복의 모든 지시가 여길 지나요.
// 실행 모드(설정 agent_mode, 기본 github)에 따라:
//   github — 이슈/PR 에 @claude 멘션 코멘트 → claude.yml(GitHub Actions)이 실행
//   local  — 접수 코멘트(@claude 없음, Actions 오발동 방지) + 로컬 브리지 큐 → 서버 머신의 claude CLI 실행
@Service
class AgentDispatchService(
  private val gitHub: GitHubService,
  private val settings: SettingService,
  private val bridge: LocalBridgeService,
) {
  fun mode(): String = settings.get(SettingService.AGENT_MODE)?.takeIf { it == "local" } ?: "github"

  fun setMode(m: String): String {
    val v = if (m == "local") "local" else "github"
    settings.put(SettingService.AGENT_MODE, v)
    return v
  }

  // 반환값은 활동 이력에 남길 전달 방식 설명. github 모드의 실패(PAT 미연결 등)는
  // 기존 claudeComment 와 동일하게 예외로 올라가 호출자 처리(착수 실패 안내)를 유지해요.
  fun instruct(owner: String, repo: String, number: Long, prompt: String, taskCode: String? = null, taskId: String? = null): String {
    if (mode() != "local") {
      gitHub.claudeComment(owner, repo, number, prompt)
      return "@claude 멘션 코멘트"
    }
    runCatching { gitHub.comment(owner, repo, number, "🔧 로컬 브리지가 지시를 접수했어요 — 서버 머신에서 에이전트가 실행돼요.") }
    val waiting = bridge.enqueue(owner, repo, number, prompt, taskCode, taskId)
    return "로컬 브리지 큐 등록 (대기 $waiting)"
  }
}
