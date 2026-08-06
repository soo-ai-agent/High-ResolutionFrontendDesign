import { useCallback, useEffect, useMemo, useState } from "react"
import type { LatLng } from "./types/geo"
import { getBrowserCurrentLocation, getCurrentLocationErrorDetail } from "./utils/currentLocation"
import { searchPlaces, PRESET_PLACES, type PlaceResult } from "./place/placeSearch"
import { planRouteCandidates, type PlanResult } from "./route/planShadeRoutes"
import { scoreRouteShade } from "./shade/shadeModel"
import { bestShadeRouteId, fastestRouteId, type ScoredRoute } from "./route/scoredRoute"
import ShadeMap from "./components/ShadeMap"
import SunPanel from "./components/SunPanel"
import TimeSlider from "./components/TimeSlider"
import RouteCards from "./components/RouteCards"

type OriginStatus = "loading" | "ok" | "error"

interface OriginState {
  status: OriginStatus
  point: LatLng | null
  /** "현재 위치" 또는 수동 선택한 지점 이름. */
  label: string
  error: { title: string; description: string } | null
}

const LEGEND: { color: string; label: string }[] = [
  { color: "#0f766e", label: "짙은 그늘" },
  { color: "#14b8a6", label: "그늘" },
  { color: "#f59e0b", label: "햇빛" },
  { color: "#f97316", label: "뙤약볕" },
]

