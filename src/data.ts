// 프론트엔드용 데이터 모듈.
//
// 실제 데이터 값은 서버가 소유해요(src/data.source.ts → /api/bootstrap).
// 화면은 여기의 export를 그대로 import하고, 앱 부팅 시 hydrateData()가
// 서버에서 받은 값으로 아래 배열/객체를 "제자리(in-place)"로 채워요.
// (ES 모듈의 라이브 바인딩 + 참조 공유 덕분에 화면 코드는 수정하지 않아도 돼요.)

import type * as S from "./data.source"

// 타입은 서버 소스에서 그대로 재-export 해요.
export type {
  Role,
  ProjectRepo,
  ProjectItem,
  Phase,
  TddPhase,
  Task,
  Ambiguity,
  InterviewQuestion,
  ExternalKey,
  HumanTask,
  BuildRole,
  BuildTask,
  PipelineStage,
} from "./data.source"

// ---- 값 (부팅 시 서버 데이터로 채워짐) ----
export const REPO: any = {}
export const PROJECT: any = {}
export const INTERVIEW_BACKLOG: any = {}
export const INTERVIEW_SPEC: { title: string; api: string; fields: { k: string; v: string }[]; acceptance: string[] } = { title: "", api: "", fields: [], acceptance: [] }

export const PROJECT_REPOS: any[] = []
export const PROJECTS: S.ProjectItem[] = []
export const PHASES: S.Phase[] = []
export const PLANNING_FLOW: any[] = []
export const OVERVIEW_SUMMARY: any[] = []
export const PIPELINE: any[] = []
export const RECENT_RUNS: any[] = []
export const CHECKLIST: any[] = []
export const REPOS: any[] = []
export const TASK_COLUMNS: string[] = []
export const TASKS: S.Task[] = []
export const PRS: any[] = []
export const PR_CHECKS: any[] = []
export const RUNS: any[] = []
export const RUN_STEPS: any[] = []
export const SCREENS: { group: string; items: { id: string; name: string; route: string; domain: string; design: string; fe: string; api: string; test: string; tasks: number }[] }[] = []
export const CRITIC_SCORES: any[] = []
export const CRITIC_ISSUES: any[] = []
export const MANUAL_TASKS: any[] = []
export const SECRETS: any[] = []
export const TESTS_SUMMARY: any[] = []
export const TEST_CASES: any[] = []
export const RELEASES: any[] = []
export const SOURCES: any[] = []
export const AGENTS: any[] = []
export const INTERVIEW_AMBIGUITIES: S.Ambiguity[] = []
export const INTERVIEW_QUESTIONS: S.InterviewQuestion[] = []
export const BUILD_PLUGINS: any[] = []
export const AUTOMATION: any[] = []
export const HUMAN_TASKS: S.HumanTask[] = []
export const BUILD_PHASES: string[] = []
export const BUILD_DOMAINS: string[] = []
export const BUILD_TASKS: S.BuildTask[] = []
export const ACTOR_SUMMARY: { key: "ai" | "auto" | "human"; title: string; icon: string; items: string[] }[] = []
export const PIPELINE_STAGES: S.PipelineStage[] = []
export const FUTURE_INTEGRATION: any[] = []

// ---- 하이드레이션 ----
function fill(target: any, src: any) {
  if (Array.isArray(target)) {
    target.length = 0
    if (Array.isArray(src)) target.push(...src)
  } else if (target && typeof target === "object") {
    for (const k of Object.keys(target)) delete target[k]
    if (src) Object.assign(target, src)
  }
}

/** 서버에서 받은 부트스트랩 데이터로 위의 export를 제자리에서 채워요. */
export function hydrateData(d: Record<string, any> | null | undefined) {
  if (!d) return
  fill(REPO, d.REPO)
  fill(PROJECT, d.PROJECT)
  fill(INTERVIEW_BACKLOG, d.INTERVIEW_BACKLOG)
  fill(INTERVIEW_SPEC, d.INTERVIEW_SPEC)
  fill(PROJECT_REPOS, d.PROJECT_REPOS)
  fill(PROJECTS, d.PROJECTS)
  fill(PHASES, d.PHASES)
  fill(PLANNING_FLOW, d.PLANNING_FLOW)
  fill(OVERVIEW_SUMMARY, d.OVERVIEW_SUMMARY)
  fill(PIPELINE, d.PIPELINE)
  fill(RECENT_RUNS, d.RECENT_RUNS)
  fill(CHECKLIST, d.CHECKLIST)
  fill(REPOS, d.REPOS)
  fill(TASK_COLUMNS, d.TASK_COLUMNS)
  fill(TASKS, d.TASKS)
  fill(PRS, d.PRS)
  fill(PR_CHECKS, d.PR_CHECKS)
  fill(RUNS, d.RUNS)
  fill(RUN_STEPS, d.RUN_STEPS)
  fill(SCREENS, d.SCREENS)
  fill(CRITIC_SCORES, d.CRITIC_SCORES)
  fill(CRITIC_ISSUES, d.CRITIC_ISSUES)
  fill(MANUAL_TASKS, d.MANUAL_TASKS)
  fill(SECRETS, d.SECRETS)
  fill(TESTS_SUMMARY, d.TESTS_SUMMARY)
  fill(TEST_CASES, d.TEST_CASES)
  fill(RELEASES, d.RELEASES)
  fill(SOURCES, d.SOURCES)
  fill(AGENTS, d.AGENTS)
  fill(INTERVIEW_AMBIGUITIES, d.INTERVIEW_AMBIGUITIES)
  fill(INTERVIEW_QUESTIONS, d.INTERVIEW_QUESTIONS)
  fill(BUILD_PLUGINS, d.BUILD_PLUGINS)
  fill(AUTOMATION, d.AUTOMATION)
  fill(HUMAN_TASKS, d.HUMAN_TASKS)
  fill(BUILD_PHASES, d.BUILD_PHASES)
  fill(BUILD_DOMAINS, d.BUILD_DOMAINS)
  fill(BUILD_TASKS, d.BUILD_TASKS)
  fill(ACTOR_SUMMARY, d.ACTOR_SUMMARY)
  fill(PIPELINE_STAGES, d.PIPELINE_STAGES)
  fill(FUTURE_INTEGRATION, d.FUTURE_INTEGRATION)
}
