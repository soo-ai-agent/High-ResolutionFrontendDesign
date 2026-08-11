import { useEffect, useState } from "react"
import { Icon, Badge, Button, Card, SectionTitle } from "../components/ui"
import { ACTOR_SUMMARY, PIPELINE_STAGES, FUTURE_INTEGRATION, type PipelineStage, type ProjectItem } from "../data"
import { getProjectActivity, listProjectWorkflows, dispatchProjectWorkflow, getProjectGantt, getProjectRuns, getCiRecoveryStatus, runCiRecovery, type ProjectActivity, type RepoWorkflows, type GanttRow, type ActionRun, type CiRecoveryStatus } from "../lib/tasks"

const ACTOR_TONE = {
  ai: { bg: "bg-purple-light", fg: "text-purple", dot: "bg-purple" },
  auto: { bg: "bg-success-light", fg: "text-success", dot: "bg-success" },
  human: { bg: "bg-warning-light", fg: "text-[#b47908]", dot: "bg-warning" },
}

// 실제 동작 판정 — live(실동작) / partial(부분) / mock(목업)
const REAL_META: Record<string, { label: string; cls: string; dot: string }> = {
  live: { label: "실동작", cls: "bg-success-light text-success", dot: "bg-success" },
  partial: { label: "부분", cls: "bg-warning-light text-[#b47908]", dot: "bg-warning" },
  mock: { label: "목업", cls: "bg-[#eef1f4] text-text-tertiary", dot: "bg-[#8b95a1]" },
}

function RealChip({ real }: { real: string }) {
  const m = REAL_META[real] ?? REAL_META.mock
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span>
}

// 지금 실제로 동작하는 기반(backbone) — Phase 0~2 로 만든 실제 연동
const LIVE_BACKBONE = [
  "GitHub 프록시 — 저장소·이슈·문서 읽기, 이슈 생성·@claude 코멘트 쓰기",
  "웹훅 수신(서명 검증) · 저장소 웹훅 등록 · projects_v2_item 보드 이동 미러",
  "백필 — 현재 이슈·PR·Actions를 미러에 채우기",
  "DB 미러 · Projects 보드 · 상단바 실시간 상태",
  "PAT 연결(서버 보관) · 배포 준비(Dockerfile · fly.toml)",
]

