package dev.agentflow.service

import dev.agentflow.domain.PrdEntity
import dev.agentflow.domain.PrdRepository
import dev.agentflow.domain.ProjectEntity
import dev.agentflow.domain.ProjectRepository
import dev.agentflow.dto.PrdDto
import dev.agentflow.dto.PrdUpdateRequest
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.time.LocalDate

// 프로젝트별 PRD. Claude 호출이 길 수 있어 클래스 레벨 트랜잭션을 걸지 않고
// 저장소 호출 단위 트랜잭션만 쓴다(HTTP 동안 커넥션을 잡지 않기 위해).
@Service
class PrdService(
  private val prds: PrdRepository,
  private val projects: ProjectRepository,
  private val claude: ClaudeClient,
) {
  fun get(projectId: String): PrdDto? = prds.findById(projectId).orElse(null)?.toDto()

  // 프로젝트 데이터로 초안 생성. 이미 있으면 내용을 새 초안으로 갈고 버전을 올린다.
  fun generate(projectId: String): PrdDto {
    val project = projects.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로젝트가 없어요.")
    val existing = prds.findById(projectId).orElse(null)
    val content = claude.complete(agentSystemPrompt(), agentUserPrompt(project))
    val today = LocalDate.now().toString()
    val e = existing ?: PrdEntity(projectId = projectId, createdDate = today)
    e.title = project.name
    e.client = e.client.ifBlank { "내부" }
    e.author = if (content != null) "Planner Agent" else "템플릿 초안"
    e.docVersion = if (existing == null) "v1.0" else bump(existing.docVersion)
    e.updatedDate = today
    e.source = if (content != null) "agent" else "template"
    e.contentMd = content ?: templatePrd(project)
    e.updatedAt = Instant.now().toString()
    return prds.save(e).toDto()
  }

  // 관리자 수정 — 넘어온 필드만 반영, 버전 minor 증가, 출처는 human 으로.
  fun update(projectId: String, req: PrdUpdateRequest): PrdDto {
    val e = prds.findById(projectId).orElse(null)
      ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "PRD 가 아직 없어요. 먼저 생성하세요.")
    req.title?.takeIf { it.isNotBlank() }?.let { e.title = it }
    req.client?.let { e.client = it }
    req.author?.let { e.author = it }
    req.contentMd?.let { e.contentMd = it }
    e.docVersion = bump(e.docVersion)
    e.updatedDate = LocalDate.now().toString()
    e.source = "human"
    e.updatedAt = Instant.now().toString()
    return prds.save(e).toDto()
  }

  private fun bump(v: String): String {
    val m = Regex("""v(\d+)\.(\d+)""").matchEntire(v.trim()) ?: return "v1.1"
    return "v${m.groupValues[1]}.${m.groupValues[2].toInt() + 1}"
  }

  private fun agentSystemPrompt() = """
    당신은 시니어 프로덕트 매니저입니다. 주어진 프로젝트 정보로 한국어 PRD 초안을 마크다운으로 작성하세요.
    구조: 1. 배경 및 문제 정의(서비스 구성 표 포함) / 2. 목표 / 3. 비목표 / 4. 기술 스펙 요약(핵심 기술 스택 표, 도메인별 구현 방향) /
    5. 사용자 유형(표) / 6. 미결 사항(의사결정·외부 계약 체크) / 7. 핵심 플로우 / 8. 화면 명세(IA 트리, SCR 목록 표, 화면 흐름도, 공통 상태 처리 부록).
    저장소 구성(purpose)을 기술 스택·도메인 방향에 반영하고, 확정할 수 없는 것은 6. 미결 사항에 질문으로 남기세요.
    문서 본문만 출력하고 머리말·꼬리말은 붙이지 마세요.
  """.trimIndent()

  private fun agentUserPrompt(p: ProjectEntity) = buildString {
    appendLine("프로젝트명: ${p.name}")
    appendLine("소속: ${p.org}")
    appendLine("설명: ${p.desc}")
    appendLine("단계: ${p.stage}")
    appendLine("저장소:")
    p.repos.forEach { appendLine("- ${p.org}/${it.name} (${it.purpose})") }
  }

  // 키가 없을 때의 결정적 초안 — 프로젝트 데이터로 채운 동일 구조의 문서.
  private fun templatePrd(p: ProjectEntity): String {
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
1. 프로젝트 생성 → PRD 초안 자동 생성(이 문서) → 관리자 검토·수정.
2. 작업 분해 → 이슈 생성 → 착수(@claude) → PR 머지 시 완료 파생.
3. 사람 몫(외부 키·배포 승인)은 휴먼태스크로 분리되어 병렬 진행.

## 8. 화면 명세
### 화면 구조 (IA)
```
[${p.name}]
├─ 공통/진입
│   └─ SCR-101  /projects        프로젝트 현황  (🔒)
├─ 프로젝트
│   ├─ SCR-201  /projects/:id    상세 · 진행 흐름 (🔒/👤)
│   └─ SCR-202  /projects/:id/build  빌드 보드  (🔒/👤)
└─ 플랫폼 관리
    └─ ADM-001  /admin/settings  운영 설정      (🔧)
```

### SCR 목록
| SCR | 라우트 | 화면 | 권한 |
| --- | --- | --- | --- |
| SCR-101 | /projects | 프로젝트 현황 | 🔒 |
| SCR-201 | /projects/:id | 프로젝트 상세 | 🔒 / 👤 |
| SCR-202 | /projects/:id/build | 빌드 보드 | 🔒 / 👤 |
| ADM-001 | /admin/settings | 운영 설정 | 🔧 |

### 부록 · 공통 시스템 상태 처리 (모든 SCR 자동 적용)
- Loading: 스켈레톤·스피너, 액션 비활성
- Error: 인라인 에러 + 재시도 버튼
- Empty: 빈 상태 + 기본 CTA
- Auth Guard: 비로그인 → SCR-101
- Permission Guard: 권한 부족 → 안내
    """.trimIndent()
  }

  private fun PrdEntity.toDto() = PrdDto(projectId, title, client, author, docVersion, createdDate, updatedDate, source, contentMd, updatedAt)
}
