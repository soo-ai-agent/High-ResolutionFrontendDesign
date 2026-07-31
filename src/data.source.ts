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

export type Role = "human" | "ai" | "both" | "auto"

// Repositories that belong to the single project.
export const PROJECT_REPOS = [
  { full: "sample-org / admin-web", purpose: "프론트엔드", branch: "main", progress: 71, tasks: 7, prs: 2, fails: 0, synced: true },
  { full: "sample-org / admin-api", purpose: "백엔드", branch: "main", progress: 58, tasks: 12, prs: 3, fails: 1, synced: true },
  { full: "sample-org / admin-infra", purpose: "인프라", branch: "main", progress: 40, tasks: 4, prs: 1, fails: 0, synced: false },
]

// 최상위 분류는 '프로젝트'예요. 하나의 프로젝트가 여러 깃 저장소를 묶어요.
// (진입 화면은 저장소가 아니라 이 프로젝트 목록을 보여줘요.)
export type ProjectRepo = { name: string; purpose: string }
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

export const PROJECTS: ProjectItem[] = [
  {
    id: "P-01",
    name: "커머스 어드민 리뉴얼",
    org: "sample-org",
    desc: "회원·콘텐츠 관리를 아우르는 관리자 도구를 프론트·백엔드·인프라 저장소로 나눠 개발하는 프로젝트",
    stage: "구현",
    progress: 62,
    repos: [
      { name: "admin-web", purpose: "프론트엔드" },
      { name: "admin-api", purpose: "백엔드" },
      { name: "admin-infra", purpose: "인프라" },
    ],
    tasks: 23, prs: 6, fails: 1, updated: "3분 전", synced: true,
  },
  {
    id: "P-02",
    name: "결제 플랫폼 고도화",
    org: "sample-org",
    desc: "결제 코어와 결제 웹을 분리해 안정성과 확장성을 높이는 프로젝트",
    stage: "검증",
    progress: 82,
    repos: [
      { name: "payments-core", purpose: "백엔드" },
      { name: "payments-web", purpose: "프론트엔드" },
    ],
    tasks: 8, prs: 2, fails: 0, updated: "1시간 전", synced: true,
  },
  {
    id: "P-03",
    name: "알림 서비스 신규 구축",
    org: "sample-org",
    desc: "이메일·푸시·인앱 알림을 통합 관리하는 신규 서비스",
    stage: "작업 생성",
    progress: 34,
    repos: [
      { name: "notify-service", purpose: "백엔드" },
      { name: "notify-web", purpose: "프론트엔드" },
    ],
    tasks: 21, prs: 1, fails: 2, updated: "2일 전", synced: false,
  },
  {
    id: "P-04",
    name: "디자인 시스템 배포",
    org: "sample-org",
    desc: "공용 디자인 토큰과 컴포넌트를 패키지로 배포하는 프로젝트",
    stage: "릴리스",
    progress: 100,
    repos: [
      { name: "design-tokens", purpose: "공용 패키지" },
    ],
    tasks: 0, prs: 0, fails: 0, updated: "어제", synced: true,
  },
]

export type Phase = {
  key: string
  label: string
  status: "완료" | "실행 중" | "검토 필요" | "대기" | "생성 중"
  owner: Role // 사람 / AI / 협업
  ownerNote: string
}

export const PHASES: Phase[] = [
  { key: "overview", label: "개요", status: "완료", owner: "human", ownerNote: "사람이 현황을 확인해요" },
  { key: "sources", label: "자료", status: "완료", owner: "both", ownerNote: "사람이 등록 · AI가 분석" },
  { key: "interview", label: "요구사항 인터뷰", status: "완료", owner: "both", ownerNote: "AI가 질문 · 사람이 결정" },
  { key: "prd", label: "PRD", status: "완료", owner: "both", ownerNote: "AI가 초안 · 사람이 승인" },
  { key: "ia", label: "IA·디자인", status: "완료", owner: "ai", ownerNote: "AI가 설계" },
  { key: "tasks", label: "작업 생성", status: "완료", owner: "ai", ownerNote: "AI가 작업 분해" },
  { key: "test", label: "테스트 먼저", status: "실행 중", owner: "ai", ownerNote: "AI가 테스트를 먼저 작성해요 (TDD)" },
  { key: "build", label: "구현", status: "실행 중", owner: "ai", ownerNote: "AI가 테스트를 통과시키며 구현" },
  { key: "verify", label: "검증", status: "검토 필요", owner: "ai", ownerNote: "AI가 테스트 실행 · 사람이 확인" },
  { key: "deploy", label: "배포", status: "대기", owner: "human", ownerNote: "사람이 배포를 승인해요" },
  { key: "release", label: "릴리스", status: "대기", owner: "both", ownerNote: "AI가 정리 · 사람이 승인" },
]