export default function Pipeline({ navigate, project }: { navigate: (r: string) => void; project?: ProjectItem | null }) {
  const counts = PIPELINE_STAGES.reduce((a, s) => ({ ...a, [s.real]: (a[s.real] ?? 0) + 1 }), {} as Record<string, number>)
  return (
    <div className="space-y-6">
      <SectionTitle
        title="진행 흐름"
        desc="프로젝트가 생성되면 아래 순서로 진행돼요. 에이전트 · GitHub Actions · 사람이 각 단계에서 맡은 일을 이어받아요."
      />

      {/* 에이전트 활동 피드 — 작업 활동 + Actions 실행 + 웹훅 이벤트 라이브 타임라인 */}
      <AgentActivityFeed project={project} />

      {/* 진행 간트 — 활동 이력 기반 실적 타임라인 */}
      <GanttCard project={project} />

      {/* 외부 워크플로 실행 — 프로젝트 저장소의 Actions 를 대시보드에서 workflow_dispatch 로 */}
      <CiRecoveryCard project={project} />

      <WorkflowRunner project={project} />

      {/* 지금 실제로 동작하는 기반(backbone) */}
      <Card className="border-success/30 bg-success-light/20 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-success-light text-success"><Icon name="bolt" className="h-4.5 w-4.5" /></span>
          <div>
            <div className="flex items-center gap-2"><span className="text-[15px] font-bold text-text-primary">지금 실제로 동작하는 기반</span><Badge tone="success">실동작</Badge></div>
            <div className="text-[12px] text-text-tertiary">아래 GitHub 연동은 목업이 아니라 서버로 실제 동작해요(연결·배포 시).</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {LIVE_BACKBONE.map((b) => (
            <div key={b} className="flex items-start gap-2 text-[13px] text-text-secondary">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-success" />{b}
            </div>
          ))}
        </div>
      </Card>

      {/* 판정 범례 + 요약 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] bg-surface-2 px-4 py-3 text-[12px] text-text-secondary">
        <span className="font-bold text-text-primary">단계별 실제 동작 판정</span>
        <span className="flex items-center gap-1.5"><RealChip real="live" /> 핵심 자동화가 지금 실제로 수행</span>
        <span className="flex items-center gap-1.5"><RealChip real="partial" /> 일부만 실제(주로 GitHub 연동), 에이전트 미실행</span>
        <span className="flex items-center gap-1.5"><RealChip real="mock" /> 화면만, 실제 실행 없음</span>
        <span className="ml-auto text-text-tertiary">실동작 {counts.live ?? 0} · 부분 {counts.partial ?? 0} · 목업 {counts.mock ?? 0}</span>
      </div>

      {/* 세 주체가 각각 하는 일 요약 */}
      <div className="grid gap-4 md:grid-cols-3">
        {ACTOR_SUMMARY.map((a) => {
          const t = ACTOR_TONE[a.key]
          return (
            <Card key={a.key} className={`p-5 ${a.key === "human" ? "border-warning/40" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${t.bg}`}><Icon name={a.icon} className={`h-4.5 w-4.5 ${t.fg}`} /></span>
                <span className="text-[15px] font-bold text-text-primary">{a.title}</span>
                {a.key === "human" && <span className="ml-auto rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-bold text-[#b47908]">여기만 신경 쓰면 돼요</span>}
              </div>
              <ul className="mt-3 space-y-2">
                {a.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />{it}
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>

      {/* 단계별 담당 매트릭스 */}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
              <th className="w-[240px] px-4 py-3">단계</th>
              <th className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple" />에이전트 (AI)</span></th>
              <th className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />GitHub Actions</span></th>
              <th className="bg-warning-light/40 px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" />사람 (체크)</span></th>
            </tr>
          </thead>
          <tbody>
            {PIPELINE_STAGES.map((s) => <StageRow key={s.n} s={s} navigate={navigate} />)}
          </tbody>
        </table>
      </Card>

      <div className="flex items-start gap-2 rounded-[12px] bg-surface-2 px-4 py-3">
        <Icon name="hand" className="mt-0.5 h-4 w-4 shrink-0 text-[#b47908]" />
        <p className="text-[13px] leading-relaxed text-text-secondary">
          사람은 <b className="text-[#b47908]">사람 열</b>과 <b className="text-[#b47908]">휴먼태스크</b>만 챙기면 돼요. 나머지 단계는 에이전트와 GitHub Actions가 자동으로 진행하고, 사람 확인이 필요할 때만 알려줘요.
        </p>
      </div>

      {/* 추후 실제 연동 (현재는 목업 프로토타입) */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-light text-blue"><Icon name="bolt" className="h-4.5 w-4.5" /></span>
          <div>
            <div className="flex items-center gap-2"><span className="text-[15px] font-bold text-text-primary">추후 구현 · 실제 연동</span><Badge tone="neutral">프로토타입</Badge></div>
            <div className="text-[12px] text-text-tertiary">지금은 목업 데이터로 흐름을 보여줘요. 실제 운영하려면 아래 연동이 이어져야 해요.</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {FUTURE_INTEGRATION.map((f, i) => (
            <div key={f.title} className="flex items-start gap-2.5 rounded-[12px] border border-line p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-text-tertiary">{i + 1}</span>
              <div>
                <div className="text-[13px] font-bold text-text-primary">{f.title}</div>
                <div className="text-[12px] leading-relaxed text-text-secondary">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ===== 에이전트 활동 피드 — 10초 폴링으로 전체 태스크 활동·Actions 실행·웹훅 이벤트를 합쳐 보여줘요 =====

const FEED_META: Record<ProjectActivity["type"], { icon: string; cls: string; label: string }> = {
  task: { icon: "sparkle", cls: "bg-purple-light text-purple", label: "작업" },
  run: { icon: "runs", cls: "bg-success-light text-success", label: "Actions" },
  event: { icon: "sync", cls: "bg-blue-light text-blue", label: "이벤트" },
}

const relTime = (iso: string) => {
  const d = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(d)) return ""
  const m = Math.floor(d / 60000)
  if (m < 1) return "방금"
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

function AgentActivityFeed({ project }: { project?: ProjectItem | null }) {
  const [items, setItems] = useState<ProjectActivity[]>([])
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!project) return
    let alive = true
    const tick = () =>
      getProjectActivity(project.id)
        .then((xs) => { if (alive) { setItems(xs); setUpdatedAt(new Date()) } })
        .catch(() => {})
    tick()
    const iv = setInterval(tick, 10_000)
    return () => { alive = false; clearInterval(iv) }
  }, [project])

  if (!project) return null
  const shown = expanded ? items : items.slice(0, 8)

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="af-spin absolute inline-flex h-full w-full rounded-full bg-blue opacity-30" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue" />
        </span>
        <span className="text-[15px] font-bold text-text-primary">에이전트 활동 피드</span>
        <Badge tone="blue">{project.name}</Badge>
        <span className="ml-auto text-[11px] text-text-tertiary">
          10초마다 갱신{updatedAt ? ` · 마지막 ${updatedAt.toLocaleTimeString("ko-KR")}` : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-[10px] bg-surface-2 px-4 py-3 text-[13px] text-text-secondary">
          아직 활동이 없어요 — 작업을 착수하면 태스크 활동·Actions 실행·웹훅 이벤트가 여기로 실시간으로 모여요.
        </div>
      ) : (
        <>
          <div className="mt-3 divide-y divide-line">
            {shown.map((a, i) => {
              const m = FEED_META[a.type]
              const fail = a.type === "run" && a.kind === "failure"
              return (
                <div key={`${a.at}-${i}`} className="flex items-start gap-2.5 py-2">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] ${fail ? "bg-error-light text-error" : m.cls}`}>
                    <Icon name={m.icon} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={fail ? "error" : a.type === "task" ? "purple" : a.type === "run" ? "success" : "blue"}>{a.kind}</Badge>
                      <span className="truncate text-[13px] font-semibold text-text-primary">{a.title}</span>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-blue hover:underline" aria-label="열기">
                          <Icon name="external" className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="truncate text-[12px] text-text-secondary">{a.note}</div>
                  </div>
                  <span className="shrink-0 text-[11px] text-text-tertiary">{relTime(a.at)}</span>
                </div>
              )
            })}
          </div>
          {items.length > 8 && (
            <button onClick={() => setExpanded((e) => !e)}
              className="mt-2 w-full rounded-[8px] bg-surface-2 py-1.5 text-[12px] font-semibold text-text-secondary hover:bg-hover">
              {expanded ? "접기" : `전체 ${items.length}건 보기`}
            </button>
          )}
        </>
      )}
    </Card>
  )
}

// ===== 진행 간트 — 활동 이력에서 파생한 실적 타임라인 (계획표가 아니라 실제 기록) =====

const GANTT_TONE: Record<string, string> = {
  "완료": "bg-success",
  "진행 중": "bg-blue",
  "검토 대기": "bg-[#7c5cfc]",
}
const GANTT_STATUS_TONE: Record<string, "success" | "blue" | "warning" | "purple"> = {
  "완료": "success", "진행 중": "blue", "대기": "warning", "검토 대기": "purple",
}

function GanttCard({ project }: { project?: ProjectItem | null }) {
  const [rows, setRows] = useState<GanttRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!project) return
    let alive = true
    getProjectGantt(project.id)
      .then((rs) => { if (alive) setRows(rs) })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [project])

  if (!project || !loaded || rows.length === 0) return null

  const now = Date.now()
  const times = rows.flatMap((r) => [r.createdAt, r.startedAt, r.endedAt].filter((s): s is string => !!s)).map((s) => new Date(s).getTime())
  const t0 = Math.min(...times, now - 86_400_000) // 최소 하루 폭 확보
  const span = now - t0
  const pct = (t: number) => ((t - t0) / span) * 100
  const fmt = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}` }
  const ticks = [0.25, 0.5, 0.75]

  // 단계 순서 그대로 그룹핑 (서버가 단계 순으로 내려줘요)
  const groups: { phase: string; items: GanttRow[] }[] = []
  rows.forEach((r) => {
    const g = groups[groups.length - 1]
    if (g && g.phase === r.phase) g.items.push(r)
    else groups.push({ phase: r.phase, items: [r] })
  })

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-light text-blue"><Icon name="board" className="h-4.5 w-4.5" /></span>
        <div>
          <div className="text-[15px] font-bold text-text-primary">진행 간트</div>
          <div className="text-[12px] text-text-tertiary">활동 이력 기반 실적 타임라인 — 막대는 착수부터 완료(미완료는 지금)까지, 점은 분해만 되고 아직 착수 전이에요.</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] font-semibold text-text-secondary">
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-success" />완료</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-blue" />진행 중</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-[#7c5cfc]" />검토 대기</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border-2 border-line-strong bg-surface" />대기</span>
        </div>
      </div>

      <div className="mt-4">
        {/* 시간 축 */}
        <div className="mb-1 flex items-center">
          <div className="w-[250px] shrink-0" />
          <div className="relative h-4 flex-1 text-[10px] font-semibold text-text-tertiary">
            <span className="absolute left-0">{fmt(t0)}</span>
            {ticks.map((f) => <span key={f} className="absolute -translate-x-1/2" style={{ left: `${f * 100}%` }}>{fmt(t0 + span * f)}</span>)}
            <span className="absolute right-0">지금</span>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.phase} className="mb-1">
            <div className="flex items-center">
              <div className="w-[250px] shrink-0 py-1 text-[11px] font-bold uppercase tracking-wider text-text-disabled">{g.phase}</div>
              <div className="flex-1" />
            </div>
            {g.items.map((r) => {
              const started = r.startedAt ? new Date(r.startedAt).getTime() : null
              const ended = r.endedAt ? new Date(r.endedAt).getTime() : null
              const created = r.createdAt ? new Date(r.createdAt).getTime() : t0
              const left = started != null ? pct(started) : pct(created)
              const width = started != null ? Math.max(pct(ended ?? now) - pct(started), 1.4) : 0
              return (
                <div key={r.code} className="flex items-center py-0.5">
                  <div className="flex w-[250px] shrink-0 items-center gap-1.5 pr-3">
                    <span className="font-mono text-[11px] font-bold text-text-tertiary">{r.code}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-primary">{r.title}</span>
                    <Badge tone={GANTT_STATUS_TONE[r.status] ?? "warning"}>{r.status}</Badge>
                  </div>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-[6px] bg-surface-2">
                    {ticks.map((f) => <span key={f} className="absolute top-0 h-full w-px bg-line" style={{ left: `${f * 100}%` }} />)}
                    {started != null ? (
                      <div
                        className={`absolute top-1 h-3 rounded-full ${GANTT_TONE[r.status] ?? "bg-line-strong"} ${ended == null ? "opacity-90" : ""}`}
                        style={{ left: `${Math.min(left, 98)}%`, width: `${Math.min(width, 100 - Math.min(left, 98))}%` }}
                        title={`${r.code} · ${r.status}`}
                      />
                    ) : (
                      <span className="absolute top-1.5 h-2 w-2 -translate-x-1/2 rounded-full border-2 border-line-strong bg-surface" style={{ left: `${Math.max(Math.min(pct(created), 98), 1)}%` }} title={`${r.code} · 대기`} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ===== 외부 워크플로 실행 — 저장소별 워크플로를 골라 workflow_dispatch 로 원격 실행해요 =====

// 실행 상태 배지 — 실행 중(파랑) / 성공(초록) / 실패(빨강) / 그 외(회색)
function runBadge(r: ActionRun): { label: string; tone: "blue" | "success" | "error" | "neutral" } {
  if (r.status !== "completed" && r.conclusion == null) return { label: r.status === "queued" ? "대기열" : "실행 중", tone: "blue" }
  if (r.conclusion === "success") return { label: "성공", tone: "success" }
  if (r.conclusion === "failure") return { label: "실패", tone: "error" }
  return { label: r.conclusion ?? r.status ?? "완료", tone: "neutral" }
}

// CI 회복 루프 표면화 — 과거엔 스윕 결과가 스케줄러에서 버려져 보이지 않았어요.
// 마지막 스윕 시각·지시·보류·오류를 보여주고 수동 스윕도 할 수 있어요. 켜고 끄기는 작업 계획 카드에서.
function CiRecoveryCard({ project }: { project?: ProjectItem | null }) {
  const [st, setSt] = useState<CiRecoveryStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    if (!project) return
    let alive = true
    const load = () => getCiRecoveryStatus(project.id).then((s) => { if (alive) setSt(s) }).catch(() => {})
    load()
    const t = window.setInterval(load, 15_000)
    return () => { alive = false; window.clearInterval(t) }
  }, [project])

  if (!project || !st) return null
  const sweepNow = async () => {
    setBusy(true); setMsg("")
    try {
      const r = await runCiRecovery(project.id)
      setMsg(r.notified.length ? `지시 보냄: ${r.notified.map((n) => n.taskCode).join(", ")}` : r.message ?? `보낼 지시 없음 (보류 ${r.pending}건)`)
      setSt(await getCiRecoveryStatus(project.id))
    } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Icon name="sync" className="h-4 w-4 text-blue" />
          <span className="text-[13px] font-bold text-text-primary">CI 실패 자동 회복</span>
          <Badge tone={st.enabled ? "success" : "neutral"}>{st.enabled ? "켜짐 · 30초 주기" : "꺼짐"}</Badge>
        </div>
        <span className="text-[12px] text-text-secondary">
          {st.lastAt
            ? <>마지막 스윕 <b className="text-text-primary">{st.lastAt.slice(11, 19)}</b> · 지시 <b className="text-blue">{st.notified}</b>건 · 보류 <b className="text-text-primary">{st.pending}</b>건</>
            : "아직 스윕 기록이 없어요"}
        </span>
        {st.message && <span className="text-[12px] font-semibold text-error">{st.message}</span>}
        <div className="ml-auto">
          <Button variant="secondary" size="sm" onClick={sweepNow} disabled={busy} icon={<Icon name="play" className="h-4 w-4" />}>지금 스윕</Button>
        </div>
      </div>
      {msg && <div className="mt-2 rounded-[8px] bg-surface-2 px-3 py-2 text-[12px] font-medium text-text-secondary">{msg}</div>}
    </Card>
  )
}

function WorkflowRunner({ project }: { project?: ProjectItem | null }) {
  const [groups, setGroups] = useState<RepoWorkflows[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState("")
  const [selKey, setSelKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [runs, setRuns] = useState<ActionRun[]>([])
  const [runsAt, setRunsAt] = useState<Date | null>(null)

  useEffect(() => {
    if (!project) return
    let alive = true
    listProjectWorkflows(project.id)
      .then((gs) => {
        if (!alive) return
        setGroups(gs)
        const first = gs.flatMap((g) => g.workflows.map((w) => `${g.repo}#${w.id}`))[0]
        if (first) setSelKey(first)
      })
      .catch((e) => { if (alive) setLoadErr((e as Error).message) })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [project])

  // 실행 내역 — 10초 폴링. 웹훅으로 미러에 잡힌 모든 실행(대시보드·에이전트·CI)이 보여요.
  useEffect(() => {
    if (!project) return
    let alive = true
    const tick = () =>
      getProjectRuns(project.id)
        .then((rs) => { if (alive) { setRuns(rs); setRunsAt(new Date()) } })
        .catch(() => {})
    tick()
    const iv = setInterval(tick, 10_000)
    return () => { alive = false; clearInterval(iv) }
  }, [project])

  if (!project) return null

  const run = async () => {
    const [repo, idStr] = selKey.split("#")
    if (!repo || !idStr) return
    setBusy(true)
    setNotice("")
    try {
      const r = await dispatchProjectWorkflow(project.id, repo, Number(idStr))
      setNotice(`✅ ${r.message}`)
    } catch (e) {
      setNotice(`⚠️ ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const total = groups.reduce((n, g) => n + g.workflows.length, 0)

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-success-light text-success"><Icon name="runs" className="h-4.5 w-4.5" /></span>
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-text-primary">외부 워크플로 실행</div>
          <div className="text-[12px] text-text-tertiary">저장소의 GitHub Actions 를 대시보드에서 바로 실행해요 (workflow_dispatch). 결과는 웹훅으로 미러·활동 피드에 돌아와요.</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {total > 0 && (
            <select value={selKey} onChange={(e) => setSelKey(e.target.value)}
              className="h-9 max-w-[320px] rounded-[10px] border border-line bg-surface px-2 text-[13px] outline-none focus:border-blue">
              {groups.map((g) => (
                <optgroup key={g.repo} label={`${g.repoName} (${g.repo})`}>
                  {g.workflows.map((w) => <option key={w.id} value={`${g.repo}#${w.id}`}>{w.name}</option>)}
                </optgroup>
              ))}
            </select>
          )}
          <Button variant="primary" size="sm" onClick={run} disabled={busy || !selKey} icon={<Icon name="play" className="h-4 w-4" />}>{busy ? "요청 중…" : "실행"}</Button>
        </div>
      </div>
      {!loaded ? (
        <div className="mt-3 text-[12px] text-text-tertiary">워크플로 목록을 불러오는 중…</div>
      ) : loadErr ? (
        <div className="mt-3 rounded-[8px] bg-warning-light px-3 py-2 text-[12px] font-semibold text-[#b47908]">{loadErr} — 설정에서 PAT 를 연결하면 저장소의 워크플로를 불러와요.</div>
      ) : total === 0 ? (
        <div className="mt-3 rounded-[8px] bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">실행할 워크플로가 없어요 — 저장소 <code className="font-mono">.github/workflows/</code> 에 workflow_dispatch 트리거가 있는 워크플로를 추가하세요.</div>
      ) : null}
      {notice && <div className={`mt-3 rounded-[8px] px-3 py-2 text-[12px] font-semibold ${notice.startsWith("✅") ? "bg-success-light text-success" : "bg-warning-light text-[#b47908]"}`}>{notice}</div>}

      {/* 실행 내역 — 실행이 있을 때마다 웹훅으로 잡혀 여기 쌓여요 */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-wide text-text-disabled">실행 내역</span>
          <span className="text-[11px] text-text-tertiary">10초마다 갱신{runsAt ? ` · 마지막 ${runsAt.toLocaleTimeString("ko-KR")}` : ""}</span>
        </div>
        {runs.length === 0 ? (
          <div className="rounded-[8px] bg-surface-2 px-3 py-2 text-[12px] text-text-secondary">아직 실행 기록이 없어요 — 실행하면(대시보드·에이전트·CI 어느 쪽이든) 웹훅으로 여기 표시돼요.</div>
        ) : (
          <div className="divide-y divide-line">
            {runs.map((r) => {
              const b = runBadge(r)
              return (
                <div key={`${r.repo}#${r.id}`} className="flex items-center gap-2.5 py-1.5">
                  <Badge tone={b.tone}>{b.label}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{r.name ?? "workflow"}</span>
                  <span className="hidden truncate font-mono text-[11px] text-text-tertiary sm:block">{r.repo}{r.head_branch ? ` · ${r.head_branch}` : ""}</span>
                  <span className="shrink-0 text-[11px] text-text-tertiary">{r.updated_at ? relTime(r.updated_at) : ""}</span>
                  {r.html_url && (
                    <a href={r.html_url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center text-blue hover:underline" aria-label="GitHub에서 열기">
                      <Icon name="external" className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}

function StageRow({ s, navigate }: { s: PipelineStage; navigate: (r: string) => void }) {
  const running = s.state === "진행 중"
  const stateTone = s.state === "완료" ? "success" : running ? "blue" : "neutral"
  return (
    <tr className={`border-b border-line align-top text-[13px] last:border-0 ${running ? "bg-blue-light/30" : ""}`}>
      {/* 단계 */}
      <td className="px-4 py-4">
        <button onClick={() => navigate(s.route)} className="group text-left">
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s.state === "완료" ? "bg-success text-white" : running ? "bg-blue text-white" : "bg-surface-2 text-text-tertiary"}`}>
              {s.state === "완료" ? <Icon name="check" className="h-3.5 w-3.5" /> : s.n}
            </span>
            <span className="text-[14px] font-bold text-text-primary group-hover:text-blue">{s.stage}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
            <Badge tone="neutral">{s.phase}</Badge>
            <Badge tone={stateTone as any}>{s.state}</Badge>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-tertiary"><Icon name="runs" className="h-3 w-3" />{s.duration}</span>
            <RealChip real={s.real} />
          </div>
        </button>
        <div className="mt-2 max-w-[560px] pl-8 text-[11px] leading-relaxed text-text-tertiary">{s.realNote}</div>
      </td>
      {/* 에이전트 */}
      <td className="px-4 py-4">
        {s.agent === "—" ? <Muted /> : (
          <div>
            <div className="text-text-secondary">{s.agent}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-light px-2 py-0.5 font-semibold text-purple"><Icon name="sparkle" className="h-3 w-3" />{s.agentName}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-text-tertiary">{s.model}</span>
            </div>
          </div>
        )}
      </td>
      {/* GitHub Actions */}
      <td className="px-4 py-4">{s.actions === "—" ? <Muted /> : <span className="text-text-secondary">{s.actions}</span>}</td>
      {/* 사람 */}
      <td className={`px-4 py-4 ${s.humanCheck ? "bg-warning-light/50" : ""}`}>
        {s.human === "—" ? (
          <span className="inline-flex items-center gap-1.5 text-text-tertiary"><Icon name="bolt" className="h-3.5 w-3.5 text-success" />자동 진행 · 대기 불필요</span>
        ) : (
          <div className="flex items-start gap-1.5">
            <Icon name="user" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b47908]" />
            <div>
              <div className="font-medium text-text-primary">{s.human}</div>
              {s.humanCheck && <span className="mt-1.5 inline-block"><Badge tone="warning">사람 확인 필요</Badge></span>}
            </div>
          </div>
        )}
      </td>
    </tr>
  )
}

function Muted() {
  return <span className="text-text-disabled">—</span>
}
