package dev.agentflow.config

import dev.agentflow.dto.GHUser
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.stereotype.Component
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@Component
@ConfigurationProperties(prefix = "agentflow")
class AppProps {
  var githubApiBase: String = "https://api.github.com"
  var webhookSecret: String = ""

  // 로컬 브리지 — 클론 원격 베이스(테스트에선 file:// 경로로 바꿔요)와 에이전트 실행 명령.
  // 명령이 비어 있으면 LocalBridgeService.DEFAULT_COMMAND(claude CLI 헤드리스)를 써요.
  var bridgeGitBase: String = "https://github.com"
  var bridgeCommand: String = ""
}

// PAT 런타임 캐시 (단일 사용자). 영속화는 SettingService(데이터 폴더 DB)가 담당 —
// GitHubService 가 연결 시 저장하고 부팅 시 복원해요.
@Component
class GitHubTokenStore {
  @Volatile
  var token: String? = null

  @Volatile
  var user: GHUser? = null

  fun clear() {
    token = null
    user = null
  }
}

@Component
class HmacVerifier {
  // 결과: true(유효) / false(불일치) / null(시크릿 미설정 → 개발용, 검증 생략)
  fun verify(raw: ByteArray, signature: String?, secret: String?): Boolean? {
    if (secret.isNullOrEmpty()) return null
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
    val digest = mac.doFinal(raw)
    val expected = "sha256=" + digest.joinToString("") { "%02x".format(it) }
    val a = expected.toByteArray(Charsets.UTF_8)
    val b = (signature ?: "").toByteArray(Charsets.UTF_8)
    if (a.size != b.size) return false
    return MessageDigest.isEqual(a, b) // 상수시간 비교
  }
}
