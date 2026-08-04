package dev.agentflow.domain

import dev.agentflow.dto.ProjectRepo
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import org.hibernate.annotations.ColumnDefault

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
  // workflow_run 웹훅의 연결 PR 번호(쉼표 구분) — 실패 실행을 담당 작업에 매칭할 때 써요.
  @Column(length = 200) var prNumbers: String? = null,
  // CI 실패 자동 회복이 이미 @claude 지시를 보냈는지 — 같은 실행에 중복 지시를 막아요.
  @ColumnDefault("false") var recoveryNotified: Boolean = false,
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
  // 자동 디스패치 — 켜져 있으면 현재 단계의 대기 중 ai 작업을 우선순위 순으로,
  // 동시 실행(dispatchLimit)만큼 자동 착수해요. 기본값은 기존 행 마이그레이션(ddl update)에도 쓰여요.
  @ColumnDefault("false") var autoDispatch: Boolean = false,
  @ColumnDefault("2") var dispatchLimit: Int = 2,
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

// 프로젝트별 작업(태스크) — 문서(PRD·IA)에서 에이전트(키 없으면 템플릿)가 분해하고,
// 관리자가 수정. 태스크별로 GitHub 이슈에 동기화할 수 있어요.
@Entity
class TaskEntity(
  @Id var id: String = "", // "<projectId>:<seq>"
  var projectId: String = "",
  var seq: Int = 0,
  var code: String = "", // T-001
  @Column(length = 512) var title: String = "",
  @Column(length = 4000) var detail: String = "",
  var domain: String = "",
  var phase: String = "", // 스키마/프론트엔드/백엔드/외부 키 발급/QA/릴리즈
  var repo: String = "", // 담당 저장소 이름
  @Column(name = "task_owner") var owner: String = "ai", // ai | human | auto
  var priority: String = "P2",
  var estimate: String = "M",
  var status: String = "대기", // 대기/진행 중/완료
  var issueNumber: Long? = null,
  @Column(length = 512) var issueUrl: String? = null,
  var lastIssueState: String? = null, // 마지막으로 본 이슈 상태 — 전이(닫힘/재오픈)에만 반응하기 위해
  var source: String = "template", // agent | template | human
  var updatedAt: String = "",
)

// 문서 리비전 — 생성·수정 때마다 그 시점 전문을 남겨요. 에이전트 초안이 보존되므로
// 사람 수정본과 비교(diff)해 에이전트 산출물을 평가할 수 있어요.
@Entity
class ProjectDocRevisionEntity(
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) var seq: Long = 0,
  var docId: String = "", // "<projectId>:<docType>"
  var docVersion: String = "",
  var source: String = "", // agent | template | human
  var author: String = "",
  @Column(length = 512) var note: String = "", // 에이전트 초안 생성 / 사람 수정 / 되돌림 ...
  @Column(length = 100000) var contentMd: String = "",
  var at: String = "",
)

// 태스크 활동 로그 — 생성·수정·이슈 연결·자동 완료 등 진행 이력을 시간순으로 남겨요.
@Entity
class TaskActivityEntity(
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) var seq: Long = 0,
  var taskId: String = "",
  var at: String = "",
  var kind: String = "", // 생성/수정/이슈 연결/자동 완료 ...
  @Column(length = 1000) var note: String = "",
)