// The planning-stage handoff sequence, shown on the overview so a user can
// follow who does what next, step by step.
export const PLANNING_FLOW: { step: string; owner: Role; action: string; state: "완료" | "진행 중" | "대기"; to: string }[] = [
  { step: "자료 등록", owner: "human", action: "문서·GitHub Issue를 추가", state: "완료", to: "sources" },
  { step: "자료 분석", owner: "ai", action: "요구사항·충돌을 자동 정리", state: "완료", to: "sources" },
  { step: "요구사항 인터뷰", owner: "both", action: "AI가 모호한 점을 되묻고 사람이 결정", state: "완료", to: "interview" },
  { step: "PRD 초안 생성", owner: "ai", action: "확정된 요구사항으로 PRD 작성", state: "완료", to: "prd" },
  { step: "PRD 검토·승인", owner: "human", action: "내용을 확인하고 수정·승인", state: "진행 중", to: "prd" },
  { step: "PRD Critic", owner: "ai", action: "누락·충돌을 점검해 완성도 채점", state: "진행 중", to: "critic" },
]

export const OVERVIEW_SUMMARY = [
  { label: "PRD 상태", value: "검토 중", sub: "v1.2 · Critic 87점", tone: "warning" },
  { label: "전체 화면", value: "42", sub: "구현 완료 31", tone: "default" },
  { label: "전체 작업", value: "65", sub: "완료 38 · 진행 5", tone: "default" },
  { label: "열린 PR", value: "3", sub: "병합 대기 1", tone: "blue" },
  { label: "실패한 Actions", value: "1", sub: "CI · PR #83", tone: "error" },
  { label: "Production", value: "v0.9.2", sub: "승인 대기", tone: "purple" },
]

export const PIPELINE = [
  { label: "PRD", detail: "완료", status: "완료" },
  { label: "IA", detail: "완료", status: "완료" },
  { label: "작업 생성", detail: "완료", status: "완료" },
  { label: "테스트 먼저", detail: "48/65 작성", status: "실행 중" },
  { label: "구현", detail: "38/65", status: "실행 중" },
  { label: "검증", detail: "진행 중", status: "실행 중" },
  { label: "Staging 배포", detail: "완료", status: "완료" },
  { label: "Production", detail: "대기", status: "대기" },
]

export const RECENT_RUNS = [
  { id: "#514", workflow: "PRD Critic", target: "PRD v1.2", agent: "Review Agent", status: "완료", started: "10:42", dur: "48초", result: "보고서 보기", model: "Claude Sonnet" },
  { id: "#513", workflow: "Task Planner", target: "설계 v1.1", agent: "Planner Agent", status: "완료", started: "10:20", dur: "2분 10초", result: "작업 65개", model: "Claude Opus" },
  { id: "#512", workflow: "Backend Agent", target: "T-045", agent: "Backend Agent", status: "완료", started: "09:58", dur: "11분 24초", result: "PR #83", model: "Claude Sonnet" },
  { id: "#511", workflow: "CI", target: "PR #83", agent: "—", status: "실패", started: "09:44", dur: "5분 02초", result: "로그 확인", model: "—" },
  { id: "#510", workflow: "Frontend Agent", target: "T-041", agent: "Frontend Agent", status: "완료", started: "09:12", dur: "8분 51초", result: "PR #81", model: "Claude Sonnet" },
]

export const CHECKLIST = [
  { label: "실패한 CI", value: "1건", tone: "error", to: "runs" },
  { label: "검토 중인 PR", value: "3건", tone: "warning", to: "pull-requests" },
  { label: "미등록 외부 키", value: "6건", tone: "warning", to: "human-tasks" },
  { label: "Production 승인 대기", value: "1건", tone: "purple", to: "releases" },
]

export const REPOS = [
  { full: "sample-org / agent-workflow", visibility: "비공개", branch: "main", phase: "구현", progress: 68, tasks: 12, prs: 3, fails: 1, deploy: "Staging 배포 완료", updated: "3분 전", synced: true },
  { full: "sample-org / payments-core", visibility: "비공개", branch: "main", phase: "검증", progress: 82, tasks: 6, prs: 2, fails: 0, deploy: "Production 배포 완료", updated: "1시간 전", synced: true },
  { full: "sample-org / design-tokens", visibility: "공개", branch: "main", phase: "릴리스", progress: 100, tasks: 0, prs: 0, fails: 0, deploy: "Production 배포 완료", updated: "어제", synced: true },
  { full: "sample-org / notify-service", visibility: "비공개", branch: "develop", phase: "작업 생성", progress: 34, tasks: 21, prs: 1, fails: 2, deploy: "미배포", updated: "2일 전", synced: false },
  { full: "sample-org / docs-portal", visibility: "공개", branch: "main", phase: "PRD", progress: 12, tasks: 0, prs: 0, fails: 0, deploy: "미배포", updated: "3일 전", synced: true },
]

export const TASK_COLUMNS = ["초안", "계획 완료", "실행 준비", "테스트 작성", "구현 중", "PR 검토", "수정 필요", "완료"]

// TDD 단계 — 테스트를 먼저 작성(Red)하고, 통과시키며 구현(Green)하고, 정리(Refactor)해요.
export type TddPhase = "테스트" | "구현" | "리팩터" | "완료"

