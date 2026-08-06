import { useMemo } from "react"
import type { LatLng } from "../types/geo"
import { azimuthToKorean, getSunPosition, getSunTimes } from "../sun/sunPosition"
import { DEFAULT_BUILDING_HEIGHT_M } from "../shade/shadeModel"

interface SunPanelProps {
  at: Date
  location: LatLng
}

function formatTime(date: Date | null): string {
  if (!date) {
    return "—"
  }
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
}

/** 기준 시각·위치의 태양 상태 카드 — 방위 나침반, 고도, 그림자 방향/길이, 일출·일몰. */
export default function SunPanel({ at, location }: SunPanelProps) {
  const sun = useMemo(() => getSunPosition(at, location.lat, location.lng), [at, location])
  const times = useMemo(() => getSunTimes(at, location.lat, location.lng), [at, location])
  const isUp = sun.altitudeDeg > 0

  // 그림자는 태양 반대 방향으로 진다.
  const shadowAzimuthDeg = (sun.azimuthDeg + 180) % 360
  // 그림자 길이 배수 = 1/tan(고도). 고도가 낮을수록 길다.
  const shadowFactor = isUp ? 1 / Math.tan(sun.altitudeDeg * (Math.PI / 180)) : Infinity

  const compassSize = 96
  const radius = compassSize / 2 - 12
  const toPoint = (azimuthDeg: number, r: number) => {
    const rad = (azimuthDeg - 90) * (Math.PI / 180)
    return {
      x: compassSize / 2 + r * Math.cos(rad),
      y: compassSize / 2 + r * Math.sin(rad),
    }
  }
  const sunPoint = toPoint(sun.azimuthDeg, radius)
  const shadowPoint = toPoint(shadowAzimuthDeg, radius * 0.7)

  return (
    <div className="bg-surface rounded-(--radius-card) shadow-card border border-line p-4 flex items-center gap-4">
      {/* 나침반: 해 위치(●)와 그림자 방향(→) */}
      <svg width={compassSize} height={compassSize} viewBox={`0 0 ${compassSize} ${compassSize}`} className="shrink-0">
        <circle cx={compassSize / 2} cy={compassSize / 2} r={radius} fill="#f9fafb" stroke="#e5e8eb" strokeWidth="1.5" />
        {(["북", "동", "남", "서"] as const).map((label, index) => {
          const point = toPoint(index * 90, radius + 7)
          return (
            <text key={label} x={point.x} y={point.y + 3} textAnchor="middle" fontSize="9" fill="#8b95a1" fontWeight="600">
              {label}
            </text>
          )
        })}
        {isUp && (
          <>
            <line
              x1={compassSize / 2}
              y1={compassSize / 2}
              x2={shadowPoint.x}
              y2={shadowPoint.y}
              stroke="#0f766e"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={sunPoint.x} cy={sunPoint.y} r="7" fill="#f59f00" stroke="#ffffff" strokeWidth="2" />
          </>
        )}
        {!isUp && (
          <text x={compassSize / 2} y={compassSize / 2 + 4} textAnchor="middle" fontSize="16">
            🌙
          </text>
        )}
      </svg>

      <div className="flex-1 min-w-0">
        {isUp ? (
          <>
            <div className="text-[15px] font-bold text-text-primary">
              해는 {azimuthToKorean(sun.azimuthDeg)}쪽 {Math.round(sun.altitudeDeg)}°
            </div>
            <div className="text-[13px] text-text-secondary mt-0.5">
              그림자는 <span className="font-semibold text-[#0f766e]">{azimuthToKorean(shadowAzimuthDeg)}쪽</span>으로,
              건물 높이의 {shadowFactor >= 10 ? "10배 이상" : `약 ${shadowFactor.toFixed(1)}배`}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {DEFAULT_BUILDING_HEIGHT_M}m 건물 기준 그림자{" "}
              {shadowFactor >= 10 ? "120m+" : `약 ${Math.round(DEFAULT_BUILDING_HEIGHT_M * shadowFactor)}m`} · 일출{" "}
              {formatTime(times.sunrise)} · 일몰 {formatTime(times.sunset)}
            </div>
          </>
        ) : (
          <>
            <div className="text-[15px] font-bold text-text-primary">지금은 해가 없어요</div>
            <div className="text-[13px] text-text-secondary mt-0.5">해가 진 시간대라 모든 경로가 그늘이에요.</div>
            <div className="text-xs text-text-tertiary mt-1">
              일출 {formatTime(times.sunrise)} · 일몰 {formatTime(times.sunset)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
