package dev.agentflow.web

import dev.agentflow.dto.OrgAssetCreateRequest
import dev.agentflow.dto.OrgAssetDto
import dev.agentflow.dto.OrgAssetUpdateRequest
import dev.agentflow.dto.OrgSyncResponse
import dev.agentflow.service.OrgAssetService
import org.springframework.web.bind.annotation.*

// 조직 공통 자산 API — 코드 규칙·에이전트 스킬을 프로젝트 밖에서 관리해요.
@RestController
@RequestMapping("/api/org")
class OrgController(private val org: OrgAssetService) {
  @GetMapping("/assets")
  fun list(): List<OrgAssetDto> = org.list()

  @PostMapping("/assets")
  fun create(@RequestBody req: OrgAssetCreateRequest): OrgAssetDto = org.create(req)

  @PatchMapping("/assets/{id}")
  fun update(@PathVariable id: Long, @RequestBody req: OrgAssetUpdateRequest): OrgAssetDto = org.update(id, req)

  @DeleteMapping("/assets/{id}")
  fun delete(@PathVariable id: Long): Map<String, Any> {
    org.delete(id)
    return mapOf("ok" to true)
  }

  // 모든 프로젝트 저장소에 일괄 동기화 — CLAUDE.md(조직+프로젝트 병합) + 스킬 파일들.
  @PostMapping("/sync-repos")
  fun syncAll(): OrgSyncResponse = org.syncAll()

  // 스킬만 동기화 — 기존 CLAUDE.md 를 건드리지 않고 .claude/skills/ 만 추가·갱신해요.
  @PostMapping("/sync-skills")
  fun syncSkills(): OrgSyncResponse = org.syncSkillsOnly()
}
