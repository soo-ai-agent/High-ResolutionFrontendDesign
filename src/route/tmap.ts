import type { LatLng } from "../types/geo"
import { isFiniteInRange, pathLengthMeters } from "../utils/geo"

/**
 * Tmap 보행자 경로 직접 호출 클라이언트. (bueongi에서 이식, axios→fetch로 경량화)
 *
 * - AppKey는 빌드 시 주입(VITE_TMAP_APP_KEY)되고 `appKey` 헤더로만 전달, 로그에 남기지 않는다.
 * - 응답 GeoJSON에서 LineString 좌표를 이어 붙여 경로 라인(LatLng[])과 거리/시간을 뽑는다.
 * - 후보 여러 개는 searchOption(추천/대로우선/최단/계단제외)을 달리한 병렬 호출로 만든다.
 */

export const TMAP_PEDESTRIAN_ENDPOINT = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1"

export type TmapSearchOption = "0" | "4" | "10" | "30"

export const TMAP_SEARCH_OPTION_LABEL: Record<TmapSearchOption, string> = {
  "0": "추천",
  "4": "대로우선",
  "10": "최단",
  "30": "계단제외",
}

export interface TmapRoute {
  searchOption: TmapSearchOption
  path: LatLng[]
  distanceM: number
  timeS: number
}

export function getTmapAppKey(): string {
  const key = import.meta.env.VITE_TMAP_APP_KEY
  return typeof key === "string" ? key : ""
}

interface TmapFeature {
  geometry?: { type?: string; coordinates?: unknown }
  properties?: Record<string, unknown>
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

/** Tmap GeoJSON에서 경로 라인·거리/시간을 파싱한다. */
export function parseTmapResponse(payload: unknown): { path: LatLng[]; distanceM: number; timeS: number } {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { features?: unknown }).features)) {
    throw new Error("Tmap 응답에 features 배열이 없습니다")
  }
  const features = (payload as { features: TmapFeature[] }).features
  const path: LatLng[] = []
  let distanceM = 0
  let timeS = 0

  for (const feature of features) {
    const props = feature.properties ?? {}
    // 총 거리/시간은 보통 첫 Point feature의 properties에 담긴다.
    if (isNonNegativeFiniteNumber(props.totalDistance) && distanceM === 0) {
      distanceM = props.totalDistance
    }
    if (isNonNegativeFiniteNumber(props.totalTime) && timeS === 0) {
      timeS = props.totalTime
    }

    const geom = feature.geometry
    if (geom?.type === "LineString" && Array.isArray(geom.coordinates)) {
      for (const c of geom.coordinates) {
        // GeoJSON: [lng, lat]
        if (Array.isArray(c) && isFiniteInRange(c[1], -90, 90) && isFiniteInRange(c[0], -180, 180)) {
          path.push({ lat: c[1] as number, lng: c[0] as number })
        }
      }
    }
  }

  if (path.length < 2) {
    throw new Error("Tmap 응답에서 경로 좌표를 찾지 못했습니다")
  }
  if (distanceM === 0) {
    distanceM = Math.round(pathLengthMeters(path))
  }
  return { path, distanceM, timeS }
}

function requireLatLng(value: LatLng, label: string): LatLng {
  if (!isFiniteInRange(value?.lat, -90, 90) || !isFiniteInRange(value?.lng, -180, 180)) {
    throw new Error(`Tmap 경로 요청에 유효한 ${label} 좌표가 필요합니다`)
  }
  return value
}

/** Tmap 보행자 경로 1건을 직접 호출한다. */
export async function fetchTmapPedestrianRoute(
  origin: LatLng,
  destination: LatLng & { name?: string },
  searchOption: TmapSearchOption,
  signal?: AbortSignal,
): Promise<TmapRoute> {
  const appKey = getTmapAppKey()
  if (!appKey) {
    throw new Error("Tmap AppKey가 설정되지 않았습니다(VITE_TMAP_APP_KEY)")
  }
  requireLatLng(origin, "origin")
  requireLatLng(destination, "destination")

  const response = await fetch(TMAP_PEDESTRIAN_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      appKey,
    },
    body: JSON.stringify({
      startX: String(origin.lng),
      startY: String(origin.lat),
      endX: String(destination.lng),
      endY: String(destination.lat),
      startName: encodeURIComponent("출발"),
      endName: encodeURIComponent(destination.name?.trim() || "목적지"),
      reqCoordType: "WGS84GEO",
      resCoordType: "WGS84GEO",
      searchOption,
    }),
    signal,
  })
  if (!response.ok) {
    throw new Error(`Tmap pedestrian route failed: ${response.status}`)
  }
  const parsed = parseTmapResponse(await response.json())
  return { searchOption, ...parsed }
}

/**
 * 후보 경로 여러 개를 searchOption별 병렬 호출로 만든다.
 * 일부 옵션이 실패해도 성공한 후보만 모아 반환(전부 실패 시에만 에러).
 * 동일 경로(거리+좌표수 동일) 후보는 중복 제거한다.
 */
export async function fetchTmapPedestrianRoutes(
  origin: LatLng,
  destination: LatLng & { name?: string },
  searchOptions: TmapSearchOption[] = ["0", "4", "10", "30"],
  signal?: AbortSignal,
): Promise<TmapRoute[]> {
  const settled = await Promise.allSettled(
    searchOptions.map((searchOption) => fetchTmapPedestrianRoute(origin, destination, searchOption, signal)),
  )

  const routes: TmapRoute[] = []
  const seen = new Set<number>()
  for (const result of settled) {
    if (result.status !== "fulfilled") {
      continue
    }
    const key = result.value.distanceM * 1000 + result.value.path.length
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    routes.push(result.value)
  }

  if (routes.length === 0) {
    const firstRejection = settled.find((r): r is PromiseRejectedResult => r.status === "rejected")
    throw firstRejection ? firstRejection.reason : new Error("Tmap 경로 후보를 가져오지 못했습니다")
  }
  return routes
}
