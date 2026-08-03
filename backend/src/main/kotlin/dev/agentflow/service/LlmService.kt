package dev.agentflow.service

import org.springframework.stereotype.Service

// 에이전트 LLM 파사드 — Claude(ANTHROPIC_API_KEY) 우선, 실패·미설정이면
// OpenAI(OPENAI_API_KEY) 폴백. 둘 다 없거나 실패하면 null(호출부가 템플릿 폴백).
@Service
class LlmService(
  private val claude: ClaudeClient,
  private val openAi: OpenAiClient,
) {
  val enabled: Boolean get() = claude.enabled || openAi.enabled

  fun complete(system: String, user: String, maxTokens: Int = 16000): String? =
    claude.complete(system, user, maxTokens) ?: openAi.complete(system, user)
}
