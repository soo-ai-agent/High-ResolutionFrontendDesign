package dev.agentflow.service

import dev.agentflow.domain.SettingEntity
import dev.agentflow.domain.SettingRepository
import org.springframework.stereotype.Service
import java.time.Instant

// 키-값 서버 설정 — PAT 영속화·에이전트 실행 모드 등. 값은 데이터 폴더 DB에 평문 저장돼요.
@Service
class SettingService(private val repo: SettingRepository) {
  fun get(key: String): String? = repo.findById(key).orElse(null)?.value?.takeIf { it.isNotBlank() }

  fun put(key: String, value: String) {
    repo.save(SettingEntity(key, value, Instant.now().toString()))
  }

  fun remove(key: String) {
    runCatching { repo.deleteById(key) }
  }

  companion object {
    const val GITHUB_TOKEN = "github_token"
    const val GITHUB_USER = "github_user"
    const val AGENT_MODE = "agent_mode" // github(기본) | local
  }
}
