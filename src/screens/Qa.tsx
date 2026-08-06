import { useEffect, useState } from "react"
import { Icon, Badge, Card, SectionTitle, EmptyState } from "../components/ui"
import { listE2eRuns, e2eShotUrl, type E2eRun } from "../lib/e2e"

// 테스트 리포트 — E2E 실행별 테스트케이스 결과와 캡처 스크린샷을 확인해요.
// E2E 스크립트가 실행 끝에 결과를 업로드하면 여기 쌓여요.
export default function QaScreen() {
  const [runs, setRuns] = useState<E2eRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selId, setSelId] = useState<number | null>(null)
  const [viewShot, setViewShot] = useState<string | null>(null)

  const sel = runs.find((r) => r.id === selId) ?? runs[0] ?? null

  useEffect(() => {
    let alive = true
    listE2eRuns()
      .then((rs) => { if (alive) { setRuns(rs); setSelId(rs[0]?.id ?? null) } })
      .catch((e) => { if (alive) setError((e as Error).message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return (
    <div className="space-y-6">
      <SectionTitle title="테스트 리포트" desc="E2E 실행별 테스트케이스 결과와 화면 캡처를 확인해요. 스크립트가 실행을 마치면 결과가 여기로 업로드돼요." />

      {error && <div className="rounded-[12px] bg-error-light px-4 py-3 text-[13px] font-semibold text-error">{error}</div>}

      {loading ? (
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
      )}

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
