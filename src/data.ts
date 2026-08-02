// 프론트엔드용 데이터 모듈.
//
// 실제 데이터 값은 서버가 소유해요(src/data.source.ts → /api/bootstrap).
// 화면은 여기의 export를 그대로 import하고, 앱 부팅 시 hydrateData()가
// 서버에서 받은 값으로 아래 배열/객체를 "제자리(in-place)"로 채워요.
// (ES 모듈의 라이브 바인딩 + 참조 공유 덕분에 화면 코드는 수정하지 않아도 돼요.)

import type * as S from "./data.source"

// 타입은 서버 소스에서 그대로 재-export 해요.
export type { Role, ProjectRepo, ProjectItem, ExternalKey, HumanTask, PipelineStage } from "./data.source"

// ---- 값 (부팅 시 서버 데이터로 채워짐) ----
export const REPO: any = {}
export const PROJECT: any = {}
export const PROJECT_REPOS: any[] = []
export const PROJECTS: S.ProjectItem[] = []
export const BUILD_PHASES: string[] = []
export const BUILD_DOMAINS: string[] = []
export const HUMAN_TASKS: S.HumanTask[] = []
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
  fill(PROJECT_REPOS, d.PROJECT_REPOS)
  fill(PROJECTS, d.PROJECTS)
  fill(BUILD_PHASES, d.BUILD_PHASES)
  fill(BUILD_DOMAINS, d.BUILD_DOMAINS)
  fill(HUMAN_TASKS, d.HUMAN_TASKS)
  fill(ACTOR_SUMMARY, d.ACTOR_SUMMARY)
  fill(PIPELINE_STAGES, d.PIPELINE_STAGES)
  fill(FUTURE_INTEGRATION, d.FUTURE_INTEGRATION)
}
