import { useEffect, useState } from "react"
import { Icon, Badge, Button, Card, SectionTitle, EmptyState } from "../components/ui"
import { listE2eRuns, e2eShotUrl, listTestCases, createTestCase, deleteTestCase, TEST_SCREENS, type E2eRun, type TestCase } from "../lib/e2e"

// 테스트 리포트 — 화면별 테스트케이스 관리 + E2E 실행별 결과·캡처 확인.
// 케이스의 최근 결과는 최신 실행의 같은 이름 케이스와 매칭해요(없으면 미실행).
export default function QaScreen() {
  const [tab, setTab] = useState<"cases" | "runs">("cases")
  const [runs, setRuns] = useState<E2eRun[]>([])
  const [cases, setCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selId, setSelId] = useState<number | null>(null)
  const [viewShot, setViewShot] = useState<string | null>(null)

  const sel = runs.find((r) => r.id === selId) ?? runs[0] ?? null

  useEffect(() => {
    let alive = true
    Promise.all([listE2eRuns(), listTestCases()])
      .then(([rs, cs]) => { if (alive) { setRuns(rs); setCases(cs); setSelId(rs[0]?.id ?? null) } })
      .catch((e) => { if (alive) setError((e as Error).message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // 최근 결과 — 최신 실행에서 같은 이름의 자동화 케이스를 찾아요.
  const latest = runs[0] ?? null
  const resultOf = (c: TestCase): "통과" | "실패" | "미실행" => {
    const hit = latest?.cases.find((x) => x.name === c.name)
    return hit ? (hit.ok ? "통과" : "실패") : "미실행"
  }

  const addCase = async (screen: string, name: string) => {
    setError("")
    try {
      const created = await createTestCase(screen, name)
      setCases((cs) => [...cs, created])
    } catch (e) { setError((e as Error).message) }
  }
  const removeCase = async (id: number) => {
    setError("")
    try { await deleteTestCase(id); setCases((cs) => cs.filter((c) => c.id !== id)) }
    catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="테스트 리포트" desc="화면별 테스트케이스를 관리하고, E2E 실행 결과·화면 캡처를 확인해요."
        action={
          <div className="flex items-center gap-1.5">
            <Button variant={tab === "cases" ? "primary" : "secondary"} size="sm" onClick={() => setTab("cases")}>화면별 케이스</Button>
            <Button variant={tab === "runs" ? "primary" : "secondary"} size="sm" onClick={() => setTab("runs")}>실행 리포트</Button>
          </div>
        } />

      {error && <div className="rounded-[12px] bg-error-light px-4 py-3 text-[13px] font-semibold text-error">{error}</div>}

      {tab === "cases" && !loading && (
        <ScreenCases cases={cases} resultOf={resultOf} latestAt={latest?.at ?? null} onAdd={addCase} onRemove={removeCase} />
      )}

      {tab === "cases" && loading && <Card className="p-10 text-center text-[13px] text-text-tertiary">불러오는 중…</Card>}

      {tab === "runs" && (loading ? (
        <Card className="p-10 text-center text-[13px] text-text-tertiary">리포트를 불러오는 중…</Card>
      ) : runs.length === 0 ? (
        <EmptyState title="아직 업로드된 E2E 실행이 없어요." desc="E2E 스크립트가 실행 결과(테스트케이스·스크린샷)를 업로드하면 실행별로 여기에 쌓여요." />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
          {/* 실행 목록 */}
          <Card className="h-fit overflow-hidden p-2">
            {runs.map((r) => {
              const allPass = r.passed === r.total
              return (
                <button key={r.id} onClick={() => setSelId(r.id)}
                  className={`block w-full rounded-[12px] px-3 py-2.5 text-left ${sel?.id === r.id ? "bg-selected" : "hover:bg-hover"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate text-[13px] font-bold ${sel?.id === r.id ? "text-blue" : "text-text-primary"}`}>{r.name}</span>
                    <Badge tone={allPass ? "success" : "error"}>{r.passed}/{r.total}</Badge>
                  </div>
                  <div className="mt-0.5 text-[11px] text-text-tertiary">{new Date(r.at).toLocaleString("ko-KR")} · 캡처 {r.shots.length}장</div>
                </button>
              )
            })}
          </Card>

          {/* 실행 상세 — 케이스 + 캡처 */}
          {sel && (
            <div className="min-w-0 space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-text-primary">{sel.name}</span>
                  <Badge tone={sel.passed === sel.total ? "success" : "error"}>{sel.passed === sel.total ? "전체 통과" : `실패 ${sel.total - sel.passed}건`}</Badge>
                  <span className="ml-auto text-[12px] text-text-tertiary">{new Date(sel.at).toLocaleString("ko-KR")}</span>
                </div>
                <div className="mt-3 divide-y divide-line">
                  {sel.cases.map((c, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-1.5">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-success text-white" : "bg-error text-white"}`}>
                        <Icon name={c.ok ? "check" : "close"} className="h-3 w-3" />
                      </span>
                      <span className={`text-[13px] ${c.ok ? "text-text-primary" : "font-bold text-error"}`}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {sel.shots.length > 0 && (
                <Card className="p-5">
                  <div className="mb-3 text-[12px] font-bold uppercase tracking-wide text-text-disabled">화면 캡처 {sel.shots.length}장 — 클릭해서 크게 보기</div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {sel.shots.map((f) => (
                      <button key={f} onClick={() => setViewShot(f)} className="group overflow-hidden rounded-[12px] border border-line text-left hover:border-blue">
                        <img src={e2eShotUrl(sel.id, f)} alt={f} loading="lazy" className="aspect-video w-full object-cover object-top" />
                        <div className="truncate px-2.5 py-1.5 font-mono text-[11px] text-text-secondary group-hover:text-blue">{f}</div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      ))}

      {/* 캡처 크게 보기 */}
      {viewShot && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setViewShot(null)}>
          <div className="af-overlay absolute inset-0 bg-[#191f28]/60" />
          <div className="relative max-h-[90vh] w-full max-w-[1200px] overflow-auto rounded-[16px] bg-surface p-3 shadow-[var(--shadow-modal)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="font-mono text-[12px] font-bold text-text-secondary">{viewShot}</span>
              <span className="text-[11px] text-text-tertiary">클릭하면 닫혀요</span>
            </div>
            <img src={e2eShotUrl(sel.id, viewShot)} alt={viewShot} className="w-full rounded-[10px]" />
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 화면별 테스트케이스 — 보기·등록·삭제. 최근 결과는 최신 실행과 이름 매칭 =====

const RESULT_TONE: Record<string, "success" | "error" | "neutral"> = { "통과": "success", "실패": "error", "미실행": "neutral" }

function ScreenCases({ cases, resultOf, latestAt, onAdd, onRemove }: {
  cases: TestCase[]
  resultOf: (c: TestCase) => "통과" | "실패" | "미실행"
  latestAt: string | null
  onAdd: (screen: string, name: string) => Promise<void>
  onRemove: (id: number) => Promise<void>
}) {
  const [screen, setScreen] = useState(TEST_SCREENS[0])
  const [name, setName] = useState("")

  // 화면 순서 고정 + 목록에 없는 화면은 뒤에. 케이스가 있는 화면만 보여줘요(추가는 위 폼에서 아무 화면이나).
  const screens = [...TEST_SCREENS, ...new Set(cases.map((c) => c.screen).filter((s) => !TEST_SCREENS.includes(s)))]
    .filter((s) => cases.some((c) => c.screen === s))
  const total = cases.length
  const passed = cases.filter((c) => resultOf(c) === "통과").length
  const failed = cases.filter((c) => resultOf(c) === "실패").length

  const submit = async () => {
    if (!name.trim()) return
    await onAdd(screen, name)
    setName("")
  }

  return (
    <div className="space-y-4">
      {/* 추가 폼 — 한 곳에서만. 이름이 E2E 자동화 케이스와 같으면 결과가 자동 매칭돼요 */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={screen} onChange={(e) => setScreen(e.target.value)}
            className="h-10 rounded-[10px] border border-line bg-surface px-2 text-[13px] outline-none focus:border-blue">
            {TEST_SCREENS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="테스트케이스 이름 (예: 빈 상태에서 안내 문구가 보인다)"
            className="h-10 min-w-[260px] flex-1 rounded-[10px] border border-line bg-surface px-3 text-[13px] outline-none focus:border-blue"
          />
          <Button variant="primary" size="sm" onClick={submit} disabled={!name.trim()} icon={<Icon name="plus" className="h-3.5 w-3.5" />}>케이스 추가</Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
          <span className="font-bold text-text-primary">케이스 {total}개</span>
          <span className="text-line-strong">·</span>
          <Badge tone="success">통과 {passed}</Badge>
          <Badge tone="error">실패 {failed}</Badge>
          <Badge tone="neutral">미실행 {total - passed - failed}</Badge>
          <span className="ml-auto text-text-tertiary">{latestAt ? `최근 결과: ${new Date(latestAt).toLocaleString("ko-KR")} 실행 기준` : "아직 실행 결과 없음"}</span>
        </div>
      </Card>

      {/* 케이스 목록 — 한 카드 안에 화면별 섹션으로 컴팩트하게 */}
      {total === 0 ? (
        <EmptyState title="아직 테스트케이스가 없어요." desc="위에서 화면을 골라 첫 케이스를 추가하세요. E2E 자동화 케이스와 이름이 같으면 실행 결과가 자동으로 붙어요." />
      ) : (
        <Card className="overflow-hidden">
          {screens.map((s) => {
            const items = cases.filter((c) => c.screen === s)
            return (
              <div key={s}>
                <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2">
                  <span className="text-[12px] font-bold text-text-primary">{s}</span>
                  <span className="text-[11px] font-semibold text-text-tertiary">{items.length}</span>
                </div>
                {items.map((c, i) => {
                  const r = resultOf(c)
                  return (
                    <div key={c.id} className={`group flex items-center gap-2.5 px-4 py-2 ${i < items.length - 1 ? "border-b border-line" : "border-b border-line"}`} title={c.note || undefined}>
                      <Badge tone={RESULT_TONE[r]}>{r}</Badge>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{c.name}</span>
                      <button onClick={() => onRemove(c.id)} className="rounded-[6px] p-1 text-text-disabled opacity-0 hover:bg-error-light hover:text-error group-hover:opacity-100" aria-label="삭제">
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