export type Task = {
  id: string
  title: string
  domain: string
  agent: string
  risk: "낮음" | "중간" | "높음"
  deps: string
  screen: string
  issue: string
  pr: string
  check: string
  status: string
  tdd: TddPhase // 이 작업이 놓인 TDD 단계
}

export const TASKS: Task[] = [
  { id: "T-045", title: "회원 목록 조회 API", domain: "backend", agent: "Backend Agent", risk: "중간", deps: "2/2 완료", screen: "ADM-002", issue: "#72", pr: "#83", check: "CI 실패", status: "PR 검토", tdd: "구현" },
  { id: "T-046", title: "회원 상세 화면 구현", domain: "frontend", agent: "Frontend Agent", risk: "낮음", deps: "1/1 완료", screen: "ADM-002", issue: "#73", pr: "#84", check: "CI 성공", status: "PR 검토", tdd: "완료" },
  { id: "T-047", title: "로그인 실패 흐름 처리", domain: "frontend", agent: "Frontend Agent", risk: "중간", deps: "1/1 완료", screen: "SCR-101", issue: "#74", pr: "—", check: "테스트 Red", status: "테스트 작성", tdd: "테스트" },
  { id: "T-048", title: "권한 미들웨어 추가", domain: "backend", agent: "Backend Agent", risk: "높음", deps: "1/2", screen: "—", issue: "#75", pr: "—", check: "—", status: "구현 중", tdd: "구현" },
  { id: "T-049", title: "콘텐츠 관리 목록 API", domain: "backend", agent: "Backend Agent", risk: "낮음", deps: "2/2 완료", screen: "ADM-003", issue: "#76", pr: "#85", check: "진행 중", status: "구현 중", tdd: "구현" },
  { id: "T-050", title: "이용약관 화면 마크업", domain: "frontend", agent: "Frontend Agent", risk: "낮음", deps: "완료", screen: "SCR-201", issue: "#77", pr: "—", check: "—", status: "계획 완료", tdd: "테스트" },
  { id: "T-051", title: "E2E 로그인 테스트", domain: "test", agent: "Test Agent", risk: "낮음", deps: "1/1 완료", screen: "SCR-101", issue: "#78", pr: "—", check: "테스트 Red", status: "테스트 작성", tdd: "테스트" },
  { id: "T-044", title: "세션 토큰 갱신 로직", domain: "backend", agent: "Backend Agent", risk: "중간", deps: "완료", screen: "—", issue: "#71", pr: "#80", check: "CI 성공", status: "완료", tdd: "완료" },
  { id: "T-043", title: "대시보드 카드 컴포넌트", domain: "frontend", agent: "Frontend Agent", risk: "낮음", deps: "완료", screen: "ADM-001", issue: "#70", pr: "#79", check: "CI 성공", status: "완료", tdd: "완료" },
]

// tddGate: 구현 전에 테스트가 먼저 작성됐는지 검증하는 병합 게이트예요.
export const PRS = [
  { num: "#83", title: "T-045 회원 목록 조회 API", task: "T-045", files: 7, risk: "중간", ci: "실패", ai: "경고 1", fixes: "1/2", mergeable: "차단", status: "수정 필요", tddGate: "통과" },
  { num: "#84", title: "T-046 회원 상세 화면 구현", task: "T-046", files: 12, risk: "낮음", ci: "성공", ai: "통과", fixes: "0/2", mergeable: "병합 가능", status: "검토 중", tddGate: "통과" },
  { num: "#85", title: "T-049 콘텐츠 관리 목록 API", task: "T-049", files: 4, risk: "낮음", ci: "진행 중", ai: "대기", fixes: "0/2", mergeable: "차단", status: "Draft", tddGate: "실패" },
  { num: "#81", title: "T-041 알림 배너 컴포넌트", task: "T-041", files: 3, risk: "낮음", ci: "성공", ai: "통과", fixes: "0/2", mergeable: "병합 가능", status: "검토 중", tddGate: "통과" },
]

export const PR_CHECKS = [
  { name: "spec-validation", status: "성공" },
  { name: "tests-first", status: "성공" },
  { name: "path-scope", status: "성공" },
  { name: "lint", status: "성공" },
  { name: "typecheck", status: "성공" },
  { name: "unit-test", status: "성공" },
  { name: "integration-test", status: "실패" },
  { name: "build", status: "성공" },
  { name: "dependency-review", status: "성공" },
  { name: "agent-review", status: "진행 중" },
]

