package dev.agentflow.domain

import dev.agentflow.dto.ProjectRepo
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id

// GitHub 필드는 미러(RO), 어드민 확장(stage·priority·mapping·boardStatus)은 어드민 소유.
// 길이 지정으로 VARCHAR(255) 기본 절단을 피하고 H2/Postgres 공통 동작.

@Entity
class IssueEntity(
  @Id var id: String = "",                 // "repo#number"
  var repo: String = "",
  @Column(name = "num") var number: Long = 0,
  @Column(length = 1000) var title: String? = null,
  var state: String? = null,
  @Convert(converter = StringListConverter::class) @Column(length = 4000) var labels: List<String> = emptyList(),
  @Column(name = "author") var user: String? = null,
  @Column(length = 512) var htmlUrl: String? = null,
  var updatedAt: String? = null,
  var nodeId: String? = null,
  var stage: String? = null,
  var priority: String? = null,
  @Column(length = 8000) var mappingJson: String? = null,
  var boardStatus: String? = null,
  var boardUpdatedAt: String? = null,
)

@Entity
class PullEntity(
  @Id var id: String = "",                 // "repo#number"
  var repo: String = "",
  @Column(name = "num") var number: Long = 0,
  @Column(length = 1000) var title: String? = null,
  var state: String? = null,
  var merged: Boolean = false,
  var draft: Boolean = false,
  @Column(name = "author") var user: String? = null,
  @Column(length = 512) var htmlUrl: String? = null,
  var updatedAt: String? = null,
  var nodeId: String? = null,
  var boardStatus: String? = null,
  var boardUpdatedAt: String? = null,
)

@Entity
class RunEntity(
  @Id var id: String = "",                 // "repo#runId"
  var repo: String = "",
  @Column(name = "run_id") var runId: Long = 0,
  @Column(length = 512) var name: String? = null,
  var status: String? = null,
  var conclusion: String? = null,
  var headBranch: String? = null,
  @Column(length = 512) var htmlUrl: String? = null,
  var updatedAt: String? = null,
)

@Entity
class BoardItemEntity(
  @Id var contentNodeId: String = "",
  var contentType: String? = null,
  var projectNodeId: String? = null,
  var status: String? = null,
  var archived: Boolean = false,
  var action: String? = null,
  var updatedAt: String? = null,
)

@Entity
class RepoEntity(
  @Id var fullName: String = "",
  @Column(name = "is_private") var private: Boolean? = null,
  var defaultBranch: String? = null,
  var updatedAt: String? = null,
)

@Entity
class EventEntity(
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) var seq: Long = 0,
  var deliveryId: String? = null,
  @Column(name = "event_type") var event: String = "",
  var action: String? = null,
  var repo: String? = null,
  @Column(name = "at_iso") var at: String = "",
  var verified: Boolean = false,
  @Column(length = 2000) var summary: String = "",
)

@Entity
class ProjectEntity(
  @Id var id: String = "",
  @Column(length = 512) var name: String = "",
  var org: String = "",
  @Column(name = "description", length = 4000) var desc: String = "",
  var stage: String = "",
  var progress: Int = 0,
  @Convert(converter = ProjectRepoListConverter::class) @Column(length = 8000) var repos: List<ProjectRepo> = emptyList(),
  var tasks: Int = 0,
  var prs: Int = 0,
  var fails: Int = 0,
  var updated: String = "",
  var synced: Boolean = false,
)

// 단일 행 메타 — 미러 마지막 갱신 시각(summary.updatedAt).
@Entity
class MetaEntity(
  @Id var id: String = "meta",
  var updatedAt: String? = null,
)

// 프로젝트별 문서(PRD·IA 등) — 프로젝트 생성 시 에이전트(키 없으면 템플릿)가 초안을 만들고,
// 관리자가 화면에서 수정. source 로 초안 출처(agent/template/human)를 구분.
@Entity
class ProjectDocEntity(
  @Id var id: String = "", // "<projectId>:<docType>"
  var projectId: String = "",
  var docType: String = "prd",
  @Column(length = 512) var title: String = "",
  var client: String = "",
  var author: String = "",
  var docVersion: String = "v1.0",
  var createdDate: String = "",
  var updatedDate: String = "",
  var source: String = "template",
  @Column(length = 100000) var contentMd: String = "",
  var updatedAt: String = "",
)
