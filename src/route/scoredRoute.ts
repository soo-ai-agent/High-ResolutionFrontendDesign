import type { RouteCandidate } from "./planShadeRoutes"
import type { RouteShade } from "../shade/shadeModel"

/** 후보 경로 + 특정 시각 기준 그늘 점수. 화면 계층이 시각 변경마다 재계산해 만든다. */
export interface ScoredRoute {
  candidate: RouteCandidate
  shade: RouteShade
}

/** 그늘 비율 최대(동률이면 소요 시간 짧은 쪽) 후보 id. */
export function bestShadeRouteId(scored: ScoredRoute[]): string | null {
  let best: ScoredRoute | null = null
  for (const route of scored) {
    if (
      best === null ||
      route.shade.shadeRatio > best.shade.shadeRatio + 1e-9 ||
      (Math.abs(route.shade.shadeRatio - best.shade.shadeRatio) <= 1e-9 &&
        route.candidate.timeS < best.candidate.timeS)
    ) {
      best = route
    }
  }
  return best ? best.candidate.id : null
}

/** 소요 시간 최소 후보 id. */
export function fastestRouteId(scored: ScoredRoute[]): string | null {
  let fastest: ScoredRoute | null = null
  for (const route of scored) {
    if (fastest === null || route.candidate.timeS < fastest.candidate.timeS) {
      fastest = route
    }
  }
  return fastest ? fastest.candidate.id : null
}
