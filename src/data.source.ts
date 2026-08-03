// Centralized realistic mock data for Agent Flow.

export const REPO = {
  org: "sample-org",
  name: "agent-workflow",
  full: "sample-org / agent-workflow",
  description: "AI 에이전트가 기획부터 배포까지 자동으로 처리하는 워크플로 저장소",
  visibility: "비공개",
  branch: "main",
  progress: 68,
  phase: "구현",
}

// One project spans multiple git repositories. Planning artifacts (자료/PRD/IA)
// live at the project level; implementation happens per repository.
export const PROJECT = {
  name: "커머스 어드민 리뉴얼",
  org: "sample-org",
  desc: "회원·콘텐츠 관리를 아우르는 관리자 도구를 프론트·백엔드·인프라 저장소로 나눠 개발하는 프로젝트",
  progress: 62,
  stage: "구현",
}

// Repositories that belong to the single project.
export const PROJECT_REPOS = [
  { full: "sample-org / admin-web", purpose: "프론트엔드", branch: "main", progress: 71, tasks: 7, prs: 2, fails: 0, synced: true },
  { full: "sample-org / admin-api", purpose: "백엔드", branch: "main", progress: 58, tasks: 12, prs: 3, fails: 1, synced: true },
  { full: "sample-org / admin-infra", purpose: "인프라", branch: "main", progress: 40, tasks: 4, prs: 1, fails: 0, synced: false },
]

// 최상위 분류는 '프로젝트'예요. 하나의 프로젝트가 여러 깃 저장소를 묶어요.
// (진입 화면은 저장소가 아니라 이 프로젝트 목록을 보여줘요.)
export type ProjectRepo = { name: string; purpose: string; url?: string }
export type ProjectItem = {
  id: string
  name: string
  org: string
  desc: string
  stage: string
  progress: number
  repos: ProjectRepo[]
  tasks: number
  prs: number
  fails: number
  updated: string
  synced: boolean
}

// 데모 시드 비움 — 프로젝트는 서버(/api/mirror/projects)에서만 채워져요.
// 화면은 비어 있으면 '프로젝트 추가' 안내(EmptyState)를 보여줘요.
export const PROJECTS: ProjectItem[] = []

// ===== 휴먼태스크 (사람 전용 작업) =====
// AI가 대신할 수 없는 외부 계정·키 발급, 서비스 등록, 배포 승인만 따로 모아요.
// 사람은 이 목록만 처리하면 되고, 나머지는 모두 AI가 자동으로 진행해요.
export type ExternalKey = { name: string; desc: string; site: string; docs?: string; state: "미등록" | "등록됨" }
export type HumanTask = {
  id: string
  domain: string
  title: string
  phase: string
  status: "대기" | "진행 중" | "완료"
  purpose: string
  keys: ExternalKey[]
  manual: string
  checklist: { text: string; done: boolean }[]
  blocks: string
}

// 데모 시드 비움 — 휴먼태스크는 실제 작업 분해가 연결되면 채워져요.
// 비어 있으면 화면은 EmptyState 를 보여줘요.
export const HUMAN_TASKS: HumanTask[] = []

// ===== 빌드 보드 (단계 × 도메인) =====
// 스키마 → 프론트엔드 → 백엔드 → 외부 키 발급 → QA → 릴리즈 순으로 빌드해요.
// 각 작업이 자동/AI/사람 중 누구의 몫인지 태그로 구분해, 사람은 자기 것만 신경 쓰면 돼요.
export const BUILD_PHASES = ["스키마", "프론트엔드", "백엔드", "외부 키 발급", "QA", "릴리즈"]
export const BUILD_DOMAINS = ["admin", "auth", "chat", "vehicles", "matching", "notification", "infra", "release"]

