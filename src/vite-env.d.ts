/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Kakao Maps JS 앱키. 미설정이면 목 지도 폴백. */
  readonly VITE_KAKAO_JS_KEY?: string
  /** Tmap 보행자 경로 AppKey. 미설정이면 데모(격자) 경로 폴백. */
  readonly VITE_TMAP_APP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// ── Kakao Maps JS SDK 전역 타입(런타임 스크립트 로드, npm 패키지 아님 — bueongi에서 이식) ──

interface KakaoMapsLatLng {}

interface KakaoMapsLatLngBounds {
  extend(position: KakaoMapsLatLng): void
}

interface KakaoMap {
  relayout(): void
  setBounds(
    bounds: KakaoMapsLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void
  addControl(control: KakaoMapControl, position: KakaoControlPosition): void
  panTo(latlng: KakaoMapsLatLng): void
  setCenter(latlng: KakaoMapsLatLng): void
}

interface KakaoMapsEvent {
  addListener(target: unknown, type: string, handler: () => void): void
  removeListener(target: unknown, type: string, handler: () => void): void
}

interface KakaoMapControl {}
type KakaoControlPosition = string

interface KakaoMapOverlay {
  setMap(map: KakaoMap | null): void
}

type KakaoServicesStatus = "OK" | "ZERO_RESULT" | "ERROR"

/** 키워드 장소검색 결과 1건(Kakao Local). x=경도(lng), y=위도(lat) 문자열. */
interface KakaoPlace {
  place_name: string
  address_name?: string
  road_address_name?: string
  x: string
  y: string
}

interface KakaoPlaces {
  keywordSearch(
    keyword: string,
    callback: (result: KakaoPlace[], status: KakaoServicesStatus) => void,
    options?: { size?: number },
  ): void
}

interface KakaoGeocoder {
  coord2RegionCode(
    x: number,
    y: number,
    callback: (result: { region_type: string; code: string; address_name?: string }[], status: KakaoServicesStatus) => void,
  ): void
}

interface KakaoMapsServices {
  Geocoder: new () => KakaoGeocoder
  Places: new () => KakaoPlaces
  Status: { OK: KakaoServicesStatus; ZERO_RESULT: KakaoServicesStatus; ERROR: KakaoServicesStatus }
}

interface KakaoMapsApi {
  load(callback: () => void): void
  services?: KakaoMapsServices
  Map: new (
    container: HTMLElement,
    options: {
      center: KakaoMapsLatLng
      level: number
      draggable?: boolean
      scrollwheel?: boolean
    },
  ) => KakaoMap
  LatLng: new (lat: number, lng: number) => KakaoMapsLatLng
  LatLngBounds: new () => KakaoMapsLatLngBounds
  CustomOverlay: new (options: {
    position: KakaoMapsLatLng
    content: string | HTMLElement
    yAnchor?: number
    xAnchor?: number
    zIndex?: number
    clickable?: boolean
  }) => KakaoMapOverlay
  Polyline: new (options: {
    path: KakaoMapsLatLng[]
    strokeWeight: number
    strokeColor: string
    strokeOpacity: number
    strokeStyle: string
  }) => KakaoMapOverlay
  ZoomControl: new () => KakaoMapControl
  ControlPosition: Record<string, KakaoControlPosition>
  event: KakaoMapsEvent
}

interface KakaoMapsGlobal {
  maps: KakaoMapsApi
}

interface Window {
  kakao?: KakaoMapsGlobal
}
