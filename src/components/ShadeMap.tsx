import { useEffect, useMemo, useRef, useState } from "react"
import type { LatLng } from "../types/geo"
import { hasValidLatLng } from "../utils/geo"
import { loadKakaoMaps } from "../utils/kakaoMaps"
import { shadeFractionColor, type ShadeSegment } from "../shade/shadeModel"
import type { ScoredRoute } from "../route/scoredRoute"

interface ShadeMapProps {
  origin: LatLng | null
  destination: LatLng | null
  scored: ScoredRoute[]
  selectedId: string | null
}

/** 연속 구간을 같은 색 묶음(run)으로 합쳐 폴리라인 수를 줄인다. */
function groupSegmentsByColor(segments: ShadeSegment[]): { color: string; path: LatLng[] }[] {
  const runs: { color: string; path: LatLng[] }[] = []
  for (const segment of segments) {
    const color = shadeFractionColor(segment.shadeFraction)
    const last = runs[runs.length - 1]
    if (last && last.color === color) {
      last.path.push(segment.to)
    } else {
      runs.push({ color, path: [segment.from, segment.to] })
    }
  }
  return runs
}

/**
 * 그늘 경로 지도.
 * - VITE_KAKAO_JS_KEY가 있고 SDK 로드에 성공하면 실제 Kakao 지도 위에
 *   선택 경로를 그늘 등급 색(청록=그늘, 주황=햇빛) 구간으로 그린다.
 * - 키 미설정/로드 실패 시 간이 SVG 지도로 폴백해 화면이 깨지지 않는다.
 */
export default function ShadeMap({ origin, destination, scored, selectedId }: ShadeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<KakaoMap | null>(null)
  const overlaysRef = useRef<KakaoMapOverlay[]>([])
  const [ready, setReady] = useState(false)

  // 1) 지도 1회 초기화 (bueongi RouteMap 패턴 이식)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ok = await loadKakaoMaps()
      if (cancelled || !ok || !window.kakao?.maps || !containerRef.current) {
        return
      }
      const kakao = window.kakao
      const center = destination ?? origin ?? { lat: 37.5665, lng: 126.978 }
      const map = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: 5,
        draggable: true,
        scrollwheel: true,
      })
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
      mapRef.current = map
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
    // 초기 중심만 사용 — 이후 이동은 bounds 피팅이 담당한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) 경로·마커 갱신
  useEffect(() => {
    const kakao = window.kakao
    const map = mapRef.current
    if (!ready || !kakao?.maps || !map) {
      return
    }

    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = []

    const bounds = new kakao.maps.LatLngBounds()
    let hasPoint = false
    const extend = (point: LatLng) => {
      bounds.extend(new kakao.maps.LatLng(point.lat, point.lng))
      hasPoint = true
    }

    const addPolyline = (path: LatLng[], color: string, weight: number, opacity: number) => {
      const polyline = new kakao.maps.Polyline({
        path: path.map((p) => new kakao.maps.LatLng(p.lat, p.lng)),
        strokeWeight: weight,
        strokeColor: color,
        strokeOpacity: opacity,
        strokeStyle: "solid",
      })
      polyline.setMap(map)
      overlaysRef.current.push(polyline)
    }

    // 비선택 후보: 회색 얇은 선. 선택 후보: 그늘 등급 색 구간.
    for (const route of scored) {
      if (route.candidate.id === selectedId) {
        continue
      }
      addPolyline(route.candidate.path, "#94a3b8", 3, 0.55)
    }
    const selected = scored.find((route) => route.candidate.id === selectedId)
    if (selected) {
      for (const run of groupSegmentsByColor(selected.shade.segments)) {
        addPolyline(run.path, run.color, 6, 0.92)
      }
      selected.candidate.path.forEach(extend)
    }

    const addMarker = (point: LatLng, background: string, label: string) => {
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(point.lat, point.lng),
        content:
          `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;` +
          `border-radius:9999px;background:${background};border:3px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.35);` +
          `color:#fff;font-size:12px;font-weight:700;transform:translate(-50%,-50%)">${label}</div>`,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 10,
      })
      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    }

    if (origin && hasValidLatLng(origin)) {
      addMarker(origin, "#334155", "출")
      extend(origin)
    }
    if (destination && hasValidLatLng(destination)) {
      addMarker(destination, "#3182f6", "도")
      extend(destination)
    }

    if (hasPoint) {
      map.setBounds(bounds, 40, 40, 40, 40)
    }
  }, [ready, origin, destination, scored, selectedId])

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" style={{ display: ready ? "block" : "none" }} />
      {!ready && <FallbackMap origin={origin} destination={destination} scored={scored} selectedId={selectedId} />}
    </div>
  )
}

