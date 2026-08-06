import { describe, expect, it } from "vitest"
import { hasValidLatLng, haversineMeters, pathLengthMeters, segmentBearingDeg } from "./geo"

describe("haversineMeters", () => {
  it("서울시청→서울역 거리가 약 1.3km", () => {
    const distance = haversineMeters({ lat: 37.5663, lng: 126.9779 }, { lat: 37.5547, lng: 126.9707 })
    expect(distance).toBeGreaterThan(1200)
    expect(distance).toBeLessThan(1600)
  })

  it("같은 점은 0", () => {
    expect(haversineMeters({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127 })).toBe(0)
  })
})

describe("pathLengthMeters", () => {
  it("좌표 2개 미만이면 0", () => {
    expect(pathLengthMeters([])).toBe(0)
    expect(pathLengthMeters([{ lat: 37.5, lng: 127 }])).toBe(0)
  })
})

describe("segmentBearingDeg", () => {
  it("북쪽 진행은 0도, 동쪽 진행은 90도", () => {
    const north = segmentBearingDeg({ lat: 37.5, lng: 127 }, { lat: 37.51, lng: 127 })
    const east = segmentBearingDeg({ lat: 37.5, lng: 127 }, { lat: 37.5, lng: 127.01 })
    expect(north).toBeCloseTo(0, 1)
    expect(east).toBeCloseTo(90, 1)
  })

  it("남쪽 진행은 180도, 서쪽 진행은 270도", () => {
    const south = segmentBearingDeg({ lat: 37.51, lng: 127 }, { lat: 37.5, lng: 127 })
    const west = segmentBearingDeg({ lat: 37.5, lng: 127.01 }, { lat: 37.5, lng: 127 })
    expect(south).toBeCloseTo(180, 1)
    expect(west).toBeCloseTo(270, 1)
  })
})

describe("hasValidLatLng", () => {
  it("유효 좌표만 통과", () => {
    expect(hasValidLatLng({ lat: 37.5, lng: 127 })).toBe(true)
    expect(hasValidLatLng({ lat: 91, lng: 127 })).toBe(false)
    expect(hasValidLatLng({ lat: 37.5, lng: 181 })).toBe(false)
    expect(hasValidLatLng(null)).toBe(false)
    expect(hasValidLatLng("37.5,127")).toBe(false)
  })
})