export const RUNS = [
  { id: "#514", workflow: "PRD Critic", target: "PRD v1.2", agent: "Review Agent", attempt: "1차", started: "10:42", dur: "48초", status: "완료", model: "Claude Sonnet", result: "보고서" },
  { id: "#513", workflow: "Task Planner", target: "설계 v1.1", agent: "Planner Agent", attempt: "1차", started: "10:20", dur: "2분 10초", status: "완료", model: "Claude Opus", result: "작업 65개" },
  { id: "#512", workflow: "Backend Agent", target: "T-045", agent: "Backend Agent", attempt: "1차", started: "09:58", dur: "11분 24초", status: "완료", model: "Claude Sonnet", result: "PR #83" },
  { id: "#511", workflow: "CI", target: "PR #83", agent: "—", attempt: "1차", started: "09:44", dur: "5분 02초", status: "실패", model: "—", result: "로그" },
  { id: "#509", workflow: "Repair Agent", target: "PR #83", agent: "Repair Agent", attempt: "2차", started: "실행 중", dur: "3분 12초", status: "실행 중", model: "Claude Sonnet", result: "—" },
  { id: "#508", workflow: "Frontend Agent", target: "T-041", agent: "Frontend Agent", attempt: "1차", started: "09:12", dur: "8분 51초", status: "완료", model: "Claude Sonnet", result: "PR #81" },
]

// TDD 순서의 Agent 실행 타임라인 — 스펙 확인 → 테스트 먼저(Red) → 구현(Green) → PR.
export const RUN_STEPS = [
  { name: "Checkout", status: "완료", started: "09:58:02", dur: "4초" },
  { name: "의존성 설치", status: "완료", started: "09:58:06", dur: "38초" },
  { name: "스펙 확인", status: "완료", started: "09:58:44", dur: "22초" },
  { name: "테스트 먼저 작성", status: "완료", started: "09:59:06", dur: "2분 41초" },
  { name: "테스트 실행 (Red)", status: "완료", started: "10:01:47", dur: "34초" },
  { name: "구현 (Green)", status: "완료", started: "10:02:21", dur: "6분 12초" },
  { name: "테스트 실행 (Green)", status: "완료", started: "10:08:33", dur: "1분 20초" },
  { name: "PR 생성", status: "완료", started: "10:09:53", dur: "8초" },
]

export const SCREENS = [
  { group: "공통 / 진입", items: [
    { id: "SCR-101", name: "로그인", route: "/login", domain: "auth", design: "완료", fe: "완료", api: "완료", test: "통과", tasks: 3 },
    { id: "SCR-102", name: "회원가입", route: "/signup", domain: "auth", design: "완료", fe: "진행 중", api: "완료", test: "미실행", tasks: 2 },
    { id: "SCR-103", name: "Not Found", route: "/404", domain: "common", design: "완료", fe: "완료", api: "—", test: "통과", tasks: 1 },
    { id: "SCR-104", name: "Server Error", route: "/500", domain: "common", design: "완료", fe: "완료", api: "—", test: "통과", tasks: 1 },
  ] },
  { group: "공통 / 정책", items: [
    { id: "SCR-201", name: "이용약관", route: "/terms", domain: "common", design: "완료", fe: "대기", api: "—", test: "미실행", tasks: 1 },
    { id: "SCR-202", name: "개인정보 처리방침", route: "/privacy", domain: "common", design: "완료", fe: "대기", api: "—", test: "미실행", tasks: 1 },
  ] },
  { group: "관리", items: [
    { id: "ADM-001", name: "대시보드", route: "/admin", domain: "admin", design: "완료", fe: "완료", api: "완료", test: "통과", tasks: 4 },
    { id: "ADM-002", name: "회원 관리", route: "/admin/members", domain: "admin", design: "완료", fe: "진행 중", api: "검토 중", test: "미실행", tasks: 5 },
    { id: "ADM-003", name: "콘텐츠 관리", route: "/admin/contents", domain: "admin", design: "진행 중", fe: "대기", api: "진행 중", test: "미실행", tasks: 3 },
  ] },
]

export const CRITIC_SCORES = [
  { label: "요구사항 일관성", score: 92 },
  { label: "원본 자료 일치도", score: 88 },
  { label: "화면 정의 완성도", score: 84 },
  { label: "API 정의 완성도", score: 79 },
  { label: "데이터 구조", score: 90 },
  { label: "오류 처리", score: 71 },
  { label: "테스트 가능성", score: 86 },
  { label: "비기능 요구사항", score: 83 },
]

export const CRITIC_ISSUES = [
  { severity: "차단", section: "7. 핵심 플로우", title: "인증 실패 흐름이 정의되지 않았어요.", reason: "로그인 실패 시 401·403 응답에 대한 처리와 이동 화면이 명세에 없습니다.", fix: "401, 403 응답 처리와 이동 화면을 추가하세요.", status: "미해결" },
  { severity: "경고", section: "8. 데이터 및 권한", title: "권한 등급별 접근 범위가 모호해요.", reason: "관리 화면 접근 권한이 텍스트로만 서술되어 구현 기준이 부족합니다.", fix: "권한 매트릭스 표를 추가해 화면별 접근 범위를 정의하세요.", status: "미해결" },
  { severity: "개선 권장", section: "5. 미결 사항", title: "세션 만료 시간이 미정입니다.", reason: "보안 요구사항과 연결되는 세션 정책이 비어 있습니다.", fix: "액세스 토큰 만료(예: 30분)와 갱신 정책을 명시하세요.", status: "미해결" },
  { severity: "해결 완료", section: "2. 목표", title: "핵심 성공 지표가 추가되었어요.", reason: "이전 검토에서 지적된 KPI 부재가 반영되었습니다.", fix: "—", status: "해결 완료" },
]

