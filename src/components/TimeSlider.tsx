interface TimeSliderProps {
  baseTime: Date
  offsetMin: number
  onChange: (offsetMin: number) => void
}

const MAX_OFFSET_MIN = 180
const STEP_MIN = 10

function formatClock(date: Date): string {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
}

/** 출발 시각 슬라이더 — 지금부터 +3시간까지 10분 단위로 그늘 예측 시점을 옮긴다. */
export default function TimeSlider({ baseTime, offsetMin, onChange }: TimeSliderProps) {
  const target = new Date(baseTime.getTime() + offsetMin * 60_000)

  return (
    <div className="bg-surface rounded-(--radius-card) shadow-card border border-line p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-text-secondary">출발 시각</span>
        <span className="text-[15px] font-bold text-text-primary tabular-nums">
          {offsetMin === 0 ? "지금 " : `+${offsetMin}분 · `}
          {formatClock(target)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_OFFSET_MIN}
        step={STEP_MIN}
        value={offsetMin}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="출발 시각 조절"
        className="w-full mt-3 accent-(--color-blue)"
      />
      <div className="flex justify-between text-[11px] text-text-tertiary mt-1">
        <span>지금</span>
        <span>+1시간</span>
        <span>+2시간</span>
        <span>+3시간</span>
      </div>
    </div>
  )
}
