import { describe, expect, it } from "vitest"
import {
  estimateSegmentShade,
  scoreRouteShade,
  shadeFractionColor,
  shadeRatioLabel,
} from "./shadeModel"

describe("estimateSegmentShade", () => {
  it("태양이 지평선 아래면 전 구간 그늘(=1)", () => {
    expect(estimateSegmentShade(90, { azimuthDeg: 180, altitudeDeg: -5 })).toBe(1)
  })

  it("길이 태양 방위와 평행하면 그늘이 0에 가깝다", () => {
    // 태양 남쪽(180도), 길도 남북(180도) — 그림자가 길을 따라 지므로 못 덮는다.
    const shade = estimateSegmentShade(180, { azimuthDeg: 180, altitudeDeg: 30 })
    expect(shade).toBeLessThan(0.01)
  })

  it("길이 태양 방위와 수직이면 그늘이 최대", () => {
    const parallel = estimateSegmentShade(180, { azimuthDeg: 180, altitudeDeg: 30 })
    const perpendicular = estimateSegmentShade(90, { azimuthDeg: 180, altitudeDeg: 30 })
    expect(perpendicular).toBeGreaterThan(parallel)
    // 고도 30도, 건물 12m → 그림자 약 20.8m ≥ 길 폭 12m → 완전 그늘.
    expect(perpendicular).toBe(1)
  })

  it("태양 고도가 높을수록(짧은 그림자) 그늘이 줄어든다", () => {
    const lowSun = estimateSegmentShade(90, { azimuthDeg: 180, altitudeDeg: 25 })
    const highSun = estimateSegmentShade(90, { azimuthDeg: 180, altitudeDeg: 75 })
    expect(highSun).toBeLessThan(lowSun)
  })

  it("건물이 높을수록 그늘이 늘어난다", () => {
    const low = estimateSegmentShade(90, { azimuthDeg: 180, altitudeDeg: 60 }, { buildingHeightM: 6 })
    const high = estimateSegmentShade(90, { azimuthDeg: 180, altitudeDeg: 60 }, { buildingHeightM: 30 })
    expect(high).toBeGreaterThan(low)
  })
})

describe("scoreRouteShade", () => {
  // 서울시청 근처 동서 방향 300m 직선 경로.
  const eastWestPath = [
    { lat: 37.5665, lng: 126.978 },
    { lat: 37.5665, lng: 126.9795 },
    { lat: 37.5665, lng: 126.981 },
  ]

  it("한밤 경로는 그늘 비율 100%", () => {
    const at = new Date("2026-08-06T15:00:00Z") // 00:00 KST
    const result = scoreRouteShade(eastWestPath, at)
    expect(result.shadeRatio).toBe(1)
    expect(result.sunExposedM).toBe(0)
  })

  it("한낮 동서 경로는 남북 경로보다 그늘이 많다(남쪽 태양의 그림자가 동서 길을 가로 덮음)", () => {
    const at = new Date("2026-08-06T03:30:00Z") // 12:30 KST, 태양 남쪽 고공
    const northSouthPath = [
      { lat: 37.5665, lng: 126.978 },
      { lat: 37.5678, lng: 126.978 },
      { lat: 37.5692, lng: 126.978 },
    ]
    const eastWest = scoreRouteShade(eastWestPath, at)
    const northSouth = scoreRouteShade(northSouthPath, at)
    expect(eastWest.shadeRatio).toBeGreaterThan(northSouth.shadeRatio)
  })

  it("구간 길이 합과 노출 거리가 정합한다", () => {
    const at = new Date("2026-08-06T03:30:00Z")
    const result = scoreRouteShade(eastWestPath, at)
    const segmentSum = result.segments.reduce((sum, s) => sum + s.lengthM, 0)
    expect(segmentSum).toBeCloseTo(result.lengthM, 6)
    expect(result.sunExposedM).toBeCloseTo(result.lengthM * (1 - result.shadeRatio), 6)
  })
})

describe("표시 헬퍼", () => {
  it("그늘 등급별 색과 라벨", () => {
    expect(shadeFractionColor(0.9)).toBe("#0f766e")
    expect(shadeFractionColor(0.6)).toBe("#14b8a6")
    expect(shadeFractionColor(0.3)).toBe("#f59e0b")
    expect(shadeFractionColor(0.1)).toBe("#f97316")
    expect(shadeRatioLabel(0.8)).toBe("거의 그늘")
    expect(shadeRatioLabel(0.1)).toBe("뙤약볕")
  })
})