export const MANUAL_TASKS = [
  { id: "M-001", title: "ANTHROPIC_API_KEY 등록", service: "Anthropic", secret: "ANTHROPIC_API_KEY", state: "등록됨", blocks: "모든 Agent 실행", done: true },
  { id: "M-002", title: "GitHub App 설치", service: "GitHub", secret: "APP_ID / APP_PRIVATE_KEY", state: "등록됨", blocks: "저장소 동기화", done: true },
  { id: "M-003", title: "Staging Environment 생성", service: "Vercel", secret: "—", blocks: "Staging 배포", done: true },
  { id: "M-004", title: "Production Environment 생성", service: "Vercel", secret: "—", blocks: "Production 배포", done: false },
  { id: "M-005", title: "데이터베이스 Secret 등록", service: "Supabase", secret: "DATABASE_URL_PRODUCTION", state: "미등록", blocks: "Production 배포", done: false },
  { id: "M-006", title: "도메인 DNS 연결", service: "Cloudflare", secret: "—", blocks: "Production 공개", done: false },
  { id: "M-007", title: "Production 배포 승인", service: "Agent Flow", secret: "—", blocks: "릴리스 생성", done: false },
]

export const SECRETS = [
  { name: "ANTHROPIC_API_KEY", state: "등록됨" },
  { name: "DATABASE_URL_STAGING", state: "등록됨" },
  { name: "DATABASE_URL_PRODUCTION", state: "미등록" },
  { name: "APP_ID", state: "등록됨" },
  { name: "APP_PRIVATE_KEY", state: "등록됨" },
  { name: "SLACK_WEBHOOK_URL", state: "확인 필요" },
]

export const TESTS_SUMMARY = [
  { label: "전체 테스트", value: "148" },
  { label: "통과", value: "129", tone: "success" },
  { label: "실패", value: "6", tone: "error" },
  { label: "미실행", value: "13", tone: "warning" },
  { label: "커버리지", value: "78%", tone: "blue" },
  { label: "치명적 결함", value: "1", tone: "error" },
]

export const TEST_CASES = [
  { id: "TC-011", screen: "SCR-101", task: "T-047", type: "UI", pre: "로그인 화면 접근", expect: "잘못된 비밀번호 시 오류 메시지 노출", status: "실패" },
  { id: "TC-012", screen: "SCR-101", task: "T-051", type: "Integration", pre: "유효한 계정 보유", expect: "로그인 후 대시보드 이동", status: "통과" },
  { id: "TC-020", screen: "ADM-002", task: "T-045", type: "API", pre: "관리자 세션", expect: "회원 목록 20건 페이지네이션", status: "실패" },
  { id: "TC-021", screen: "ADM-002", task: "T-048", type: "Permission", pre: "일반 권한 세션", expect: "403 반환 및 접근 제한 안내", status: "미실행" },
  { id: "TC-030", screen: "ADM-001", task: "T-043", type: "Accessibility", pre: "대시보드 진입", expect: "모든 카드 대비 AA 충족", status: "통과" },
]

export const RELEASES = [
  { version: "v0.9.2", env: "Production", created: "대기 중", prs: 8, issues: 12, status: "승인 대기", note: true },
  { version: "v0.9.1", env: "Staging", created: "07/29 18:20", prs: 6, issues: 9, status: "배포 완료", note: true },
  { version: "v0.9.0", env: "Production", created: "07/22 14:05", prs: 14, issues: 21, status: "배포 완료", note: true },
]

export const SOURCES = [
  { id: "SRC-01", title: "관리자 대시보드 기획 초안", type: "Markdown", state: "분석 완료", reqs: 24, conflicts: 1, prd: "반영됨", created: "07/24 09:12" },
  { id: "SRC-02", title: "회원 관리 요구사항 회의록", type: "문서", state: "분석 완료", reqs: 18, conflicts: 2, prd: "부분 반영", created: "07/25 15:40" },
  { id: "SRC-03", title: "로그인 정책 PDF", type: "PDF", state: "분석 중", reqs: 0, conflicts: 0, prd: "미반영", created: "07/28 11:02" },
  { id: "SRC-04", title: "GitHub Issue #42 접근성 요청", type: "GitHub Issue", state: "분석 완료", reqs: 7, conflicts: 0, prd: "반영됨", created: "07/29 10:30" },
]

export const AGENTS = [
  { name: "Planner Agent", model: "Claude Opus", turns: 12, timeout: "10분", color: "purple" },
  { name: "Frontend Agent", model: "Claude Sonnet", turns: 20, timeout: "15분", color: "blue" },
  { name: "Backend Agent", model: "Claude Sonnet", turns: 20, timeout: "15분", color: "blue" },
  { name: "Test Agent", model: "Claude Sonnet", turns: 15, timeout: "12분", color: "success" },
  { name: "Review Agent", model: "Claude Opus", turns: 10, timeout: "8분", color: "warning" },
  { name: "Repair Agent", model: "Claude Sonnet", turns: 8, timeout: "10분", color: "error" },
]