// ===== 진행 흐름 (프로젝트 생성 후 누가 무엇을 하나) =====
// 각 단계에서 에이전트(AI) · GitHub Actions(자동) · 사람이 각자 맡은 일을 이어받아요.
export const ACTOR_SUMMARY: { key: "ai" | "auto" | "human"; title: string; icon: string; items: string[] }[] = [
  { key: "ai", title: "에이전트 (AI)", icon: "sparkle", items: [
    "요구사항 분석 · PRD · 설계 생성",
    "테스트를 먼저 작성 (TDD)",
    "Sprint Go · Ship이 코드 구현",
    "CI 실패 시 Repair Agent 자동 수정",
  ] },
  { key: "auto", title: "GitHub Actions", icon: "runs", items: [
    "단계별 워크플로 자동 실행",
    "CI: 빌드 · 테스트 · 리뷰",
    "브랜치 push · PR 자동 생성",
    "Staging 자동 배포 · Smoke Test",
  ] },
  { key: "human", title: "사람", icon: "hand", items: [
    "자료 등록 · 요구사항 결정",
    "PRD · PR 검토 · 승인",
    "외부 키 발급 (휴먼태스크)",
    "Production 배포 승인",
  ] },
]

export type PipelineStage = {
  n: number
  stage: string
  phase: string
  route: string
  agent: string
  agentName: string // 담당 에이전트 ("—" = 없음)
  model: string // 사용 모델 ("—" = 없음)
  duration: string // 예상 소요시간
  actions: string
  human: string
  humanCheck: boolean
  state: "완료" | "진행 중" | "대기"
  // 지금 실제로 동작 가능한지 판정: live(실동작) / partial(일부만 실제) / mock(목업)
  real: "live" | "partial" | "mock"
  realNote: string // 판정 근거 — 무엇이 실제이고 무엇이 아직 미연결인지
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { n: 1, stage: "자료 수집·분석", phase: "기획", route: "sources", agent: "등록된 자료에서 요구사항·충돌 자동 정리", agentName: "Analyzer Agent", model: "Claude Sonnet", duration: "~1분", actions: "자료 등록 시 분석 워크플로 트리거", human: "문서·GitHub Issue 등록", humanCheck: true, state: "완료", real: "partial", realNote: "자료·이슈·파일 읽기는 서버 프록시로 실제 동작. 분석 에이전트 자동 실행은 미연결." },
  { n: 2, stage: "요구사항 인터뷰", phase: "기획", route: "interview", agent: "모호한 점을 질문하고 답변을 반영해 스펙 확정", agentName: "Interview Agent", model: "Claude Opus", duration: "대화형 · 사람 페이스", actions: "—", human: "질문에 답하고 결정", humanCheck: true, state: "완료", real: "mock", realNote: "인터뷰 UI만 있고, 에이전트 대화가 실제 실행되지 않아요." },
  { n: 3, stage: "PRD 작성·Critic", phase: "기획", route: "prd", agent: "PRD 초안 생성 · Critic이 누락·충돌 점검·채점", agentName: "Planner · Critic Agent", model: "Claude Opus", duration: "~3분", actions: "PRD Critic 자동 실행", human: "PRD 내용 검토·승인", humanCheck: true, state: "완료", real: "mock", realNote: "PRD 생성·Critic 채점 에이전트가 미실행. 화면은 목업 데이터." },
  { n: 4, stage: "IA·디자인 시스템", phase: "설계", route: "ia", agent: "화면 구조(IA)·디자인 토큰 생성", agentName: "Design Agent", model: "Claude Sonnet", duration: "~4분", actions: "산출물 저장 → 저장소 커밋", human: "화면 구성·디자인 확인", humanCheck: true, state: "완료", real: "mock", realNote: "설계 생성·저장소 커밋이 미연결(프록시에 파일 쓰기 없음)." },
  { n: 5, stage: "작업 생성", phase: "설계", route: "tasks", agent: "PRD·설계를 작업으로 분해 · Issue 생성", agentName: "Planner Agent", model: "Claude Opus", duration: "~2분", actions: "Task Planner → GitHub Issue 동기화", human: "작업 계획 훑어보기 (선택)", humanCheck: false, state: "완료", real: "partial", realNote: "이슈 생성은 프록시로 실제 가능(미러 화면). 자동 작업 분해는 미실행." },
  { n: 6, stage: "외부 키 발급", phase: "빌드", route: "human-tasks", agent: "—", agentName: "—", model: "—", duration: "사람 대기", actions: "키 등록 감지 → 차단됐던 작업 자동 해제", human: "OAuth·외부 API 키 발급·등록 (휴먼태스크)", humanCheck: true, state: "진행 중", real: "mock", realNote: "휴먼태스크 체크리스트는 로컬 UI 상태만. Secret 저장·차단 해제 자동화 없음." },
  { n: 7, stage: "테스트 먼저 (TDD)", phase: "빌드", route: "tests", agent: "인수 기준을 테스트로 먼저 작성 (Red)", agentName: "Test Agent", model: "Claude Sonnet", duration: "~3분", actions: "테스트 실행 → 실패(Red) 확인", human: "—", humanCheck: false, state: "진행 중", real: "mock", realNote: "테스트 작성 에이전트가 미실행. CI 실행 결과 관찰은 9번 참고." },
  { n: 8, stage: "구현 (빌드)", phase: "빌드", route: "tasks", agent: "Sprint Go·Ship이 테스트를 통과시키며 구현 (Green)", agentName: "Sprint Go · Ship", model: "Claude Sonnet", duration: "작업당 ~8–12분", actions: "Agent 실행 → 브랜치 push → PR 생성", human: "—", humanCheck: false, state: "진행 중", real: "partial", realNote: "@claude 코멘트로 Claude GitHub Action 트리거는 실제 가능(액션 설치·배포 시). 자동 오케스트레이션은 미실행." },
  { n: 9, stage: "검증 (CI)", phase: "빌드", route: "runs", agent: "CI 실패 시 Repair Agent 자동 수정 (1회)", agentName: "Repair Agent", model: "Claude Sonnet", duration: "~5분", actions: "lint · typecheck · test · build · agent-review", human: "—", humanCheck: false, state: "진행 중", real: "partial", realNote: "CI 실행 결과(workflow_run)는 웹훅·백필로 미러에 실제 반영(배포 시). Repair 자동 수정은 미실행." },
  { n: 10, stage: "PR 검토·TDD 게이트", phase: "빌드", route: "pull-requests", agent: "Review Agent가 변경 검토", agentName: "Review Agent", model: "Claude Opus", duration: "~1분 + 사람 검토", actions: "CI + TDD 게이트(테스트 먼저 확인) 통과 검사", human: "PR 검토 후 병합 승인", humanCheck: true, state: "대기", real: "partial", realNote: "PR은 미러로 관찰, @claude 리뷰 트리거는 실제. TDD 게이트 자동 판정·Review 에이전트는 미실행." },
  { n: 11, stage: "배포", phase: "운영", route: "releases", agent: "릴리스 노트 초안 생성", agentName: "Release Agent", model: "Claude Sonnet", duration: "~3분 + 사람 승인", actions: "Staging 자동 배포 · Smoke Test", human: "Production 배포 승인", humanCheck: true, state: "대기", real: "mock", realNote: "배포 화면은 목업. 실제 배포 잡 트리거·Smoke Test 없음." },
  { n: 12, stage: "릴리스", phase: "운영", route: "releases", agent: "Release Note 정리", agentName: "Release Agent", model: "Claude Sonnet", duration: "~1분", actions: "Release 자동 생성·태깅", human: "릴리스 최종 승인", humanCheck: true, state: "대기", real: "mock", realNote: "릴리스 자동 생성·태깅이 미연결." },
]

// 실제 운영 전 아직 연결돼야 하는 것들 (현재는 목업 프로토타입)
export const FUTURE_INTEGRATION = [
  { title: "백엔드 서버 · DB", desc: "프로젝트·작업·상태·산출물을 저장하고 조회하는 API와 데이터베이스" },
  { title: "에이전트 실행 연결", desc: "각 Agent를 Claude API로 실제 실행하고 결과를 파이프라인에 반영" },
  { title: "GitHub App · Actions", desc: "저장소 트리거, CI 워크플로, PR·브랜치 생성, 배포 잡 실행" },
  { title: "실시간 상태 동기화", desc: "Actions·에이전트 실행 결과를 웹훅으로 받아 대시보드에 실시간 반영" },
  { title: "Secret · 외부 키 보관", desc: "휴먼태스크에서 입력한 키를 안전한 Secret 저장소에 저장·주입" },
]
