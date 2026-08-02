package dev.agentflow.service

import dev.agentflow.domain.ProjectEntity
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.dto.ProjectDto
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class ProjectService(private val projects: ProjectRepository) {
  @Transactional(readOnly = true)
  fun list(): List<ProjectDto> = projects.findAll().map { it.toDto() }

  fun create(dto: ProjectDto): ProjectDto {
    val e = ProjectEntity(dto.id, dto.name, dto.org, dto.desc, dto.stage, dto.progress, dto.repos, dto.tasks, dto.prs, dto.fails, dto.updated, dto.synced)
    return projects.save(e).toDto()
  }

  private fun ProjectEntity.toDto() = ProjectDto(id, name, org, desc, stage, progress, repos, tasks, prs, fails, updated, synced)
}