// ===== 요구사항 인터뷰 루프 (똑빌더식 개발 자동화) =====
// 사람이 백로그 요구사항을 던지면 → AI가 분석하고 모호한 점을 하나씩 되물어요.
// 사람이 답하며 모호함이 모두 해소되면 → AI가 스펙을 확정하고,
// 테스트 코드를 먼저 만든 뒤(TDD) Sprint Go·Ship 에이전트가 구현으로 넘어가요.
export const INTERVIEW_BACKLOG = {
  id: "BL-118",
  title: "회원 목록 검색·상태 필터",
  from: "회원 관리 요구사항 회의록 (SRC-02)",
  screen: "ADM-002",
  raw: "회원 목록에서 회원을 검색하고 상태별로 필터링할 수 있어야 해요. 관리자가 회원을 빠르게 찾는 게 목적이에요.",
}

export type Ambiguity = { id: string; label: string }
export const INTERVIEW_AMBIGUITIES: Ambiguity[] = [
  { id: "A1", label: "검색 대상 필드" },
  { id: "A2", label: "회원 상태 값 정의" },
  { id: "A3", label: "화면 접근 권한" },
  { id: "A4", label: "목록 정렬 기준" },
  { id: "A5", label: "빈 결과·오류 처리" },
]

export type InterviewQuestion = { id: string; resolves: string; question: string; why: string; options: string[] }
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  { id: "Q1", resolves: "A1", question: "회원 검색은 어떤 필드를 기준으로 하나요?", why: "검색 인덱스와 쿼리 범위가 달라져요.", options: ["이름 + 이메일", "이름만", "이메일 + 전화번호", "전체 텍스트"] },
  { id: "Q2", resolves: "A2", question: "회원 상태 값은 어떻게 구분하나요?", why: "필터 옵션과 데이터 모델의 enum이 결정돼요.", options: ["활성 · 휴면 · 탈퇴", "활성 · 휴면 · 탈퇴 · 정지", "활성 · 비활성"] },
  { id: "Q3", resolves: "A3", question: "이 화면은 누가 접근할 수 있어야 하나요?", why: "권한 미들웨어와 403 처리 기준이 돼요.", options: ["슈퍼 관리자만", "관리자 전체", "역할별 세분화"] },
  { id: "Q4", resolves: "A4", question: "목록의 기본 정렬은 무엇으로 할까요?", why: "기본 쿼리와 인수 테스트의 기대값이 정해져요.", options: ["최근 가입순", "이름 오름차순", "최근 활동순"] },
  { id: "Q5", resolves: "A5", question: "검색 결과가 없을 때 어떻게 보여줄까요?", why: "Empty 상태 화면과 테스트 케이스가 필요해요.", options: ["빈 상태 안내 + 필터 초기화", "전체 목록으로 복귀", "추천 검색어 노출"] },
]

// 인터뷰가 끝나면 AI가 만들어내는 확정 스펙 미리보기
export const INTERVIEW_SPEC = {
  title: "회원 목록 검색·필터 기능 명세",
  api: "GET /admin/members?q=&status=&sort=&page=",
  fields: [
    { k: "검색(q)", v: "이름·이메일 부분 일치" },
    { k: "상태(status)", v: "active · dormant · withdrawn · suspended" },
    { k: "정렬(sort)", v: "최근 가입순(기본)" },
    { k: "권한", v: "관리자 전체(RBAC) · 탈퇴 조회는 슈퍼 관리자" },
    { k: "상태 화면", v: "Loading · Ready · Empty · Error" },
  ],
  // 테스트 코드 먼저 (TDD) — 인수 기준
  acceptance: [
    "이름·이메일 부분검색 시 20건 페이지네이션",
    "status=dormant 필터 시 휴면 회원만 반환",
    "권한 없는 세션은 403 반환",
    "결과 없음 시 Empty 상태 + 필터 초기화 노출",
  ],
}

// 스펙 확정 후 구현을 맡는 똑빌더식 개발 자동화 플러그인
export const BUILD_PLUGINS = [
  { name: "Sprint Go", domain: "프론트엔드", note: "화면·상태·상호작용 구현", color: "blue" },
  { name: "Ship", domain: "백엔드", note: "API·데이터·권한 구현", color: "purple" },
]

export const AUTOMATION = [
  { label: "PRD Critic 자동 실행", on: true },
  { label: "작업 계획 PR 자동 생성", on: true },
  { label: "작업 Issue 자동 동기화", on: true },
  { label: "AI 작업 자동 시작", on: false },
  { label: "CI 실패 자동 수정", on: true, note: "1회" },
  { label: "낮은 위험도 자동 병합", on: false },
  { label: "Staging 자동 배포", on: true },
  { label: "Production 자동 배포", on: false, danger: true },
  { label: "Release 자동 생성", on: true },
]

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