export default function App() {
  // 현재 시각 — 30초마다 갱신해 "지금" 기준 태양 위치가 실시간을 따라간다.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // ── 출발지(현재 위치) ──
  const [origin, setOrigin] = useState<OriginState>({ status: "loading", point: null, label: "", error: null })

  const requestLocation = useCallback(() => {
    setOrigin({ status: "loading", point: null, label: "", error: null })
    getBrowserCurrentLocation()
      .then((point) => setOrigin({ status: "ok", point, label: "현재 위치", error: null }))
      .catch((error) =>
        setOrigin({ status: "error", point: null, label: "", error: getCurrentLocationErrorDetail(error) }),
      )
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  const pickManualOrigin = (place: (typeof PRESET_PLACES)[number]) => {
    setOrigin({ status: "ok", point: { lat: place.lat, lng: place.lng }, label: place.name, error: null })
  }

  // ── 목적지 검색 ──
  const [keyword, setKeyword] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [results, setResults] = useState<PlaceResult[]>([])
  const [destination, setDestination] = useState<PlaceResult | null>(null)

  const runSearch = async () => {
    if (!keyword.trim() || searching) {
      return
    }
    setSearching(true)
    setSearchDone(false)
    try {
      setResults(await searchPlaces(keyword))
    } finally {
      setSearching(false)
      setSearchDone(true)
    }
  }

  const pickDestination = (place: PlaceResult) => {
    setDestination(place)
    setResults([])
    setSearchDone(false)
    setKeyword("")
  }

  // ── 경로 계획 ──
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [offsetMin, setOffsetMin] = useState(0)

  const findRoutes = async () => {
    if (!origin.point || !destination || planning) {
      return
    }
    setPlanning(true)
    setPlanError(null)
    setPlan(null)
    setSelectedId(null)
    try {
      const result = await planRouteCandidates(origin.point, destination)
      setPlan(result)
    } catch {
      setPlanError("경로를 가져오지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.")
    } finally {
      setPlanning(false)
    }
  }

  // 그늘 점수는 출발 시각에 의존 — 슬라이더가 움직이면 API 재호출 없이 순수 재계산한다.
  const departAt = useMemo(() => new Date(now.getTime() + offsetMin * 60_000), [now, offsetMin])
  const scored: ScoredRoute[] = useMemo(
    () =>
      (plan?.candidates ?? []).map((candidate) => ({
        candidate,
        shade: scoreRouteShade(candidate.path, departAt),
      })),
    [plan, departAt],
  )
  const bestId = useMemo(() => bestShadeRouteId(scored), [scored])
  const fastestId = useMemo(() => fastestRouteId(scored), [scored])

  // 결과가 처음 나오면 그늘 추천 경로를 자동 선택한다(이후엔 사용자 선택 유지).
  useEffect(() => {
    if (scored.length > 0 && (selectedId === null || !scored.some((r) => r.candidate.id === selectedId))) {
      setSelectedId(bestId)
    }
  }, [scored, selectedId, bestId])

  const canFindRoutes = origin.status === "ok" && destination !== null && !planning

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-md min-h-full flex flex-col gap-3 px-4 pb-10">
        {/* 헤더 */}
        <header className="sticky top-0 z-40 -mx-4 px-4 pt-4 pb-3 bg-app/90 backdrop-blur-sm">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-extrabold text-text-primary">🌳 그늘길</h1>
            <span className="text-[13px] text-text-secondary tabular-nums">
              {now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })} 기준
            </span>
          </div>
          <p className="text-[13px] text-text-tertiary mt-0.5">햇빛을 피해, 최대한 그늘로 걷는 길을 찾아요</p>
        </header>

        {/* 출발지 카드 */}
        <section className="bg-surface rounded-(--radius-card) shadow-card border border-line p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text-secondary">출발지</span>
            {origin.status !== "loading" && (
              <button
                type="button"
                onClick={requestLocation}
                className="text-[12px] font-semibold text-blue hover:text-blue-hover"
              >
                현재 위치 다시 찾기
              </button>
            )}
          </div>
          {origin.status === "loading" && (
            <div className="mt-2 flex items-center gap-2 text-[14px] text-text-secondary">
              <span className="af-spin inline-block w-4 h-4 rounded-full border-2 border-line-strong border-t-(--color-blue)" />
              현재 위치를 확인하는 중…
            </div>
          )}
          {origin.status === "ok" && origin.point && (
            <div className="mt-1.5 text-[15px] font-bold text-text-primary">
              📍 {origin.label}
              <span className="ml-2 text-[12px] font-normal text-text-tertiary tabular-nums">
                {origin.point.lat.toFixed(4)}, {origin.point.lng.toFixed(4)}
              </span>
            </div>
          )}
          {origin.status === "error" && origin.error && (
            <div className="mt-2">
              <div className="text-[14px] font-bold text-error">{origin.error.title}</div>
              <p className="text-[12px] text-text-secondary whitespace-pre-line mt-1">{origin.error.description}</p>
              <div className="mt-2.5 text-[12px] font-semibold text-text-secondary">출발지를 직접 선택할 수도 있어요:</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {PRESET_PLACES.slice(0, 4).map((place) => (
                  <button
                    key={place.name}
                    type="button"
                    onClick={() => pickManualOrigin(place)}
                    className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] font-semibold text-text-secondary hover:bg-hover"
                  >
                    {place.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 목적지 카드 */}
        <section className="bg-surface rounded-(--radius-card) shadow-card border border-line p-4">
          <span className="text-[13px] font-semibold text-text-secondary">목적지</span>
          {destination ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-text-primary truncate">🏁 {destination.name}</div>
                {destination.address && (
                  <div className="text-[12px] text-text-tertiary truncate mt-0.5">{destination.address}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDestination(null)}
                className="shrink-0 text-[12px] font-semibold text-blue hover:text-blue-hover"
              >
                변경
              </button>
            </div>
          ) : (
            <>
              <form
                className="mt-2 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void runSearch()
                }}
              >
                <input
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="장소 이름으로 검색 (예: 서울시청)"
                  aria-label="목적지 검색어"
                  className="flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[14px] text-text-primary placeholder:text-text-disabled focus:border-(--color-blue) focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!keyword.trim() || searching}
                  className="shrink-0 rounded-xl bg-blue px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40 hover:bg-blue-hover"
                >
                  {searching ? "검색 중…" : "검색"}
                </button>
              </form>
              {searchDone && results.length === 0 && (
                <p className="mt-2 text-[13px] text-text-tertiary">
                  검색 결과가 없어요. 다른 이름으로 검색해 보세요.
                </p>
              )}
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-(--color-line) rounded-xl border border-line overflow-hidden">
                  {results.map((place, index) => (
                    <li key={`${place.name}-${index}`}>
                      <button
                        type="button"
                        onClick={() => pickDestination(place)}
                        className="w-full text-left px-3 py-2.5 hover:bg-hover"
                      >
                        <div className="text-[14px] font-semibold text-text-primary">{place.name}</div>
                        {place.address && <div className="text-[12px] text-text-tertiary mt-0.5">{place.address}</div>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {results.length === 0 && !searchDone && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_PLACES.slice(0, 5).map((place) => (
                    <button
                      key={place.name}
                      type="button"
                      onClick={() => pickDestination({ ...place, source: "preset" })}
                      className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px] font-semibold text-text-secondary hover:bg-hover"
                    >
                      {place.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* 경로 찾기 */}
        <button
          type="button"
          onClick={() => void findRoutes()}
          disabled={!canFindRoutes}
          className="rounded-xl bg-[#0f766e] py-3.5 text-[15px] font-bold text-white disabled:opacity-40 hover:opacity-95 active:scale-[0.99] transition"
        >
          {planning ? "그늘 경로 찾는 중…" : "🌳 그늘 경로 찾기"}
        </button>
        {planError && (
          <div className="bg-error-light border border-(--color-error)/30 rounded-(--radius-card) p-3.5 text-[13px] text-error">
            {planError}
            <button type="button" onClick={() => void findRoutes()} className="ml-2 font-bold underline">
              다시 시도
            </button>
          </div>
        )}

        {/* 결과 */}
        {plan && origin.point && destination && (
          <>
            <SunPanel at={departAt} location={origin.point} />
            <TimeSlider baseTime={now} offsetMin={offsetMin} onChange={setOffsetMin} />

            <section className="bg-surface rounded-(--radius-card) shadow-card border border-line overflow-hidden">
              <div className="h-72">
                <ShadeMap origin={origin.point} destination={destination} scored={scored} selectedId={selectedId} />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 border-t border-line">
                {LEGEND.map((item) => (
                  <span key={item.label} className="flex items-center gap-1 text-[11px] text-text-secondary">
                    <span className="w-3 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
                {plan.source === "mock" && (
                  <span className="ml-auto rounded-md bg-warning-light text-warning px-1.5 py-0.5 text-[11px] font-bold">
                    데모 경로
                  </span>
                )}
              </div>
            </section>

            <RouteCards
              scored={scored}
              selectedId={selectedId}
              bestId={bestId}
              fastestId={fastestId}
              onSelect={setSelectedId}
            />

            <p className="text-[11px] text-text-tertiary leading-relaxed px-1">
              그늘 예측은 도심 건물(기본 12m)과 길 폭(12m)을 가정해 태양 고도·방위로 계산한 근사치예요. 실제
              가로수·차양·지형 그늘과 다를 수 있어요.
              {plan.source === "mock" && " 데모 경로는 실제 도로가 아닌 격자 가정 경로예요(Tmap 키 설정 시 실경로 사용)."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
