import type { LatLng } from "../types/geo"

/**
 * 순수 지오메트리 유틸. (bueongi에서 이식 + 방위각 계산 추가)
 * 모든 거리는 미터(m) 단위 WGS84 기준. 도심 규모(수 km)에서는 국소 평면 근사로 충분하다.
 */

const EARTH_RADIUS_M = 6_371_000

/** 유한 숫자이면서 [min, max] 범위인지. 좌표 등 와이어 값 파싱의 공용 가드. */
export function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
}

/** 유효한 WGS84 좌표인지(위도 ±90 / 경도 ±180). */
export function hasValidLatLng(value: unknown): value is LatLng {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const point = value as Partial<Record<keyof LatLng, unknown>>
  return isFiniteInRange(point.lat, -90, 90) && isFiniteInRange(point.lng, -180, 180)
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** 두 WGS84 좌표 사이 대권거리(haversine, m). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 경로(폴리라인) 전체 길이(m). 좌표가 2개 미만이면 0. */
export function pathLengthMeters(path: LatLng[]): number {
  let total = 0
  for (let i = 1; i < path.length; i += 1) {
    total += haversineMeters(path[i - 1], path[i])
  }
  return total
}

/**
 * a→b 구간의 진행 방위각(도, 북=0 시계방향).
 * 도심 구간(수십~수백 m)이라 국소 평면 근사(경도차에 cos(lat) 보정)로 충분하다.
 */
export function segmentBearingDeg(a: LatLng, b: LatLng): number {
  const dx = (b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2))
  const dy = b.lat - a.lat
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI
  return (deg + 360) % 360
}
