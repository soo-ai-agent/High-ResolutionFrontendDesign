import { shadeFractionColor, shadeRatioLabel } from "../shade/shadeModel"
import type { ScoredRoute } from "../route/scoredRoute"

interface RouteCardsProps {
  scored: ScoredRoute[]
  selectedId: string | null
  bestId: string | null
  fastestId: string | null
  onSelect: (id: string) => void
}

function formatDistance(distanceM: number): string {
  return distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${Math.round(distanceM)}m`
}

function formatDuration(timeS: number): string {
  const minutes = Math.max(1, Math.round(timeS / 60))
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`
}

/** 경로를 따라가는 그늘 프로필 띠 — 구간 길이 비례 폭 + 그늘 등급 색. */
function ShadeProfileBar({ route }: { route: ScoredRoute }) {
  const totalM = route.shade.lengthM
  if (totalM === 0) {
    return null
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full" aria-hidden>
      {route.shade.segments.map((segment, index) => (
        <div
          key={index}
          style={{
            width: `${(segment.lengthM / totalM) * 100}%`,
            backgroundColor: shadeFractionColor(segment.shadeFraction),
          }}
        />
      ))}
    </div>
  )
}

/** 후보 경로 카드 목록 — 그늘 비율·거리·시간 비교와 선택. */
export default function RouteCards({ scored, selectedId, bestId, fastestId, onSelect }: RouteCardsProps) {
  return (
    <div className="flex flex-col gap-2">
      {scored.map((route) => {
        const { candidate, shade } = route
        const isSelected = candidate.id === selectedId
        const shadePercent = Math.round(shade.shadeRatio * 100)
        return (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onSelect(candidate.id)}
            aria-pressed={isSelected}
            className={`w-full text-left bg-surface rounded-(--radius-card) border p-4 transition-colors ${
              isSelected ? "border-(--color-blue) bg-selected" : "border-line hover:bg-hover"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-text-primary">{candidate.label}</span>
              {candidate.id === bestId && (
                <span className="rounded-md bg-success-light text-success px-1.5 py-0.5 text-[11px] font-bold">
                  그늘 추천
                </span>
              )}
              {candidate.id === fastestId && (
                <span className="rounded-md bg-blue-light text-blue px-1.5 py-0.5 text-[11px] font-bold">최단</span>
              )}
              <span className="ml-auto text-[13px] text-text-secondary tabular-nums">
                {formatDistance(candidate.distanceM)} · {formatDuration(candidate.timeS)}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="text-xl font-extrabold tabular-nums" style={{ color: shadeFractionColor(shade.shadeRatio) }}>
                {shadePercent}%
              </span>
              <div className="flex-1">
                <ShadeProfileBar route={route} />
              </div>
            </div>
            <div className="mt-1.5 text-xs text-text-tertiary">
              {shadeRatioLabel(shade.shadeRatio)} · 햇빛 노출 약 {formatDistance(shade.sunExposedM)}
            </div>
          </button>
        )
      })}
    </div>
  )
}
