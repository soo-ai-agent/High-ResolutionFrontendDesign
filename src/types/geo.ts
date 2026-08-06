/**
 * 앱 전역 공용 지오 타입. (bueongi에서 이식)
 * 필드명은 외부 API(Tmap/Kakao) 와이어 계약과 동형이라 리네임 금지.
 */

/** WGS84 좌표. */
export interface LatLng {
  lat: number
  lng: number
}
