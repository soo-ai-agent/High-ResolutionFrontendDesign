package dev.agentflow.domain

import org.springframework.data.jpa.repository.JpaRepository

interface IssueRepository : JpaRepository<IssueEntity, String> {
  fun findByRepo(repo: String): List<IssueEntity>
  fun findByRepoAndNumber(repo: String, number: Long): IssueEntity?
  fun findByNodeId(nodeId: String): IssueEntity?
}

interface PullRepository : JpaRepository<PullEntity, String> {
  fun findByRepo(repo: String): List<PullEntity>
  fun findByNodeId(nodeId: String): PullEntity?
}

interface RunRepository : JpaRepository<RunEntity, String> {
  fun findByRepo(repo: String): List<RunEntity>
}

interface BoardItemRepository : JpaRepository<BoardItemEntity, String>

interface RepoRepository : JpaRepository<RepoEntity, String>

interface EventRepository : JpaRepository<EventEntity, Long> {
  fun findTop200ByOrderBySeqDesc(): List<EventEntity>
  fun findByRepoOrderBySeqDesc(repo: String): List<EventEntity>
}

interface ProjectRepository : JpaRepository<ProjectEntity, String>

interface MetaRepository : JpaRepository<MetaEntity, String>
