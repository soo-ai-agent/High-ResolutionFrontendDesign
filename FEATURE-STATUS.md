# 기능 현황 (구현 vs 모형 vs 미구현)

> 마지막 갱신: 2026-08-11. 화면에 보이는 것과 실제로 동작하는 것을 구분해 관리하는 문서예요.
> 새 기능·화면을 추가하거나 제거할 때 이 문서를 함께 갱신하세요.

## 모형(façade) 판별법 — 화면은 있는데 구현이 없는 것을 찾는 방법

디자인 산출물에서 출발한 프로젝트는 "그려져 있지만 동작하지 않는" UI 가 남기 쉬워요.
아래 4가지를 확인하면 분류할 수 있어요:

1. **핸들러 추적** — 버튼의 `onClick` 이 무엇을 하나요?
   - 로컬 상태만 바꾸거나(`setState`) 화면 전환만 하면(`navigate`) → 모형 의심.
   - 예: 과거 로그인 버튼은 `onLogin={() => navigate("projects")}` — 인증 없이 화면 전환뿐이었어요.
2. **API 호출 유무** — 그 UI 에서 `fetch`/lib 함수 호출이 있나요? 없으면 서버에 아무 일도 안 일어나요.
   - 예: 과거 Supabase·Slack 연동 토글은 `useState` 만 바꿨어요.
3. **서버 대응 엔드포인트** — 호출한다면 백엔드에 그 엔드포인트·서비스가 실제로 있나요?
   `backend/src/main/kotlin/dev/agentflow/web/` 의 컨트롤러에서 경로를 확인하세요.
4. **부수 효과 검증** — 실행하면 외부(GitHub·DB·파일)에 흔적이 남나요?
   E2E 스텁(기록형 GitHub 스텁)으로 실제 호출을 기록해 확인하는 것이 확실해요.

## ① 구현됨 (핵심 자동화 루프)

| 기능 | 위치(대표) |
|---|---|
| 프로젝트 생성 → PRD·IA·코드 규칙 자동 생성(+버전 이력·diff·복원) | `ProjectDocService` |
| 작업 분해(LLM/템플릿 폴백) · 이슈 생성·연결([T-00x] 매칭) | `TaskService` |
| 라벨 분해 — 이슈에 `agent-flow:분해` 라벨 → 작업으로 분해·편입 | `TaskService.onDecomposeRequested` |
| 이슈 → 작업 승격(가져오기) — 보드 카드 버튼 | `TaskService.adoptIssue` |
| 에이전트 착수 5경로: 버튼·자동 디스패치·보드 이동(B안, on/off 가능)·앱 보드 버튼(A안)·피드백 재개 | `TaskService` |
| 에이전트 실행 2모드: GitHub Actions(@claude 코멘트) / **로컬 브리지**(서버 머신 claude CLI) | `AgentDispatchService` · `LocalBridgeService` |
| 자동 코드리뷰 루프(3라운드 한도·에스컬레이션) · CI 실패 자동 회복 | `ReviewLoopService` · `CiRecoveryService` |
| 웹훅 미러(이슈·PR·Actions·보드·**코멘트**) + 백필 + 웹훅/조직 웹훅 등록 UI | `MirrorService` · `GitHubService` |
| 조직 공통 규칙·스킬 → CLAUDE.md·.claude/skills 동기화(프로젝트 규칙과 병합) | `OrgAssetService` |
| 관측: 활동 피드·간트·Actions 실행 내역·인사이트(활동+이슈+PR+코멘트) | `ProjectActivityService` 등 |
| 테스트 리포트(화면별 케이스·실행 결과·캡처) + **대시보드에서 실행**(`E2E_COMMAND`) | `E2eReportService` · `e2e/run.mjs` |
| GitHub 연결(PAT) — **DB 영속화, 재시작 유지** | `GitHubService` + `SettingService` |

## ② 이번에 제거한 모형 (화면만 있고 구현이 없던 것)

