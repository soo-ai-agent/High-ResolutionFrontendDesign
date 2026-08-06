import type { LatLng } from "../types/geo"
import { haversineMeters, segmentBearingDeg } from "../utils/geo"
import { getSunPosition, type SunPosition } from "../sun/sunPosition"

/**
 * 도심 협곡(urban canyon) 그늘 근사 모델.
 *
 * 건물 실측 높이 데이터 없이, "길 양쪽에 건물이 늘어선 도심 거리"를 가정해
 * 태양 고도·방위와 거리(구간) 진행 방향의 상대각으로 구간별 그늘 비율을 추정한다.
 *
 * 기하: 태양 쪽 건물이 드리우는 그림자의 수평 길이 = H / tan(고도).
 * 이 그림자가 길을 가로질러 덮는 폭 = 그림자 길이 × |sin(태양 방위 − 길 방위)|.
 * (길이 태양 방위와 평행하면 그림자가 길을 따라만 지고, 수직이면 최대로 덮는다.)
 * 그늘 비율 = min(1, 가로 덮는 폭 / 길 폭). 태양이 지평선 아래면 전 구간 그늘(=1).
 */

const RAD = Math.PI / 180

/** 기본 건물 높이(m) — 4층 안팎 한국 도심 이면도로의 보수적 가정값. */
export const DEFAULT_BUILDING_HEIGHT_M = 12
/** 기본 길 폭(m) — 왕복 2차로 + 양측 보도. */
export const DEFAULT_STREET_WIDTH_M = 12

export interface ShadeModelOptions {
  buildingHeightM?: number
  streetWidthM?: number
}

/** 한 구간(길 방위 기준)의 그늘 비율(0=완전 양지, 1=완전 그늘). */
export function estimateSegmentShade(
  bearingDeg: number,
  sun: SunPosition,
  options: ShadeModelOptions = {},
): number {
  if (sun.altitudeDeg <= 0) {
    return 1
  }
  const buildingHeightM = options.buildingHeightM ?? DEFAULT_BUILDING_HEIGHT_M
  const streetWidthM = options.streetWidthM ?? DEFAULT_STREET_WIDTH_M

  const shadowLengthM = buildingHeightM / Math.tan(sun.altitudeDeg * RAD)
  const acrossStreetFactor = Math.abs(Math.sin((sun.azimuthDeg - bearingDeg) * RAD))
  const shadowAcrossM = shadowLengthM * acrossStreetFactor
  return Math.min(1, shadowAcrossM / streetWidthM)
}

export interface ShadeSegment {
  from: LatLng
  to: LatLng
  lengthM: number
  /** 이 구간의 그늘 비율(0~1). */
  shadeFraction: number
}

export interface RouteShade {
  segments: ShadeSegment[]
  /** 길이 가중 평균 그늘 비율(0~1). */
  shadeRatio: number
  lengthM: number
  /** 햇빛에 노출되는 거리(m). */
  sunExposedM: number
  /** 계산에 사용한 태양 위치. */
  sun: SunPosition
}

/** 경로 전체의 구간별 그늘과 길이 가중 그늘 비율을 계산한다. */
export function scoreRouteShade(
  path: LatLng[],
  at: Date,
  options: ShadeModelOptions = {},
): RouteShade {
  // 도보 경로(수 km) 안에서 태양 위치 차이는 무시 가능 — 경로 중간점 기준 1회만 계산한다.
  const mid = path[Math.floor(path.length / 2)] ?? { lat: 37.5665, lng: 126.978 }
  const sun = getSunPosition(at, mid.lat, mid.lng)

  const segments: ShadeSegment[] = []
  let lengthM = 0
  let shadedM = 0
  for (let i = 1; i < path.length; i += 1) {
    const from = path[i - 1]
    const to = path[i]
    const segLengthM = haversineMeters(from, to)
    if (segLengthM === 0) {
      continue
    }
    const shadeFraction = estimateSegmentShade(segmentBearingDeg(from, to), sun, options)
    segments.push({ from, to, lengthM: segLengthM, shadeFraction })
    lengthM += segLengthM
    shadedM += segLengthM * shadeFraction
  }

  const shadeRatio = lengthM > 0 ? shadedM / lengthM : 0
  return { segments, shadeRatio, lengthM, sunExposedM: lengthM - shadedM, sun }
}

/** 그늘 비율(0~1)을 지도 표시 색으로. 그늘=청록 계열, 뙤약볕=주황 계열. */
export function shadeFractionColor(fraction: number): string {
  if (fraction >= 0.75) {
    return "#0f766e"
  }
  if (fraction >= 0.5) {
    return "#14b8a6"
  }
  if (fraction >= 0.25) {
    return "#f59e0b"
  }
  return "#f97316"
}

/** 범례·문구용 그늘 등급 라벨. */
export function shadeRatioLabel(ratio: number): string {
  if (ratio >= 0.75) {
    return "거의 그늘"
  }
  if (ratio >= 0.5) {
    return "그늘 많음"
  }
  if (ratio >= 0.25) {
    return "햇빛 많음"
  }
  return "뙤약볕"
}
