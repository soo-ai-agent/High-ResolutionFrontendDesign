import type { LatLng } from "../types/geo"
import { pathLengthMeters } from "../utils/geo"
import type { TmapRoute } from "./tmap"

/**
 * Tmap AppKey 미설정/호출 실패 시의 데모 경로 생성기.
 *
 * 실도로 데이터 없이 출발→도착 사이를 격자 도시 가정으로 잇는 결정적 후보 3~4개를 만든다.
 * 각 후보는 진행 방위 구성이 서로 달라(직선/가로 우선/세로 우선/계단형) 같은 태양 위치에서도
 * 그늘 비율이 실제로 갈리므로, 그늘 예측·비교 UX를 키 없이도 체험할 수 있다.
 */

/** 보행 속도(m/s) — 도보 시간 추정용 표준값. */
const WALK_SPEED_MPS = 1.25

/** 두 점 사이를 stepM 간격으로 보간한 좌표열(양 끝 포함). */
function interpolate(a: LatLng, b: LatLng, stepM: number): LatLng[] {
  const lengthM = pathLengthMeters([a, b])
  const steps = Math.max(1, Math.round(lengthM / stepM))
  const points: LatLng[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    points.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })
  }
  return points
}

/** 경유점 목록을 이어 stepM 간격 좌표열로 만든다(중복 접점 제거). */
function throughWaypoints(waypoints: LatLng[], stepM = 30): LatLng[] {
  const path: LatLng[] = []
  for (let i = 1; i < waypoints.length; i += 1) {
    const segment = interpolate(waypoints[i - 1], waypoints[i], stepM)
    path.push(...(i === 1 ? segment : segment.slice(1)))
  }
  return path
}

/** 계단형(동서/남북 번갈아 진행) 경유점. */
function staircaseWaypoints(origin: LatLng, destination: LatLng, steps: number): LatLng[] {
  const waypoints: LatLng[] = [origin]
  for (let i = 1; i <= steps; i += 1) {
    const prev = waypoints[waypoints.length - 1]
    const lng = origin.lng + ((destination.lng - origin.lng) * i) / steps
    waypoints.push({ lat: prev.lat, lng })
    waypoints.push({ lat: origin.lat + ((destination.lat - origin.lat) * i) / steps, lng })
  }
  return waypoints
}

export interface MockRoute extends Omit<TmapRoute, "searchOption"> {
  label: string
}

/** 데모 후보 경로들 — 방위 구성이 서로 다른 결정적 격자 경로. */
export function buildMockRoutes(origin: LatLng, destination: LatLng): MockRoute[] {
  const corner1: LatLng = { lat: origin.lat, lng: destination.lng }
  const corner2: LatLng = { lat: destination.lat, lng: origin.lng }

  const candidates: { label: string; waypoints: LatLng[] }[] = [
    { label: "직선형", waypoints: [origin, destination] },
    { label: "동서 우선", waypoints: [origin, corner1, destination] },
    { label: "남북 우선", waypoints: [origin, corner2, destination] },
    { label: "계단형", waypoints: staircaseWaypoints(origin, destination, 4) },
  ]

  const routes: MockRoute[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const path = throughWaypoints(candidate.waypoints)
    const distanceM = Math.round(pathLengthMeters(path))
    if (distanceM === 0) {
      continue
    }
    // 출발·도착이 일직선상이면 동서/남북 우선이 직선형과 같아진다 — 중복 제거.
    // 거리·좌표수만으로는 기하가 다른 두 L자 경로를 같다고 오판하므로 중간점 좌표를 키에 포함한다.
    const mid = path[Math.floor(path.length / 2)]
    const key = `${distanceM}:${path.length}:${mid.lat.toFixed(5)}:${mid.lng.toFixed(5)}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    routes.push({ label: candidate.label, path, distanceM, timeS: Math.round(distanceM / WALK_SPEED_MPS) })
  }
  return routes
}
