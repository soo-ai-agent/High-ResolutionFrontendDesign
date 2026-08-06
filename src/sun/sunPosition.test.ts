import { describe, expect, it } from "vitest"
import { azimuthToKorean, getSunPosition, getSunTimes } from "./sunPosition"

// 서울시청 좌표.
const SEOUL = { lat: 37.5665, lng: 126.978 }

describe("getSunPosition", () => {
  it("여름 한낮(KST 12:30 무렵)의 서울은 태양이 남쪽 하늘 높이 떠 있다", () => {
    // 2026-08-06 12:30 KST = 03:30 UTC. 한국 하지 부근 남중 고도는 약 70도.
    const at = new Date("2026-08-06T03:30:00Z")
    const sun = getSunPosition(at, SEOUL.lat, SEOUL.lng)
    expect(sun.altitudeDeg).toBeGreaterThan(60)
    expect(sun.azimuthDeg).toBeGreaterThan(120)
    expect(sun.azimuthDeg).toBeLessThan(240)
  })

  it("자정에는 태양이 지평선 아래에 있다", () => {
    const at = new Date("2026-08-06T15:00:00Z") // 2026-08-07 00:00 KST
    const sun = getSunPosition(at, SEOUL.lat, SEOUL.lng)
    expect(sun.altitudeDeg).toBeLessThan(0)
  })

  it("아침에는 동쪽, 저녁에는 서쪽 하늘에 태양이 있다", () => {
    const morning = getSunPosition(new Date("2026-08-06T23:00:00Z"), SEOUL.lat, SEOUL.lng) // 08:00 KST
    const evening = getSunPosition(new Date("2026-08-06T09:00:00Z"), SEOUL.lat, SEOUL.lng) // 18:00 KST
    expect(morning.azimuthDeg).toBeGreaterThan(45)
    expect(morning.azimuthDeg).toBeLessThan(135)
    expect(evening.azimuthDeg).toBeGreaterThan(225)
    expect(evening.azimuthDeg).toBeLessThan(315)
  })
})

describe("getSunTimes", () => {
  it("서울의 8월 일출·일몰이 상식 범위(KST 05~06시 / 19~20시)에 있다", () => {
    const times = getSunTimes(new Date("2026-08-06T03:00:00Z"), SEOUL.lat, SEOUL.lng)
    expect(times.sunrise).not.toBeNull()
    expect(times.sunset).not.toBeNull()
    const sunriseKstHour = (times.sunrise!.getUTCHours() + 9) % 24
    const sunsetKstHour = (times.sunset!.getUTCHours() + 9) % 24
    expect(sunriseKstHour).toBeGreaterThanOrEqual(5)
    expect(sunriseKstHour).toBeLessThanOrEqual(6)
    expect(sunsetKstHour).toBeGreaterThanOrEqual(19)
    expect(sunsetKstHour).toBeLessThanOrEqual(20)
  })

  it("일출은 일몰보다 앞선다", () => {
    const times = getSunTimes(new Date("2026-08-06T03:00:00Z"), SEOUL.lat, SEOUL.lng)
    expect(times.sunrise!.getTime()).toBeLessThan(times.solarNoon.getTime())
    expect(times.solarNoon.getTime()).toBeLessThan(times.sunset!.getTime())
  })
})

describe("azimuthToKorean", () => {
  it("나침반 방위를 8방위 한글로 바꾼다", () => {
    expect(azimuthToKorean(0)).toBe("북")
    expect(azimuthToKorean(90)).toBe("동")
    expect(azimuthToKorean(180)).toBe("남")
    expect(azimuthToKorean(270)).toBe("서")
    expect(azimuthToKorean(225)).toBe("남서")
    expect(azimuthToKorean(359)).toBe("북")
  })
})
