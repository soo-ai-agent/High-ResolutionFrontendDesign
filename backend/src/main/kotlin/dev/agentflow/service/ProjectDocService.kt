package dev.agentflow.service

import dev.agentflow.domain.ProjectDocEntity
import dev.agentflow.domain.ProjectDocRepository
import dev.agentflow.domain.ProjectEntity
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.dto.DocUpdateRequest
import dev.agentflow.dto.ProjectDocDto
import dev.agentflow.dto.ProjectRepo
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.LocalDate

// 프로젝트별 문서(PRD·IA). Claude 호출이 길 수 있어 클래스 레벨 트랜잭션을 걸지 않고
// 저장소 호출 단위 트랜잭션만 쓴다(HTTP 동안 커넥션을 잡지 않기 위해).
@Service
class ProjectDocService(
  private val docs: ProjectDocRepository,
  private val projects: ProjectRepository,
  private val claude: ClaudeClient,
  private val gitHub: GitHubService,
) {
  // 문서 타입 레지스트리 — 새 문서 종류는 여기에 spec 하나 추가하면 끝.
  private data class DocSpec(
    val defaultAuthor: String,
    val system: String,
    val template: (ProjectEntity) -> String,
  )

  private val specs: Map<String, DocSpec> = mapOf(
    "prd" to DocSpec("Planner Agent", PRD_SYSTEM, ::prdTemplate),
    "ia" to DocSpec("Design Agent", IA_SYSTEM, ::iaTemplate),
  )

  fun types(): Set<String> = specs.keys

  fun get(projectId: String, docType: String): ProjectDocDto? {
    requireType(docType)
    return docs.findByProjectIdAndDocType(projectId, docType)?.toDto()
  }

  // 프로젝트 데이터로 초안 생성. 이미 있으면 내용을 새 초안으로 갈고 버전을 올린다.
  fun generate(projectId: String, docType: String): ProjectDocDto {
    val spec = requireType(docType)
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val existing = docs.findByProjectIdAndDocType(projectId, docType)
    // 저장소 코드 수집(URL 또는 org/이름) — 에이전트가 실제 코드를 반영하게 프롬프트에 첨부.
    val code = runCatching { collectCodeContext(project) }.getOrNull()
    val brief = projectBrief(project) + (code?.let { "\n\n[저장소 코드 분석 자료 — 실제 저장소에서 수집됨]\n$it" } ?: "")
    val content = claude.complete(spec.system, brief, maxTokens = 16000)
    val today = LocalDate.now().toString()
    val e = existing ?: ProjectDocEntity(id = "$projectId:$docType", projectId = projectId, docType = docType, createdDate = today)
    e.title = project.name
    e.client = e.client.ifBlank { "내부" }
    e.author = if (content != null) spec.defaultAuthor else "템플릿 초안"
    e.docVersion = if (existing == null) "v1.0" else bump(existing.docVersion)
    e.updatedDate = today
    e.source = if (content != null) "agent" else "template"
    e.contentMd = content ?: (spec.template(project) + codeAppendix(code))
    e.updatedAt = Instant.now().toString()
    return docs.save(e).toDto()
  }

  // 프로젝트 생성 훅 — 모든 문서 타입 초안을 순서대로 생성(한 타입 실패해도 나머지는 계속).
  fun generateAll(projectId: String) {
    specs.keys.forEach { runCatching { generate(projectId, it) } }
  }

  // 관리자 수정 — 넘어온 필드만 반영, 버전 minor 증가, 출처는 human 으로.
  fun update(projectId: String, docType: String, req: DocUpdateRequest): ProjectDocDto {
    requireType(docType)
    val e = docs.findByProjectIdAndDocType(projectId, docType)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "문서가 아직 없어요. 먼저 생성하세요.")
    req.title?.takeIf { it.isNotBlank() }?.let { e.title = it }
    req.client?.let { e.client = it }
    req.author?.let { e.author = it }
    req.contentMd?.let { e.contentMd = it }
    e.docVersion = bump(e.docVersion)
    e.updatedDate = LocalDate.now().toString()
    e.source = "human"
    e.updatedAt = Instant.now().toString()
    return docs.save(e).toDto()
  }

  private fun requireType(docType: String): DocSpec =
    specs[docType] ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "지원하지 않는 문서 타입: $docType")

  private fun bump(v: String): String {
    val m = Regex("""v(\d+)\.(\d+)""").matchEntire(v.trim()) ?: return "v1.1"
    return "v${m.groupValues[1]}.${m.groupValues[2].toInt() + 1}"
  }

  private fun projectBrief(p: ProjectEntity) = buildString {
    appendLine("프로젝트명: ${p.name}")
    appendLine("소속: ${p.org}")
    appendLine("설명: ${p.desc}")
    appendLine("단계: ${p.stage}")
    appendLine("저장소:")
    p.repos.forEach { appendLine("- ${coordsOf(p, it).let { (o, n) -> "$o/$n" }} (${it.purpose})") }
  }

  // 저장소 좌표 — URL 이 있으면 URL 의 owner/이름, 없으면 프로젝트 org/이름.
  private fun coordsOf(p: ProjectEntity, r: ProjectRepo): Pair<String, String> {
    val m = Regex("""github\.com[:/]+([\w.-]+)/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$""").find(r.url)
    return if (m != null) m.groupValues[1] to m.groupValues[2] else p.org to r.name
  }

  // 실제 저장소에서 메타·파일 구조·매니페스트·README 를 수집해 분석 자료로 만든다.
  // 접근 불가(비공개+토큰 없음, 존재하지 않는 org 등)한 저장소는 조용히 건너뛰어요.
  private fun collectCodeContext(p: ProjectEntity): String? {
    val parts = p.repos.take(3).mapNotNull { r ->
      val (owner, name) = coordsOf(p, r)
      val meta = gitHub.repoMeta(owner, name) ?: return@mapNotNull null
      val branch = meta.path("default_branch").asText("main")
      val desc = meta.path("description").asText("")
      val lang = meta.path("language").asText("")
      val paths = gitHub.treePaths(owner, name, branch)
        .filterNot { it.contains("node_modules/") || it.startsWith(".git") }
      val manifestName = listOf(
        "package.json", "build.gradle.kts", "build.gradle", "pom.xml",
        "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml",
      ).firstOrNull { mf -> paths.any { it == mf } }
      val manifest = manifestName?.let { gitHub.fileText(owner, name, it)?.take(2000) }
      val readme = gitHub.readme(owner, name)?.take(4000)
      buildString {
        appendLine("### $owner/$name (${r.purpose})")
        if (desc.isNotBlank()) appendLine("- 설명: $desc")
        appendLine("- 주 언어: ${lang.ifBlank { "미상" }} · 기본 브랜치: $branch · 파일 ${paths.size}개")
        if (paths.isNotEmpty()) {
          appendLine("- 파일 구조(일부):")
          appendLine("```")
          paths.take(60).forEach { appendLine(it) }
          appendLine("```")
        }
        if (manifest != null) {
          appendLine("- $manifestName:")
          appendLine("```")
          appendLine(manifest)
          appendLine("```")
        }
        if (readme != null) {
          appendLine("- README 발췌:")
          appendLine("```")
          appendLine(readme)
          appendLine("```")
        }
      }
    }
    return parts.takeIf { it.isNotEmpty() }?.joinToString("\n\n")
  }

  // 템플릿 폴백일 때 수집 자료를 문서 끝에 한 섹션으로 붙인다(에이전트 키가 있으면 본문 전체에 반영됨).
  private fun codeAppendix(code: String?): String =
    if (code == null) "" else "\n\n## 저장소 분석 자료 (자동 수집)\n" +
      "서버가 GitHub API 로 실제 저장소에서 수집한 자료예요. ANTHROPIC_API_KEY 를 연결하면 에이전트가 이 자료를 반영해 문서 전체를 다시 작성할 수 있어요.\n\n" + code

  private fun ProjectDocEntity.toDto() =
    ProjectDocDto(projectId, docType, title, client, author, docVersion, createdDate, updatedDate, source, contentMd, updatedAt)

  companion object {
    private val PRD_SYSTEM = """
      당신은 시니어 프로덕트 매니저입니다. 주어진 프로젝트 정보로 한국어 PRD 초안을 마크다운으로 작성하세요.
      구조: 1. 배경 및 문제 정의(서비스 구성 표 포함) / 2. 목표 / 3. 비목표 / 4. 기술 스펙 요약(핵심 기술 스택 표, 도메인별 구현 방향) /
      5. 사용자 유형(표) / 6. 미결 사항(의사결정·외부 계약 체크) / 7. 핵심 플로우 / 8. 화면 명세(IA 트리, SCR 목록 표, 화면 흐름도, 공통 상태 처리 부록).
      각 대주제는 반드시 `## ` 제목으로 시작하세요(화면에서 주제별로 쪼개 편집해요).
      저장소 구성(purpose)을 기술 스택·도메인 방향에 반영하고, 확정할 수 없는 것은 6. 미결 사항에 질문으로 남기세요.
      [저장소 코드 분석 자료]가 주어지면 추측하지 말고 그 자료(실제 파일 구조·매니페스트·README)를 근거로
      기술 스택·도메인·핵심 플로우를 작성하고, 자료와 입력 설명이 다르면 미결 사항에 그 차이를 기록하세요.
      문서 본문만 출력하고 머리말·꼬리말은 붙이지 마세요.
    """.trimIndent()

    private val IA_SYSTEM = """
      당신은 시니어 프로덕트 디자이너입니다. 주어진 프로젝트 정보로 한국어 IA·화면설계 문서를 마크다운으로 작성하세요.
      구조: 1. 화면 구조 (IA) — 코드블록 트리 / 2. SCR 목록 — 표(SCR·라우트·화면·권한) / 3. 화면 흐름도 — 코드블록 /
      4. 화면별 상세 명세 — SCR 마다 `### ` 소제목으로 목적·UI 구성요소 표·주요 상호작용(Given-When-Then 시나리오) /
      5. 디자인 토큰·컴포넌트 — 색상·타이포·간격 표 / 6. 공통 상태 처리 — Loading·Error·Empty·권한 가드.
      각 대주제는 반드시 `## ` 제목으로 시작하세요(화면에서 주제별로 쪼개 편집해요).
      저장소 구성(purpose)에서 프론트엔드 저장소를 화면 구현 대상으로 삼고, 확정할 수 없는 것은 명세에 질문으로 남기세요.
      [저장소 코드 분석 자료]가 주어지면 추측하지 말고 실제 파일 구조(라우트·화면 파일)를 근거로 IA 트리와 SCR 목록을
      구성하고, 기존 화면이 확인되면 신규 제안과 구분해 표기하세요.
      문서 본문만 출력하고 머리말·꼬리말은 붙이지 마세요.
    """.trimIndent()
  }

  // ===== 키가 없을 때의 결정적 초안 =====

  private fun prdTemplate(p: ProjectEntity): String {
    val repoRows = p.repos.joinToString("\n") { "| ${p.org}/${it.name} | ${it.purpose} | main 브랜치 기준 개발 |" }
    val stackRows = p.repos.joinToString("\n") { "| ${it.purpose} | ${it.name} | 프로젝트 표준 스택 적용 |" }
    return """
# PRD: ${p.name}

## 1. 배경 및 문제 정의
${p.desc.ifBlank { "이 프로젝트의 배경과 해결하려는 문제를 정의합니다." }}

이 문서는 프로젝트 생성 시 자동 생성된 초안입니다. 관리자가 검토·수정해 확정하세요.

### 서비스 구성 및 지원 범위
| 저장소 | 역할 | 범위 |
| --- | --- | --- |
$repoRows

## 2. 목표
- ${p.name}의 핵심 사용자 흐름을 한 화면에서 처리한다.
- 산출물(문서·코드)의 원천을 저장소에 남긴다.
- 사람이 해야 하는 일(외부 키 발급·배포 승인)을 휴먼태스크로 분리한다.

## 3. 비목표
- 기존 도구(GitHub 등)를 대체하지 않는다 — 원천 데이터는 저장소가 소유.
- 자체 인증·권한 체계를 새로 만들지 않는다.
- 이번 범위에 없는 기능은 미결 사항에 기록 후 다음 버전으로 넘긴다(YAGNI).

## 4. 기술 스펙 요약
### 4-1. 핵심 기술 스택
| 레이어 | 선택 | 이유 |
| --- | --- | --- |
$stackRows

### 4-2. 도메인별 구현 방향
- 저장소별 역할(purpose)에 맞춰 경계를 나누고, 공용 계약(API 스키마)은 문서로 관리한다.
- 상태 파생 데이터는 이벤트에서 계산하고, 관리 데이터만 어드민이 소유한다.

## 5. 사용자 유형
| 유형 | 권한 | 하는 일 |
| --- | --- | --- |
| 🔒 로그인 | 기본 | 현황·상세 조회 |
| 👤 담당 | 프로젝트 배정 | 우선순위·추정·착수·키 등록 |
| 🔧 관리자 | 조직 | 운영 설정·PRD 확정 |

## 6. 미결 사항
### 6-1. 의사결정 미결 사항
- 핵심 사용자 흐름의 우선순위 (→ 관리자 확인 필요)
- 저장소 간 API 계약의 원천 위치

### 6-2. 외부 계약·계정 체크
| 항목 | 담당 | 상태 |
| --- | --- | --- |
| GitHub 연동(PAT·웹훅) | 관리자 | 필요 |
| 외부 API 키 | 담당 | 휴먼태스크로 관리 |

## 7. 핵심 플로우
1. 프로젝트 생성 → PRD·IA 초안 자동 생성 → 관리자 검토·수정.
2. 작업 분해 → 이슈 생성 → 착수(@claude) → PR 머지 시 완료 파생.
3. 사람 몫(외부 키·배포 승인)은 휴먼태스크로 분리되어 병렬 진행.

## 8. 화면 명세
화면 구조·SCR 목록·흐름도·화면별 상세는 IA·화면설계 문서에서 관리해요.
여기에는 요구사항 관점의 핵심 화면만 요약합니다.

| SCR | 화면 | 핵심 요구사항 |
| --- | --- | --- |
| SCR-101 | 프로젝트 현황 | 프로젝트 카드·요약 지표 |
| SCR-201 | 프로젝트 상세 | 진행 단계·산출물 확인 |
| ADM-001 | 운영 설정 | 연동·권한 관리 |
    """.trimIndent()
  }

  private fun iaTemplate(p: ProjectEntity): String {
    val fe = p.repos.firstOrNull { it.purpose == "프론트엔드" }?.name ?: p.repos.firstOrNull()?.name ?: "web"
    return """
# IA·화면설계: ${p.name}

## 1. 화면 구조 (IA)
프론트엔드 저장소 `${p.org}/$fe` 가 구현 대상입니다. 이 문서는 자동 생성된 초안이에요 — 관리자가 수정해 확정하세요.

```
[${p.name}]
├─ 공통/진입
│   ├─ SCR-001  /login          로그인       (공개)
│   └─ SCR-101  /projects       프로젝트 현황 (🔒)
├─ 프로젝트
│   ├─ SCR-201  /projects/:id   상세 · 진행 단계 (🔒/👤)
│   └─ SCR-202  /projects/:id/build  빌드 보드 (🔒/👤)
└─ 플랫폼 관리
    └─ ADM-001  /admin/settings 운영 설정    (🔧)
```

## 2. SCR 목록
| SCR | 라우트 | 화면 | 권한 |
| --- | --- | --- | --- |
| SCR-001 | /login | 로그인 | 공개 |
| SCR-101 | /projects | 프로젝트 현황 | 🔒 |
| SCR-201 | /projects/:id | 프로젝트 상세 | 🔒 / 👤 |
| SCR-202 | /projects/:id/build | 빌드 보드 | 🔒 / 👤 |
| ADM-001 | /admin/settings | 운영 설정 | 🔧 |

## 3. 화면 흐름도
```
SCR-001(로그인) —[인증 성공]→ SCR-101(프로젝트 현황)
SCR-101(프로젝트 현황) —[카드 클릭]→ SCR-201(프로젝트 상세)
SCR-201(프로젝트 상세) —[빌드 탭]→ SCR-202(빌드 보드)
SCR-202(빌드 보드) —[태스크 클릭]→ 태스크 상세(패널)
```

## 4. 화면별 상세 명세
### SCR-101 프로젝트 현황
**목적**: 진행 중인 프로젝트를 한눈에 보고 상세로 진입한다.

| UI 구성요소 | 설명 |
| --- | --- |
| 요약 카드 | 전체·진행 중·실패 지표 |
| 프로젝트 카드 그리드 | 이름·단계·진행률·저장소 |
| 검색·필터 | 이름 검색, 단계 필터 |

**주요 상호작용 (GWT)**
- Given 로그인한 사용자가, When 프로젝트 카드를 클릭하면, Then 해당 프로젝트 상세(SCR-201)로 이동한다.
- Given 프로젝트가 없을 때, When 화면에 진입하면, Then 빈 상태와 "프로젝트 추가" CTA 를 보여준다.

### SCR-201 프로젝트 상세
**목적**: 단계별 진행 상황과 산출물(PRD·IA)을 확인·수정한다.

| UI 구성요소 | 설명 |
| --- | --- |
| 단계 스테퍼 | 기획→설계→빌드→운영 |
| 문서 탭 | PRD · IA·화면설계 |
| 활동 로그 | 최근 이벤트 |

**주요 상호작용 (GWT)**
- Given 담당자가, When 문서 섹션의 수정을 누르면, Then 해당 섹션만 편집 모드로 전환된다.

## 5. 디자인 토큰·컴포넌트
| 토큰 | 값 | 용도 |
| --- | --- | --- |
| color/primary | #4568F5 | 주요 액션·활성 상태 |
| color/surface | #FFFFFF | 카드 배경 |
| radius/card | 16px | 카드 모서리 |
| spacing/base | 4px 그리드 | 여백 단위 |

공용 컴포넌트: Button · Card · Badge · Table · EmptyState · Modal — 신규 화면은 이 세트로 우선 조합한다.

## 6. 공통 상태 처리
- Loading: 스켈레톤·스피너, 액션 비활성
- Error: 인라인 에러 + 재시도 버튼
- Empty: 빈 상태 + 기본 CTA
- Auth Guard: 비로그인 → SCR-001(로그인)
- Permission Guard: 권한 부족 → 안내
    """.trimIndent()
  }
}
