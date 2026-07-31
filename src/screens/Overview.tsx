import { Icon, Button, Badge, Card, SummaryCard, Progress, RoleChip, SyncMark, toneFor } from "../components/ui"
import { REPO, OVERVIEW_SUMMARY, PIPELINE, RECENT_RUNS, CHECKLIST, PROJECT, PLANNING_FLOW } from "../data"

export default function Overview({ navigate }: { navigate: (r: string) => void }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="board" className="h-5 w-5 text-text-secondary" />
            <h1 className="text-[22px] font-bold tracking-tight">{PROJECT.name}</h1>
            <Badge tone="blue">{`${PROJECT.stage} ${PROJECT.progress}%`}</Badge>
            <SyncMark synced />
          </div>
          <p className="mt-2 text-[14px] text-text-secondary">{PROJECT.desc}</p>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[12px] text-text-tertiary"><Icon name="github" className="h-3.5 w-3.5" />{PROJECT.repo} · {PROJECT.org} · 격리 환경</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Icon name="external" className="h-4 w-4" />}>GitHub에서 열기</Button>
          <Button icon={<Icon name="sync" className="h-4 w-4" />}>새로 동기화</Button>
          <Button variant="primary" icon={<Icon name="play" className="h-4 w-4" />}>Actions 실행</Button>
        </div>
      </div>

      {/* 진행 흐름 안내: 프로젝트가 어떻게 진행되는지 */}
      <button onClick={() => navigate("pipeline")} className="flex w-full items-center gap-3 rounded-[14px] border border-line bg-surface p-4 text-left transition-colors hover:bg-hover">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-blue-light text-blue"><Icon name="handoff" className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-text-primary">이 프로젝트는 어떻게 진행되나요?</div>
          <div className="text-[12px] text-text-tertiary">에이전트 · GitHub Actions · 사람이 각 단계에서 무엇을 하는지 한눈에 보기</div>
        </div>
        <Icon name="chevron" className="h-4 w-4 shrink-0 text-text-tertiary" />
      </button>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {OVERVIEW_SUMMARY.map((s) => (
          <SummaryCard key={s.label} label={s.label} value={s.value} sub={s.sub} tone={s.tone as any} />
        ))}
      </div>

      {/* Planning stage handoff: 사람 ↔ AI, step by step */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold">기획 단계 진행</h2>
            <p className="mt-1 text-[13px] text-text-secondary">사람과 AI가 번갈아 처리해요. 지금은 <b className="text-blue">PRD 검토·승인</b> 차례예요.</p>
          </div>
          <Button variant="primary" onClick={() => navigate("prd")}>PRD 이어서 검토하기</Button>
        </div>
        <div className="mt-5 flex items-stretch gap-2 overflow-x-auto pb-1">
          {PLANNING_FLOW.map((s, i) => (
            <div key={s.step} className="flex items-center">
              <button onClick={() => navigate(s.to)} className={`min-w-[168px] rounded-[12px] border p-3 text-left transition-colors ${s.state === "진행 중" ? "border-blue bg-blue-light" : "border-line bg-surface-2 hover:bg-hover"}`}>
                <div className="flex items-center justify-between">
                  <RoleChip owner={s.owner} />
                  {s.state === "완료" ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-white"><Icon name="check" className="h-2.5 w-2.5" /></span>
                    : s.state === "진행 중" ? <span className="af-spin h-3.5 w-3.5 rounded-full border-2 border-blue/30 border-t-blue" />
                    : <span className="h-3.5 w-3.5 rounded-full border-2 border-line-strong" />}
                </div>
                <div className="mt-2 text-[13px] font-bold text-text-primary">{s.step}</div>
                <div className="mt-0.5 text-[12px] leading-snug text-text-tertiary">{s.action}</div>
              </button>
              {i < PLANNING_FLOW.length - 1 && <Icon name="chevron" className="mx-0.5 h-4 w-4 shrink-0 text-line-strong" />}
            </div>
          ))}
        </div>
      </Card>

      {/* 저장소 · 격리 환경 (프로젝트 1개 = 저장소 1개) */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">저장소 · 격리 환경</h2>
          <span className="text-[12px] text-text-tertiary">프로젝트 1개 = 저장소 1개 · 이슈·PR·Actions·CLAUDE.md 를 담아요</span>
        </div>
        <button onClick={() => navigate("mirror")} className="mt-4 flex w-full items-center gap-4 rounded-[12px] border border-line p-4 text-left transition-colors hover:bg-hover">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-surface-2"><Icon name="github" className="h-5 w-5 text-text-secondary" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[14px] font-bold text-text-primary">{PROJECT.repo}</span>
              <Badge tone="neutral">{PROJECT.purpose}</Badge>
              <span className="text-[12px] text-text-tertiary">{PROJECT.branch}</span>
            </div>
            <div className="mt-2 flex items-center gap-2"><Progress value={PROJECT.progress} /><span className="text-[12px] font-bold text-text-secondary">{PROJECT.progress}%</span></div>
          </div>
          <Icon name="chevron" className="h-4 w-4 shrink-0 text-text-tertiary" />
        </button>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Pipeline */}
          <Card className="p-6">
            <h2 className="text-[16px] font-bold">현재 파이프라인</h2>
            <div className="mt-5 flex items-stretch gap-2 overflow-x-auto pb-1">
              {PIPELINE.map((p, i) => {
                const tone = toneFor(p.status)
                return (
                  <div key={p.label} className="flex items-center">
                    <div className={`min-w-[120px] rounded-[12px] border p-3 ${p.status === "실행 중" ? "border-blue bg-blue-light" : p.status === "완료" ? "border-line bg-surface-2" : "border-dashed border-line bg-surface"}`}>
                      <div className="flex items-center gap-1.5">
                        {p.status === "완료" && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-white"><Icon name="check" className="h-2.5 w-2.5" /></span>}
                        {p.status === "실행 중" && <span className="af-spin h-3.5 w-3.5 rounded-full border-2 border-blue/30 border-t-blue" />}
                        <span className="text-[13px] font-bold">{p.label}</span>
                      </div>
                      <div className={`mt-1.5 text-[12px] font-semibold ${tone === "blue" ? "text-blue" : "text-text-tertiary"}`}>{p.detail}</div>
                    </div>
                    {i < PIPELINE.length - 1 && <Icon name="chevron" className="mx-0.5 h-4 w-4 shrink-0 text-line-strong" />}
                  </div>
                )
              })}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Progress value={REPO.progress} />
              <span className="text-[13px] font-bold text-blue">{REPO.progress}%</span>
            </div>
          </Card>

          {/* Recent runs */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-[16px] font-bold">최근 실행</h2>
              <button onClick={() => navigate("runs")} className="text-[13px] font-semibold text-blue hover:underline">전체 보기</button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
                  <th className="px-6 py-2.5">워크플로</th>
                  <th className="px-3 py-2.5">대상</th>
                  <th className="px-3 py-2.5">상태</th>
                  <th className="px-3 py-2.5">시작</th>
                  <th className="px-3 py-2.5">실행 시간</th>
                  <th className="px-6 py-2.5 text-right">결과</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_RUNS.map((r) => (
                  <tr key={r.id} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
                    <td className="px-6 py-3.5 font-semibold text-text-primary">{r.workflow}</td>
                    <td className="px-3 py-3.5 font-mono text-[12px] text-text-secondary">{r.target}</td>
                    <td className="px-3 py-3.5"><Badge>{r.status}</Badge></td>
                    <td className="px-3 py-3.5 text-text-tertiary">{r.started}</td>
                    <td className="px-3 py-3.5 text-text-secondary">{r.dur}</td>
                    <td className="px-6 py-3.5 text-right"><span className="font-semibold text-blue">{r.result}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Right: things to check */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[16px] font-bold">지금 확인할 항목</h2>
            <div className="mt-4 space-y-2.5">
              {CHECKLIST.map((c) => (
                <button
                  key={c.label}
                  onClick={() => navigate(c.to)}
                  className="flex w-full items-center justify-between rounded-[12px] border border-line px-4 py-3.5 text-left transition-colors hover:bg-hover"
                >
                  <span className="text-[14px] font-semibold text-text-primary">{c.label}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={c.tone as any}>{c.value}</Badge>
                    <Icon name="chevron" className="h-4 w-4 text-text-tertiary" />
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[16px] font-bold">에이전트 현황</h2>
            <div className="mt-4 space-y-3">
              {[
                { n: "Backend Agent", s: "실행 중", t: "T-045 구현", tone: "blue" },
                { n: "Repair Agent", s: "실행 중", t: "PR #83 CI 수정", tone: "blue" },
                { n: "Review Agent", s: "대기", t: "다음: PR #84", tone: "neutral" },
              ].map((a) => (
                <div key={a.n} className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-bold">{a.n}</div>
                    <div className="text-[12px] text-text-tertiary">{a.t}</div>
                  </div>
                  <Badge tone={a.tone as any}>{a.s}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