export const HUMAN_TASKS: HumanTask[] = [
  {
    id: "T-056", domain: "auth", title: "카카오 OAuth 등록", phase: "외부 키 발급", status: "대기",
    purpose: "카카오 로그인을 위해 REST API 키와 Client Secret을 발급받아 등록해요.",
    keys: [
      { name: "KAKAO_REST_API_KEY", desc: "카카오 디벨로퍼스 앱 REST API 키", site: "https://developers.kakao.com", docs: "https://developers.kakao.com/docs", state: "미등록" },
      { name: "KAKAO_CLIENT_SECRET", desc: "카카오 로그인 Client Secret (보안 강화 시)", site: "https://developers.kakao.com", state: "미등록" },
    ],
    manual: "카카오 디벨로퍼스 앱 생성 후 REST API 키 발급 + Redirect URI 설정, platform 등록. KAKAO_REST_API_KEY / KAKAO_CLIENT_SECRET 입력.",
    checklist: [
      { text: "카카오 디벨로퍼스 앱 생성", done: false },
      { text: "platform(Web) 등록 및 Redirect URI 설정", done: false },
      { text: "REST API 키 · Client Secret 입력", done: false },
    ],
    blocks: "T-030 카카오 세션 처리, 로그인 플로우",
  },
  {
    id: "T-052", domain: "vehicles", title: "CODEF API 키 발급", phase: "외부 키 발급", status: "대기",
    purpose: "차량 정보 조회를 위한 CODEF API 키를 발급받아요.",
    keys: [
      { name: "CODEF_CLIENT_ID", desc: "CODEF OAuth Client ID", site: "https://codef.io", docs: "https://developer.codef.io", state: "미등록" },
      { name: "CODEF_CLIENT_SECRET", desc: "CODEF OAuth Client Secret", site: "https://codef.io", state: "미등록" },
    ],
    manual: "CODEF 콘솔에서 서비스 신청 후 클라이언트 정보 발급.",
    checklist: [{ text: "CODEF 계정 생성", done: false }, { text: "서비스 신청·승인", done: false }, { text: "클라이언트 정보 입력", done: false }],
    blocks: "차량 정보 조회 API",
  },
  {
    id: "T-053", domain: "matching", title: "네이버 지도 API 등록", phase: "외부 키 발급", status: "대기",
    purpose: "차량 위치·매칭을 위한 네이버 지도 API를 등록해요.",
    keys: [{ name: "NCP_MAPS_CLIENT_ID", desc: "네이버 클라우드 Maps Client ID", site: "https://console.ncloud.com", state: "미등록" }],
    manual: "NCP 콘솔에서 Maps 이용 신청 후 Client ID 발급, 서비스 URL 등록.",
    checklist: [{ text: "Maps 이용 신청", done: false }, { text: "서비스 URL 등록", done: false }, { text: "Client ID 입력", done: false }],
    blocks: "지도·매칭 기능",
  },
  {
    id: "T-054", domain: "notification", title: "NCP SENS 키 발급", phase: "외부 키 발급", status: "대기",
    purpose: "알림(SMS·알림톡) 발송을 위한 NCP SENS 키를 발급해요.",
    keys: [
      { name: "NCP_SENS_ACCESS_KEY", desc: "NCP SENS Access Key", site: "https://console.ncloud.com", state: "미등록" },
      { name: "NCP_SENS_SECRET_KEY", desc: "NCP SENS Secret Key", site: "https://console.ncloud.com", state: "미등록" },
    ],
    manual: "NCP SENS 프로젝트 생성 후 인증키 발급, 발신번호 등록.",
    checklist: [{ text: "SENS 프로젝트 생성", done: false }, { text: "발신번호 등록", done: false }, { text: "인증키 입력", done: false }],
    blocks: "알림 발송",
  },
  {
    id: "T-055", domain: "vehicles", title: "NCP OCR API 키 발급", phase: "외부 키 발급", status: "대기",
    purpose: "차량 서류 OCR을 위한 NCP CLOVA OCR 키를 발급해요.",
    keys: [{ name: "NCP_OCR_SECRET", desc: "NCP CLOVA OCR Secret", site: "https://console.ncloud.com", state: "미등록" }],
    manual: "CLOVA OCR 도메인 생성 후 Secret 발급.",
    checklist: [{ text: "OCR 도메인 생성", done: false }, { text: "Secret 입력", done: false }],
    blocks: "서류 검수 자동화",
  },
  {
    id: "T-057", domain: "infra", title: "Vercel 등록", phase: "외부 키 발급", status: "진행 중",
    purpose: "프론트엔드 배포를 위한 Vercel 프로젝트를 연결해요.",
    keys: [{ name: "VERCEL_TOKEN", desc: "Vercel 배포 토큰", site: "https://vercel.com/account/tokens", state: "등록됨" }],
    manual: "Vercel 프로젝트 생성 후 GitHub 연결, 배포 토큰 발급.",
    checklist: [{ text: "Vercel 프로젝트 생성", done: true }, { text: "GitHub 저장소 연결", done: true }, { text: "배포 토큰 입력", done: false }],
    blocks: "프론트엔드 배포",
  },
  {
    id: "T-065", domain: "release", title: "production 배포 승인", phase: "릴리즈", status: "대기",
    purpose: "최종 산출물을 production에 배포하도록 사람이 최종 승인해요.",
    keys: [],
    manual: "필수 Check 통과 확인 후 production 배포를 승인.",
    checklist: [{ text: "필수 Check 통과 확인", done: false }, { text: "배포 승인", done: false }],
    blocks: "릴리스 생성",
  },
]

