import { useEffect, useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, Tabs, EmptyState } from "../components/ui"
import * as mirror from "../lib/mirror"
import type { MirrorIssue, MirrorPull, MirrorRun, MirrorEvent, MirrorSummary } from "../lib/mirror"

const STAGE_OPTS = ["초안", "계획", "빌드 중", "검토", "완료"]
const PRIORITY_OPTS = ["낮음", "중간", "높음"]

const fmt = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "—")

export default function Mirror() {
  const [tab, setTab] = useState("이슈")
  const [summary, setSummary] = useState<MirrorSummary | null>(null)
  const [issues, setIssues] = useState<MirrorIssue[]>([])
  const [pulls, setPulls] = useState<MirrorPull[]>([])
  const [runs, setRuns] = useState<MirrorRun[]>([])
  const [events, setEvents] = useState<MirrorEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")

  const load = async () => {
    setLoading(true)
    setErr("")
    try {
      const [s, i, p, r, e] = await Promise.all([mirror.getSummary(), mirror.listIssues(), mirror.listPulls(), mirror.listRuns(), mirror.listEvents()])
      setSummary(s)
      setIssues(i)
      setPulls(p)
      setRuns(r)
      setEvents(e)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  // 관리 확장 편집 — 낙관적 업데이트 후 PATCH, 실패 시 롤백.
  const patchIssue = async (it: MirrorIssue, field: "stage" | "priority", value: string | null) => {
    const prev = issues
    setIssues((xs) => xs.map((x) => (x.repo === it.repo && x.number === it.number ? { ...x, [field]: value } : x)))
    try {
      await mirror.setIssueAdmin(it.repo, it.number, { [field]: value })
    } catch {
      setIssues(prev)
    }
  }

  const isEmpty = !!summary && summary.issues + summary.pulls + summary.runs + summary.events === 0

  return (
    <div className="space-y-6">
      <SectionTitle
        title="GitHub 미러"
        desc="GitHub → 웹훅 → DB 미러를 실시간으로 읽어와요."
        action={<Button icon={<Icon name="sync" className="h-4 w-4" />} onClick={load} loading={loading}>새로고침</Button>}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-2.5 text-[12px] text-text-secondary">
        <Icon name="github" className="h-4 w-4 text-text-tertiary" />
        <span>이슈·PR·Actions는 GitHub가 원천이고 화면은 <b className="text-text-primary">미러(읽기)</b>예요.</span>
        <span className="mx-1 text-line-strong">·</span>
        <span><b className="text-[#b47908]">stage·priority</b>는 어드민 확장 필드로, GitHub로는 반영되지 않아요.</span>
        {summary?.updatedAt && <span className="ml-auto text-text-tertiary">마지막 동기화 {fmt(summary.updatedAt)}</span>}
      </div>

      {err && <div className="rounded-[10px] bg-error-light px-3 py-2 text-[13px] font-semibold text-error">{err}</div>}

      <div className="flex flex-wrap gap-3">
        <Metric label="저장소" value={summary?.repos ?? 0} />
        <Metric label="이슈" value={summary?.issues ?? 0} tone="blue" />
        <Metric label="PR" value={summary?.pulls ?? 0} tone="purple" />
        <Metric label="Actions" value={summary?.runs ?? 0} tone="success" />
        <Metric label="수신 이벤트" value={summary?.events ?? 0} />
      </div>

      {isEmpty && !loading ? (
        <EmptyState
          title="아직 미러된 데이터가 없어요."
          desc="GitHub 저장소 Webhook을 서버의 /api/webhook/github 로 설정하면, 이슈·PR·Actions 이벤트가 실시간으로 여기에 나타나요."
          action={<Button icon={<Icon name="sync" className="h-4 w-4" />} onClick={load}>다시 확인</Button>}
        />
      ) : (
        <>
          <Tabs tabs={["이슈", "PR", "Actions", "이벤트"]} active={tab} onChange={setTab} />
          {tab === "이슈" && <IssueTable issues={issues} onPatch={patchIssue} />}
          {tab === "PR" && <PullTable pulls={pulls} />}
          {tab === "Actions" && <RunTable runs={runs} />}
          {tab === "이벤트" && <EventTable events={events} />}
        </>
      )}
    </div>
  )
}

function IssueTable({ issues, onPatch }: { issues: MirrorIssue[]; onPatch: (it: MirrorIssue, f: "stage" | "priority", v: string | null) => void }) {
  if (issues.length === 0) return <Empty text="미러된 이슈가 없어요." />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <Thead cols={["이슈", "제목", "상태", "라벨", "담당", "stage (확장)", "priority (확장)", "링크"]} />
        <tbody>
          {issues.map((it) => (
            <tr key={`${it.repo}#${it.number}`} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
              <td className="px-4 py-3 font-mono font-bold text-text-secondary">#{it.number}</td>
              <td className="px-4 py-3 font-semibold text-text-primary">{it.title}</td>
              <td className="px-4 py-3"><Badge tone={it.state === "open" ? "blue" : "neutral"}>{it.state}</Badge></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">{it.labels.map((l) => <span key={l} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">{l}</span>)}</div>
              </td>
              <td className="px-4 py-3 text-text-tertiary">{it.user ?? "—"}</td>
              <td className="px-4 py-3"><AdminSelect value={it.stage} opts={STAGE_OPTS} onChange={(v) => onPatch(it, "stage", v)} /></td>
              <td className="px-4 py-3"><AdminSelect value={it.priority} opts={PRIORITY_OPTS} onChange={(v) => onPatch(it, "priority", v)} /></td>
              <td className="px-4 py-3"><a href={it.html_url} target="_blank" rel="noreferrer" className="text-blue hover:underline"><Icon name="external" className="h-4 w-4" /></a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function AdminSelect({ value, opts, onChange }: { value: string | null; opts: string[]; onChange: (v: string | null) => void }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-blue"
    >
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function PullTable({ pulls }: { pulls: MirrorPull[] }) {
  if (pulls.length === 0) return <Empty text="미러된 PR이 없어요." />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <Thead cols={["PR", "제목", "상태", "담당", "링크"]} />
        <tbody>
          {pulls.map((p) => (
            <tr key={`${p.repo}#${p.number}`} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
              <td className="px-4 py-3 font-mono font-bold text-blue">#{p.number}</td>
              <td className="px-4 py-3 font-semibold text-text-primary">{p.title}</td>
              <td className="px-4 py-3">
                <Badge tone={p.merged ? "purple" : p.draft ? "neutral" : p.state === "open" ? "blue" : "neutral"}>{p.merged ? "merged" : p.draft ? "draft" : p.state}</Badge>
              </td>
              <td className="px-4 py-3 text-text-tertiary">{p.user ?? "—"}</td>
              <td className="px-4 py-3"><a href={p.html_url} target="_blank" rel="noreferrer" className="text-blue hover:underline"><Icon name="external" className="h-4 w-4" /></a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function RunTable({ runs }: { runs: MirrorRun[] }) {
  if (runs.length === 0) return <Empty text="미러된 Actions 실행이 없어요." />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <Thead cols={["Workflow", "브랜치", "상태", "결과", "링크"]} />
        <tbody>
          {runs.map((r) => (
            <tr key={`${r.repo}#${r.id}`} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
              <td className="px-4 py-3 font-semibold text-text-primary">{r.name}</td>
              <td className="px-4 py-3 font-mono text-text-tertiary">{r.head_branch}</td>
              <td className="px-4 py-3"><Badge tone={r.status === "completed" ? "neutral" : "blue"}>{r.status}</Badge></td>
              <td className="px-4 py-3">{r.conclusion ? <Badge tone={r.conclusion === "success" ? "success" : r.conclusion === "failure" ? "error" : "warning"}>{r.conclusion}</Badge> : <span className="text-text-tertiary">—</span>}</td>
              <td className="px-4 py-3"><a href={r.html_url} target="_blank" rel="noreferrer" className="text-blue hover:underline"><Icon name="external" className="h-4 w-4" /></a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function EventTable({ events }: { events: MirrorEvent[] }) {
  if (events.length === 0) return <Empty text="수신된 웹훅 이벤트가 없어요." />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <Thead cols={["검증", "이벤트", "요약", "저장소", "수신 시각"]} />
        <tbody>
          {events.map((e, i) => (
            <tr key={(e.id ?? "") + i} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
              <td className="px-4 py-3">{e.verified ? <Badge tone="success">서명 확인</Badge> : <Badge tone="warning">미검증</Badge>}</td>
              <td className="px-4 py-3 font-mono font-semibold text-text-secondary">{e.event}</td>
              <td className="px-4 py-3 text-text-primary">{e.summary}</td>
              <td className="px-4 py-3 font-mono text-[12px] text-text-tertiary">{e.repo ?? "—"}</td>
              <td className="px-4 py-3 text-text-tertiary">{fmt(e.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Thead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
        {cols.map((c) => <th key={c} className="px-4 py-3">{c}</th>)}
      </tr>
    </thead>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[12px] border border-dashed border-line bg-surface-2 py-12 text-center text-[13px] text-text-tertiary">{text}</div>
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  const color = tone === "success" ? "text-success" : tone === "error" ? "text-error" : tone === "blue" ? "text-blue" : tone === "purple" ? "text-purple" : "text-text-primary"
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
      <div className="text-[12px] font-medium text-text-tertiary">{label}</div>
      <div className={`text-[20px] font-bold ${color}`}>{value}</div>
    </div>
  )
}