| 있던 것 | 실태 | 처리 |
|---|---|---|
| 로그인 화면("GitHub로 계속하기") | 인증·세션 없이 화면 전환만 | 화면 삭제 — 앱이 프로젝트 목록으로 바로 열려요 |
| 헤더 알림 벨(빨간 점)·도움말 버튼 | 알림 시스템 자체가 없음 | 제거 — 계정 칩은 실제 연결 상태 표시로 대체 |
| 프로젝트 마법사 Supabase·Slack 연동 토글 | 로컬 상태만 변경, 실제 연동 없음 | 제거 — GitHub(실제 연동)만 정직하게 표기 |

## ③ 남은 미구현 (알려진 공백 — 화면에 없고 코드에도 없음)

| 항목 | 내용 | 필요해지는 시점 |
|---|---|---|
| 인증(로그인) | 어드민 접근 제어 없음. 공개 배포 시 리버스 프록시 인증을 앞에 두세요(`/api/webhook/github` 는 제외) | 공개 배포 |
| 다중 사용자·팀 | 사용자 개념·권한·행위자 기록(누가 승인했나) 없음 → Spring Security + GitHub OAuth | 팀 사용 |
| GitLab 어댑터 | `.gitlab/claude.gitlab-ci.yml` 템플릿(실행부)만 있음 — 서버는 GitHub API 전용 | GitLab 저장소 관리 |
| 외부 알림 채널 | 검토 대기는 헤더 배지로 보이지만, 이메일/Slack 발송은 없음 (앱을 안 열면 모름) | 무인 운영 |
| 저장소 내 자동화 테스트 | 백엔드 단위/통합 테스트 부재, CI 는 빌드만 | 기여자 증가 |

### 루프 관측·제어 보강 이력 (감사에서 나온 공백 → 해소)

- 상태 전이(reconcile)가 UI 조회에 기생 → **스케줄러 30초 스윕으로 이관** (화면 안 열어도 전이)
- 검토 대기 도착을 알 수 없음 → **헤더 전역 배지** (15초 폴링, 클릭 시 휴먼태스크)
- 리뷰 라운드 부분일치 과대 계산(`PR #1`⊂`PR #12`) → **경계 매칭으로 수정**
- 리뷰 루프·CI 회복이 끌 수 없고 한도 고정 → **프로젝트별 토글·한도(1~5)** (디스패치 카드)
- CI 회복 스윕 결과가 폐기됨 → **진행 흐름 카드**(마지막 스윕·지시·보류·오류 + 수동 스윕)
- 브리지 잡 제어 불가 → **id·로그 열람·대기/실행 중 취소·재시도** (설정 화면)
- "구성됐는데 동작 안 함"이 비가시 → **서버 구성 상태 카드** (`/api/system/capabilities`)
- approve 상태 가드 없음·patch 임의 상태 수용 → **검토 대기에서만 승인, 상태 화이트리스트**

## ④ 코드는 있고 사용자 설정만 남은 것

- `docker-publish.yml` — `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` 시크릿 등록
- `fly-deploy.yml` — `FLY_API_TOKEN`(+LLM 키) 시크릿 등록
- 대상 저장소: Issues 기능 켜기 · Claude GitHub App 설치 · `ANTHROPIC_API_KEY`(또는 `CLAUDE_CODE_OAUTH_TOKEN`) 시크릿
- 어드민: 설정 › 연동에 쓰기 권한 PAT · LLM 키(`ANTHROPIC_API_KEY`) 서버 환경 변수
- 대시보드 E2E 실행: 서버 환경 변수 `E2E_COMMAND=node e2e/run.mjs` (+`pnpm install`, 크로미움)
- 로컬 브리지: 서버 머신에 `claude` CLI 설치·로그인(구독 과금) 후 설정 › 에이전트 실행 모드에서 전환

## 유지 규칙

- 백엔드 없는 UI 요소는 추가하지 않아요. 먼저 만들 수 없으면 "지원 안 함"을 화면에 정직하게 적어요.
- 기능을 추가·제거하면 이 문서의 표를 갱신해요.
- 모형 여부가 애매하면 위 판별법 4단계로 확인한 뒤 분류해요.
