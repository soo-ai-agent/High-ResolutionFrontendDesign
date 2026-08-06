import type { LatLng } from "../types/geo"
import { fetchTmapPedestrianRoutes, getTmapAppKey, TMAP_SEARCH_OPTION_LABEL } from "./tmap"
import { buildMockRoutes } from "./mockRoutes"

/**
 * 그늘 경로 후보 수집 오케스트레이션.
 *
 * Tmap AppKey가 있으면 실제 보행자 경로 후보(추천/대로우선/최단/계단제외)를,
 * 없거나 호출이 실패하면 데모(격자) 후보를 반환한다. 그늘 점수는 시각(time)에
 * 의존하므로 여기서 계산하지 않고 화면 계층에서 scoreRouteShade로 계산한다
 * (시간 슬라이더 이동 시 재호출 없이 순수 재계산).
 */

export interface RouteCandidate {
  id: string
  label: string
  path: LatLng[]
  distanceM: number
  timeS: number
  source: "tmap" | "mock"
}

export interface PlanResult {
  candidates: RouteCandidate[]
  /** 실경로(tmap)인지 데모(mock)인지 — 화면에서 정직하게 배지로 표기한다. */
  source: "tmap" | "mock"
}

export async function planRouteCandidates(
  origin: LatLng,
  destination: LatLng & { name?: string },
  signal?: AbortSignal,
): Promise<PlanResult> {
  if (getTmapAppKey()) {
    try {
      const routes = await fetchTmapPedestrianRoutes(origin, destination, ["0", "4", "10", "30"], signal)
      return {
        source: "tmap",
        candidates: routes.map((route) => ({
          id: `tmap-${route.searchOption}`,
          label: TMAP_SEARCH_OPTION_LABEL[route.searchOption],
          path: route.path,
          distanceM: route.distanceM,
          timeS: route.timeS,
          source: "tmap",
        })),
      }
    } catch {
      // 실경로 실패 시 데모 경로로 폴백 — 아래에서 source: 'mock'으로 정직하게 알린다.
    }
  }

  const mockRoutes = buildMockRoutes(origin, destination)
  return {
    source: "mock",
    candidates: mockRoutes.map((route, index) => ({
      id: `mock-${index}`,
      label: route.label,
      path: route.path,
      distanceM: route.distanceM,
      timeS: route.timeS,
      source: "mock",
    })),
  }
}
