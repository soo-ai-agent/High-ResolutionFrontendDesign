package dev.agentflow.service

import dev.agentflow.domain.IssueRepository
import dev.agentflow.domain.ProjectEntity
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.domain.PullRepository
import dev.agentflow.domain.RunRepository
import dev.agentflow.domain.TaskRepository
import dev.agentflow.dto.ProjectDto
import dev.agentflow.util.RepoCoords
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

// 프로젝트 카드 수치는 저장된 스냅샷이 아니라 실데이터에서 파생해요 —
// 진행률·단계는 작업(Task) 상태에서, 열린 PR·실패 실행·동기화 여부는 미러(웹훅 DB)에서.
@Service
@Transactional
class ProjectService(
  private val projects: ProjectRepository,
  private val taskRepo: TaskRepository,
  private val issueRepo: IssueRepository,
  private val pullRepo: PullRepository,
  private val runRepo: RunRepository,
) {
  @Transactional(readOnly = true)
  fun list(): List<ProjectDto> = projects.findAll().map { it.toDto() }

  fun create(dto: ProjectDto): ProjectDto {
    val e = ProjectEntity(dto.id, dto.name, dto.org, dto.desc, dto.stage, dto.progress, dto.repos, dto.tasks, dto.prs, dto.fails, dto.updated, dto.synced, dto.autoDispatch, dto.dispatchLimit)
    return projects.save(e).toDto()
  }

  private fun ProjectEntity.toDto(): ProjectDto {
    val ts = taskRepo.findByProjectIdOrderBySeq(id)
    val total = ts.size
    val done = ts.count { it.status == "완료" }
    val derivedProgress = if (total > 0) done * 100 / total else progress

    val fullRepos = repos.map { r -> RepoCoords.of(org, r).let { (o, n) -> "$o/$n" } }
    val openPrs = fullRepos.sumOf { f -> pullRepo.findByRepo(f).count { it.state == "open" } }
    val failRuns = fullRepos.sumOf { f -> runRepo.findByRepo(f).count { it.conclusion == "failure" } }
    val mirrored = fullRepos.any { f ->
      issueRepo.findByRepo(f).isNotEmpty() || pullRepo.findByRepo(f).isNotEmpty() || runRepo.findByRepo(f).isNotEmpty()
    }

    val derivedStage = when {
      total == 0 -> stage.ifBlank { "계획" }
      done == total -> "완료"
      ts.any { it.status == "검토 대기" } -> "검토"
      ts.any { it.status == "진행 중" } -> "개발"
      else -> stage.ifBlank { "계획" }
    }
    val derivedUpdated = ts.mapNotNull { runCatching { Instant.parse(it.updatedAt) }.getOrNull() }
      .maxOrNull()?.let(::relative) ?: updated

    return ProjectDto(id, name, org, desc, derivedStage, derivedProgress, repos, total - done, openPrs, failRuns, derivedUpdated, synced || mirrored, autoDispatch, dispatchLimit, boardAutoStart)
  }

  private fun relative(at: Instant): String {
    val d = Duration.between(at, Instant.now())
    return when {
      d.toMinutes() < 1 -> "방금"
      d.toHours() < 1 -> "${d.toMinutes()}분 전"
      d.toDays() < 1 -> "${d.toHours()}시간 전"
      else -> "${d.toDays()}일 전"
    }
  }
}
