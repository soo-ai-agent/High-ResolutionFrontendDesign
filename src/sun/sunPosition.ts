/**
 * 태양 위치·일출일몰 계산 (외부 의존성 없는 순수 천문 계산).
 *
 * SunCalc(suncalc.js, Astronomy Answers 공식 기반)와 동일한 저정밀 태양 궤도 근사를 사용한다.
 * 오차는 방위각·고도각 기준 0.5도 미만으로, 그늘 예측(건물 그림자 근사)에 충분하다.
 */

const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const J1970 = 2440588
const J2000 = 2451545
/** 지구 자전축 기울기(황도 경사). */
const OBLIQUITY = RAD * 23.4397

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS)
}

function toDays(date: Date): number {
  return toJulian(date) - J2000
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d)
}

function eclipticLongitude(m: number): number {
  const center = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m))
  const perihelion = RAD * 102.9372
  return m + center + perihelion + Math.PI
}

function declination(l: number): number {
  return Math.asin(Math.sin(l) * Math.sin(OBLIQUITY))
}

function rightAscension(l: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l))
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw
}

export interface SunPosition {
  /** 태양 방위각(도). 나침반 기준 북=0, 동=90, 남=180, 서=270. */
  azimuthDeg: number
  /** 태양 고도각(도). 0 이하이면 지평선 아래(밤·박명). */
  altitudeDeg: number
}

/** 주어진 시각·위치의 태양 방위각/고도각. */
export function getSunPosition(date: Date, lat: number, lng: number): SunPosition {
  const lw = RAD * -lng
  const phi = RAD * lat
  const d = toDays(date)

  const m = solarMeanAnomaly(d)
  const l = eclipticLongitude(m)
  const dec = declination(l)
  const ra = rightAscension(l)
  const h = siderealTime(d, lw) - ra

  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h))
  // 천문 관례(남=0)의 방위각을 나침반 관례(북=0 시계방향)로 변환한다.
  const azimuthFromSouth = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  const azimuthDeg = (azimuthFromSouth / RAD + 180 + 360) % 360

  return { azimuthDeg, altitudeDeg: altitude / RAD }
}

export interface SunTimes {
  /** 일출. 극야/백야 등으로 없으면 null. */
  sunrise: Date | null
  /** 일몰. 극야/백야 등으로 없으면 null. */
  sunset: Date | null
  /** 남중(태양이 가장 높은 시각). */
  solarNoon: Date
}

const J0 = 0.0009
/** 일출·일몰 판정 고도(대기 굴절 + 태양 반지름 보정, 표준값 -0.833도). */
const SUNRISE_ALTITUDE = -0.833 * RAD

function julianCycle(d: number, lw: number): number {
  return Math.round(d - J0 - lw / (2 * Math.PI))
}

function approxTransit(ht: number, lw: number, n: number): number {
  return J0 + (ht + lw) / (2 * Math.PI) + n
}

function solarTransitJ(ds: number, m: number, l: number): number {
  return J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l)
}

/** 해당 날짜(현지 기준)의 일출·일몰·남중 시각. */
export function getSunTimes(date: Date, lat: number, lng: number): SunTimes {
  const lw = RAD * -lng
  const phi = RAD * lat
  const d = toDays(date)

  const n = julianCycle(d, lw)
  const ds = approxTransit(0, lw, n)
  const m = solarMeanAnomaly(ds)
  const l = eclipticLongitude(m)
  const dec = declination(l)
  const jNoon = solarTransitJ(ds, m, l)
  const solarNoon = fromJulian(jNoon)

  const cosH =
    (Math.sin(SUNRISE_ALTITUDE) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  if (cosH < -1 || cosH > 1) {
    return { sunrise: null, sunset: null, solarNoon }
  }
  const w = Math.acos(cosH)
  const jSet = solarTransitJ(approxTransit(w, lw, n), m, l)
  const jRise = jNoon - (jSet - jNoon)
  return { sunrise: fromJulian(jRise), sunset: fromJulian(jSet), solarNoon }
}

/** 방위각(도)을 8방위 한글 라벨로. 예: 202도 → "남남서" 대신 8방위 "남서". */
export function azimuthToKorean(azimuthDeg: number): string {
  const names = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"]
  return names[Math.round(((azimuthDeg % 360) + 360) % 360 / 45) % 8]
}