// ===== 빌드 보드 (단계 × 도메인) =====
// 스키마 → 프론트엔드 → 백엔드 → 외부 키 발급 → QA → 릴리즈 순으로 빌드해요.
// 각 작업이 자동/AI/사람 중 누구의 몫인지 태그로 구분해, 사람은 자기 것만 신경 쓰면 돼요.
export const BUILD_PHASES = ["스키마", "프론트엔드", "백엔드", "외부 키 발급", "QA", "릴리즈"]
export const BUILD_DOMAINS = ["admin", "auth", "chat", "vehicles", "matching", "notification", "infra", "release"]

export type BuildRole = "자동" | "ai" | "사람"
export type BuildTask = { id: string; domain: string; phase: string; title: string; role: BuildRole; status: "대기" | "진행 중" | "완료" }

export const BUILD_TASKS: BuildTask[] = [
  // 스키마 (자동 생성)
  { id: "T-001", domain: "auth", phase: "스키마", title: "사용자·권한 테이블", role: "자동", status: "완료" },
  { id: "T-007", domain: "chat", phase: "스키마", title: "채팅·신고 테이블", role: "자동", status: "완료" },
  { id: "T-002", domain: "vehicles", phase: "스키마", title: "차량·매물 테이블", role: "자동", status: "완료" },
  // 프론트엔드 (AI 구현)
  { id: "T-026", domain: "admin", phase: "프론트엔드", title: "관리자 대시보드 화면", role: "ai", status: "진행 중" },
  { id: "T-027", domain: "admin", phase: "프론트엔드", title: "회원 관리 화면", role: "ai", status: "대기" },
  { id: "T-028", domain: "admin", phase: "프론트엔드", title: "차량 검수 관리 화면", role: "ai", status: "대기" },
  { id: "T-009", domain: "auth", phase: "프론트엔드", title: "로그인 화면", role: "ai", status: "완료" },
  { id: "T-010", domain: "auth", phase: "프론트엔드", title: "회원가입 화면", role: "ai", status: "진행 중" },
  { id: "T-011", domain: "auth", phase: "프론트엔드", title: "인증 콜백 화면", role: "ai", status: "대기" },
  { id: "T-024", domain: "chat", phase: "프론트엔드", title: "채팅 목록 화면", role: "ai", status: "대기" },
  { id: "T-025", domain: "chat", phase: "프론트엔드", title: "채팅방 화면", role: "ai", status: "대기" },
  // 백엔드 (AI 구현)
  { id: "T-045", domain: "admin", phase: "백엔드", title: "회원 관리 API", role: "ai", status: "진행 중" },
  { id: "T-046", domain: "admin", phase: "백엔드", title: "차량 검수 API", role: "ai", status: "대기" },
  { id: "T-047", domain: "admin", phase: "백엔드", title: "딜러 승인 API", role: "ai", status: "대기" },
  { id: "T-030", domain: "auth", phase: "백엔드", title: "카카오 세션 처리", role: "ai", status: "대기" },
  { id: "T-031", domain: "auth", phase: "백엔드", title: "권한 가드", role: "ai", status: "대기" },
  { id: "T-043", domain: "chat", phase: "백엔드", title: "채팅 메시지 처리", role: "ai", status: "대기" },
  // 외부 키 발급 (사람 전용 = 휴먼태스크)
  { id: "T-056", domain: "auth", phase: "외부 키 발급", title: "카카오 OAuth 등록", role: "사람", status: "대기" },
  { id: "T-052", domain: "vehicles", phase: "외부 키 발급", title: "CODEF API 키 발급", role: "사람", status: "대기" },
  { id: "T-053", domain: "matching", phase: "외부 키 발급", title: "네이버 지도 API 등록", role: "사람", status: "대기" },
  { id: "T-057", domain: "infra", phase: "외부 키 발급", title: "Vercel 등록", role: "사람", status: "진행 중" },
  // QA (자동)
  { id: "T-062", domain: "admin", phase: "QA", title: "플랫폼 관리 E2E", role: "자동", status: "대기" },
  { id: "T-063", domain: "auth", phase: "QA", title: "인증 플로우 E2E", role: "자동", status: "대기" },
  // 릴리즈 (사람 승인)
  { id: "T-065", domain: "release", phase: "릴리즈", title: "production 배포", role: "사람", status: "대기" },
]

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