/**
 * Kakao 지도 미가용 시의 간이 SVG 지도(국소 평면 투영).
 * 실지도가 아님을 배지로 정직하게 알린다.
 */
function FallbackMap({ origin, destination, scored, selectedId }: ShadeMapProps) {
  const projected = useMemo(() => {
    const points: LatLng[] = []
    for (const route of scored) {
      points.push(...route.candidate.path)
    }
    if (origin) {
      points.push(origin)
    }
    if (destination) {
      points.push(destination)
    }
    if (points.length === 0) {
      return null
    }

    let minLat = Infinity
    let maxLat = -Infinity
    let minLng = Infinity
    let maxLng = -Infinity
    for (const point of points) {
      minLat = Math.min(minLat, point.lat)
      maxLat = Math.max(maxLat, point.lat)
      minLng = Math.min(minLng, point.lng)
      maxLng = Math.max(maxLng, point.lng)
    }
    const cosLat = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
    const spanX = Math.max((maxLng - minLng) * cosLat, 1e-6)
    const spanY = Math.max(maxLat - minLat, 1e-6)
    const width = 400
    const height = Math.min(400, Math.max(200, (spanY / spanX) * width))
    const pad = 0.08
    const toXY = (point: LatLng) => ({
      x: (pad + ((point.lng - minLng) * cosLat) / spanX * (1 - 2 * pad)) * width,
      y: (pad + (1 - (point.lat - minLat) / spanY) * (1 - 2 * pad)) * height,
    })
    return { width, height, toXY }
  }, [origin, destination, scored])

  if (!projected) {
    return <div className="absolute inset-0 bg-surface-2" />
  }
  const { width, height, toXY } = projected
  const selected = scored.find((route) => route.candidate.id === selectedId)

  const toPolylinePoints = (path: LatLng[]) =>
    path.map((point) => {
      const { x, y } = toXY(point)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(" ")

  return (
    <div className="absolute inset-0 bg-[#eef1f4]">
      {/* 격자 배경 — 간이 지도임을 시각적으로 드러낸다. */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(#d1d6db 1px, transparent 1px), linear-gradient(90deg, #d1d6db 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {scored
          .filter((route) => route.candidate.id !== selectedId)
          .map((route) => (
            <polyline
              key={route.candidate.id}
              points={toPolylinePoints(route.candidate.path)}
              fill="none"
              stroke="#b0b8c1"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {selected &&
          groupSegmentsByColor(selected.shade.segments).map((run, index) => (
            <polyline
              key={`run-${index}`}
              points={toPolylinePoints(run.path)}
              fill="none"
              stroke={run.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {origin && (
          <circle cx={toXY(origin).x} cy={toXY(origin).y} r="8" fill="#334155" stroke="#ffffff" strokeWidth="3" />
        )}
        {destination && (
          <circle cx={toXY(destination).x} cy={toXY(destination).y} r="8" fill="#3182f6" stroke="#ffffff" strokeWidth="3" />
        )}
      </svg>
      <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
        <span className="rounded-full bg-white/90 border border-line px-3 py-1 text-[11px] font-medium text-text-secondary shadow-card">
          간이 지도 (Kakao 지도 키 미설정)
        </span>
      </div>
    </div>
  )
}
