import type { LatLng } from "../types/geo"
import { loadKakaoServices } from "../utils/kakaoMaps"

/**
 * 목적지 장소검색.
 * Kakao Maps SDK(services.Places)가 준비되면 실제 키워드 검색을, 키 미설정/로드 실패면
 * 서울 주요 지점 프리셋에서 이름 부분일치로 폴백한다(키 없이도 앱 흐름 체험 가능).
 */

export interface PlaceResult extends LatLng {
  name: string
  address: string
  /** 실검색(kakao)인지 프리셋 폴백(preset)인지. */
  source: "kakao" | "preset"
}

/** 키 미설정 시 폴백용 서울 주요 지점(실좌표). */
export const PRESET_PLACES: Omit<PlaceResult, "source">[] = [
  { name: "서울시청", address: "서울 중구 세종대로 110", lat: 37.5663, lng: 126.9779 },
  { name: "광화문광장", address: "서울 종로구 세종로", lat: 37.5725, lng: 126.9769 },
  { name: "경복궁", address: "서울 종로구 사직로 161", lat: 37.5796, lng: 126.977 },
  { name: "서울역", address: "서울 중구 한강대로 405", lat: 37.5547, lng: 126.9707 },
  { name: "남산서울타워", address: "서울 용산구 남산공원길 105", lat: 37.5512, lng: 126.9882 },
  { name: "동대문디자인플라자", address: "서울 중구 을지로 281", lat: 37.5665, lng: 127.0092 },
  { name: "강남역", address: "서울 강남구 강남대로 지하 396", lat: 37.4979, lng: 127.0276 },
  { name: "여의도한강공원", address: "서울 영등포구 여의동로 330", lat: 37.5284, lng: 126.9337 },
  { name: "홍대입구역", address: "서울 마포구 양화로 지하 160", lat: 37.5571, lng: 126.9245 },
  { name: "잠실 롯데월드타워", address: "서울 송파구 올림픽로 300", lat: 37.5126, lng: 127.1026 },
]

function searchPresets(keyword: string): PlaceResult[] {
  const trimmed = keyword.trim()
  if (!trimmed) {
    return []
  }
  return PRESET_PLACES.filter(
    (place) => place.name.includes(trimmed) || place.address.includes(trimmed),
  ).map((place) => ({ ...place, source: "preset" }))
}

function parseCoord(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

/** 키워드 장소검색. 결과 없음은 빈 배열(에러 아님). */
export async function searchPlaces(keyword: string): Promise<PlaceResult[]> {
  const trimmed = keyword.trim()
  if (!trimmed) {
    return []
  }

  const services = await loadKakaoServices()
  if (!services) {
    return searchPresets(trimmed)
  }

  const places = new services.Places()
  return new Promise((resolve) => {
    places.keywordSearch(
      trimmed,
      (result, status) => {
        if (status !== "OK") {
          resolve(status === "ZERO_RESULT" ? [] : searchPresets(trimmed))
          return
        }
        const parsed: PlaceResult[] = []
        for (const place of result) {
          const lat = parseCoord(place.y)
          const lng = parseCoord(place.x)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue
          }
          parsed.push({
            name: place.place_name,
            address: place.road_address_name || place.address_name || "",
            lat,
            lng,
            source: "kakao",
          })
        }
        resolve(parsed)
      },
      { size: 8 },
    )
  })
}
