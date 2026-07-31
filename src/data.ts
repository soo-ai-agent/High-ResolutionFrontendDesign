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

export type Role = "human" | "ai" | "both"

// Repositories that belong to the single project.
export const PROJECT_REPOS = [
  { full: "sample-org / admin-web", purpose: "프론트엔드", branch: "main", progress: 71, tasks: 7, prs: 2, fails: 0, synced: true },
  { full: "sample-org / admin-api", purpose: "백엔드", branch: "main", progress: 58, tasks: 12, prs: 3, fails: 1, synced: true },
  { full: "sample-org / admin-infra", purpose: "인프라", branch: "main", progress: 40, tasks: 4, prs: 1, fails: 0, synced: false },
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
  { key: "prd", label: "PRD", status: "완료", owner: "both", ownerNote: "AI가 초안 · 사람이 승인" },
  { key: "ia", label: "IA·디자인", status: "완료", owner: "ai", ownerNote: "AI가 설계" },
  { key: "tasks", label: "작업 생성", status: "완료", owner: "ai", ownerNote: "AI가 작업 분해" },
  { key: "build", label: "구현", status: "실행 중", owner: "ai", ownerNote: "AI가 코드 구현" },
  { key: "verify", label: "검증", status: "검토 필요", owner: "ai", ownerNote: "AI가 테스트 · 사람이 확인" },
  { key: "deploy", label: "배포", status: "대기", owner: "human", ownerNote: "사람이 배포를 승인해요" },
  { key: "release", label: "릴리스", status: "대기", owner: "both", ownerNote: "AI가 정리 · 사람이 승인" },
]

// The planning-stage handoff sequence, shown on the overview so a user can
// follow who does what next, step by step.
export const PLANNING_FLOW: { step: string; owner: Role; action: string; state: "완료" | "진행 중" | "대기"; to: string }[] = [
  { step: "자료 등록", owner: "human", action: "문서·GitHub Issue를 추가", state: "완료", to: "sources" },
  { step: "자료 분석", owner: "ai", action: "요구사항·충돌을 자동 정리", state: "완료", to: "sources" },
  { step: "PRD 초안 생성", owner: "ai", action: "정리된 요구사항으로 PRD 작성", state: "완료", to: "prd" },
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
  { label: "미등록 Secret", value: "2건", tone: "warning", to: "manual-tasks" },
  { label: "Production 승인 대기", value: "1건", tone: "purple", to: "releases" },
]

export const REPOS = [
  { full: "sample-org / agent-workflow", visibility: "비공개", branch: "main", phase: "구현", progress: 68, tasks: 12, prs: 3, fails: 1, deploy: "Staging 배포 완료", updated: "3분 전", synced: true },
  { full: "sample-org / payments-core", visibility: "비공개", branch: "main", phase: "검증", progress: 82, tasks: 6, prs: 2, fails: 0, deploy: "Production 배포 완료", updated: "1시간 전", synced: true },
  { full: "sample-org / design-tokens", visibility: "공개", branch: "main", phase: "릴리스", progress: 100, tasks: 0, prs: 0, fails: 0, deploy: "Production 배포 완료", updated: "어제", synced: true },
  { full: "sample-org / notify-service", visibility: "비공개", branch: "develop", phase: "작업 생성", progress: 34, tasks: 21, prs: 1, fails: 2, deploy: "미배포", updated: "2일 전", synced: false },
  { full: "sample-org / docs-portal", visibility: "공개", branch: "main", phase: "PRD", progress: 12, tasks: 0, prs: 0, fails: 0, deploy: "미배포", updated: "3일 전", synced: true },
]

export const TASK_COLUMNS = ["초안", "계획 완료", "실행 준비", "구현 중", "PR 검토", "수정 필요", "완료"]

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
}

export const TASKS: Task[] = [
  { id: "T-045", title: "회원 목록 조회 API", domain: "backend", agent: "Backend Agent", risk: "중간", deps: "2/2 완료", screen: "ADM-002", issue: "#72", pr: "#83", check: "CI 실패", status: "PR 검토" },
  { id: "T-046", title: "회원 상세 화면 구현", domain: "frontend", agent: "Frontend Agent", risk: "낮음", deps: "1/1 완료", screen: "ADM-002", issue: "#73", pr: "#84", check: "CI 성공", status: "PR 검토" },
  { id: "T-047", title: "로그인 실패 흐름 처리", domain: "frontend", agent: "Frontend Agent", risk: "중간", deps: "0/1", screen: "SCR-101", issue: "#74", pr: "—", check: "—", status: "실행 준비" },
  { id: "T-048", title: "권한 미들웨어 추가", domain: "backend", agent: "Backend Agent", risk: "높음", deps: "1/2", screen: "—", issue: "#75", pr: "—", check: "—", status: "구현 중" },
  { id: "T-049", title: "콘텐츠 관리 목록 API", domain: "backend", agent: "Backend Agent", risk: "낮음", deps: "2/2 완료", screen: "ADM-003", issue: "#76", pr: "#85", check: "진행 중", status: "구현 중" },
  { id: "T-050", title: "이용약관 화면 마크업", domain: "frontend", agent: "Frontend Agent", risk: "낮음", deps: "완료", screen: "SCR-201", issue: "#77", pr: "—", check: "—", status: "계획 완료" },
  { id: "T-051", title: "E2E 로그인 테스트", domain: "test", agent: "Test Agent", risk: "낮음", deps: "1/1", screen: "SCR-101", issue: "#78", pr: "—", check: "—", status: "초안" },
  { id: "T-044", title: "세션 토큰 갱신 로직", domain: "backend", agent: "Backend Agent", risk: "중간", deps: "완료", screen: "—", issue: "#71", pr: "#80", check: "CI 성공", status: "완료" },
  { id: "T-043", title: "대시보드 카드 컴포넌트", domain: "frontend", agent: "Frontend Agent", risk: "낮음", deps: "완료", screen: "ADM-001", issue: "#70", pr: "#79", check: "CI 성공", status: "완료" },
]

export const PRS = [
  { num: "#83", title: "T-045 회원 목록 조회 API", task: "T-045", files: 7, risk: "중간", ci: "실패", ai: "경고 1", fixes: "1/2", mergeable: "차단", status: "수정 필요" },
  { num: "#84", title: "T-046 회원 상세 화면 구현", task: "T-046", files: 12, risk: "낮음", ci: "성공", ai: "통과", fixes: "0/2", mergeable: "병합 가능", status: "검토 중" },
  { num: "#85", title: "T-049 콘텐츠 관리 목록 API", task: "T-049", files: 4, risk: "낮음", ci: "진행 중", ai: "대기", fixes: "0/2", mergeable: "대기", status: "Draft" },
  { num: "#81", title: "T-041 알림 배너 컴포넌트", task: "T-041", files: 3, risk: "낮음", ci: "성공", ai: "통과", fixes: "0/2", mergeable: "병합 가능", status: "검토 중" },
]

export const PR_CHECKS = [
  { name: "spec-validation", status: "성공" },
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

export const RUN_STEPS = [
  { name: "Checkout", status: "완료", started: "09:58:02", dur: "4초" },
  { name: "의존성 검사", status: "완료", started: "09:58:06", dur: "38초" },
  { name: "Agent 실행", status: "완료", started: "09:58:44", dur: "9분 12초" },
  { name: "Test", status: "완료", started: "10:07:56", dur: "1분 20초" },
  { name: "PR 생성", status: "완료", started: "10:09:16", dur: "8초" },
  { name: "완료", status: "완료", started: "10:09:24", dur: "—" },
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
