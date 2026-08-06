package dev.agentflow.service

import dev.agentflow.domain.OrgAssetEntity
import dev.agentflow.domain.OrgAssetRepository
import dev.agentflow.domain.ProjectDocRepository
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.dto.OrgAssetCreateRequest
import dev.agentflow.dto.OrgAssetDto
import dev.agentflow.dto.OrgAssetUpdateRequest
import dev.agentflow.dto.OrgSyncResponse
import dev.agentflow.dto.RuleSyncItemDto
import dev.agentflow.dto.RuleSyncResponse
import dev.agentflow.util.RepoCoords
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.time.Instant

// 조직 공통 자산 — 코드 규칙(1개)·에이전트 스킬(여러 개)을 프로젝트 밖에서 관리해요.
// 동기화 시 CLAUDE.md 는 [조직 규칙 + 프로젝트 규칙] 병합본으로, 스킬은
// .claude/skills/<이름>/SKILL.md 로 각 저장소에 푸시돼요 — 여러 프로젝트가 같은 규칙을 공유해요.
@Service
class OrgAssetService(
  private val assets: OrgAssetRepository,
  private val projects: ProjectRepository,
  private val docs: ProjectDocRepository,
  private val gitHub: GitHubService,
) {
  fun list(): List<OrgAssetDto> = assets.findAll().sortedBy { it.id }.map { it.toDto() }

  fun create(req: OrgAssetCreateRequest): OrgAssetDto {
    if (req.kind !in setOf("rules", "skill"))
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "kind 는 rules 또는 skill 이어야 해요.")
    if (req.kind == "rules" && assets.findAll().any { it.kind == "rules" })
      throw ResponseStatusException(HttpStatus.CONFLICT, "조직 공통 규칙은 이미 있어요 — 수정으로 관리하세요.")
    if (req.kind == "skill" && req.name.isBlank())
      throw ResponseStatusException(HttpStatus.BAD_REQUEST, "스킬 이름이 필요해요.")
    val e = assets.save(OrgAssetEntity(
      kind = req.kind,
      name = if (req.kind == "rules") "조직 공통 코드 규칙" else req.name.trim().take(200),
      contentMd = req.contentMd.ifBlank { if (req.kind == "rules") ORG_RULES_TEMPLATE else "" },
      updatedAt = Instant.now().toString(),
    ))
    return e.toDto()
  }

  fun update(id: Long, req: OrgAssetUpdateRequest): OrgAssetDto {
    val e = assets.findById(id).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "자산이 없어요.")
    req.name?.takeIf { it.isNotBlank() && e.kind == "skill" }?.let { e.name = it.trim().take(200) }
    req.contentMd?.let { e.contentMd = it }
    e.docVersion = bump(e.docVersion)
    e.updatedAt = Instant.now().toString()
    return assets.save(e).toDto()
  }

  fun delete(id: Long) {
    val e = assets.findById(id).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "자산이 없어요.")
    assets.delete(e)
  }

  // 프로젝트 하나의 저장소들로 동기화 — CLAUDE.md(병합 규칙) + 스킬 파일들.
  fun syncProject(projectId: String): RuleSyncResponse {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val merged = mergedRules(projectId)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "규칙이 없어요 — 조직 공통 규칙 또는 프로젝트 코드 규칙을 먼저 만드세요.")
    val skills = assets.findAll().filter { it.kind == "skill" }
    val results = project.repos.map { r ->
      val (owner, name) = RepoCoords.of(project.org, r)
      try {
        val url = gitHub.putFile(owner, name, "CLAUDE.md", merged.first, "docs: Agent Flow 규칙 동기화 (${merged.second})")
        skills.forEach { s ->
          gitHub.putFile(owner, name, ".claude/skills/${slug(s)}/SKILL.md", withFrontmatter(s), "docs: Agent Flow 스킬 동기화 — ${s.name}")
        }
        RuleSyncItemDto("$owner/$name", true, url, if (skills.isEmpty()) null else "스킬 ${skills.size}개 포함")
      } catch (e: ResponseStatusException) {
        RuleSyncItemDto("$owner/$name", false, null, e.reason ?: e.message)
      }
    }
    return RuleSyncResponse(results, merged.second)
  }

  // 모든 프로젝트 일괄 동기화 — 조직 화면의 "전체 동기화" 버튼.
  fun syncAll(): OrgSyncResponse {
    val skillCount = assets.findAll().count { it.kind == "skill" }
    val results = projects.findAll().flatMap { p ->
      runCatching { syncProject(p.id).results }
        .getOrElse { e -> listOf(RuleSyncItemDto(p.name, false, null, (e as? ResponseStatusException)?.reason ?: e.message)) }
    }
    return OrgSyncResponse(results, skillCount)
  }

  // 병합 규칙: 조직 공통 규칙이 앞, 프로젝트 규칙이 뒤 — 프로젝트가 세부를 덧붙이는 구조.
  private fun mergedRules(projectId: String): Pair<String, String>? {
    val org = assets.findAll().firstOrNull { it.kind == "rules" }
    val proj = docs.findByProjectIdAndDocType(projectId, "rules")
    if (org == null && proj == null) return null
    val parts = mutableListOf<String>()
    org?.let { parts += "<!-- Agent Flow · 조직 공통 규칙 ${it.docVersion} -->\n\n" + it.contentMd.trim() }
    proj?.let { parts += "<!-- Agent Flow · 프로젝트 규칙 ${it.docVersion} -->\n\n" + it.contentMd.trim() }
    val version = listOfNotNull(org?.let { "조직 ${it.docVersion}" }, proj?.let { "프로젝트 ${it.docVersion}" }).joinToString(" + ")
    return parts.joinToString("\n\n---\n\n") to version
  }

  private fun slug(s: OrgAssetEntity): String =
    s.name.lowercase().replace(Regex("[^a-z0-9가-힣]+"), "-").trim('-').ifBlank { "skill-${s.id}" }

  // Claude Code 스킬 형식 — frontmatter 가 없으면 이름·설명을 붙여줘요.
  private fun withFrontmatter(s: OrgAssetEntity): String =
    if (s.contentMd.trimStart().startsWith("---")) s.contentMd
    else "---\nname: ${s.name}\ndescription: ${s.name}\n---\n\n" + s.contentMd

  private fun bump(v: String): String {
    val m = Regex("""v(\d+)\.(\d+)""").matchEntire(v.trim()) ?: return "v1.1"
    return "v${m.groupValues[1]}.${m.groupValues[2].toInt() + 1}"
  }

  private fun OrgAssetEntity.toDto() = OrgAssetDto(id, kind, name, contentMd, docVersion, updatedAt)

  companion object {
    private val ORG_RULES_TEMPLATE = """
# 조직 공통 코드 작성 규칙

모든 프로젝트에 공통 적용되는 규칙이에요. 프로젝트별 규칙은 이 아래에 병합돼요.

## 1. 공통 원칙
- 실제로 동작하는 가장 단순한 해법을 먼저 선택한다 (YAGNI).
- 기존 코드의 패턴·네이밍·구조를 따르고, 새로운 스타일을 임의로 도입하지 않는다.
- 요구된 범위만 구현한다 — 범위 밖 리팩터링은 별도 작업으로 제안한다.

## 2. 커밋·PR 규칙
- PR 제목은 반드시 `[T-00x]` 작업 코드로 시작한다.
- 커밋 메시지는 "무엇을·왜"를 한 줄로 요약한다.
- 구현이 끝나면 PR 로 연결 이슈를 닫는다.

## 3. 테스트·검증
- 빌드·린트·기존 테스트를 통과시킨 뒤 push 한다.
- 동작 변경에는 검증 방법을 PR 설명에 남긴다.

## 4. 금지 사항
- 시크릿·토큰·키를 코드나 로그에 남기지 않는다.
- CI 를 통과시키기 위한 테스트 비활성화·강제 머지를 하지 않는다.
- 대규모 포맷팅 변경을 기능 변경과 섞지 않는다.
    """.trimIndent()
  }
}
