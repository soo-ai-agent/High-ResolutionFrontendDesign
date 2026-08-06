import { useEffect, useMemo, useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, EmptyState } from "../components/ui"
import * as mirror from "../lib/mirror"
import type { MirrorIssue, MirrorPull } from "../lib/mirror"

// GitHub Projects(v2) 보드를 미러로 관찰하는 뷰 전용 칸반.
// 프로젝트가 여러 저장소를 묶고(1:N), 보드는 그 저장소들의 이슈·PR을 한 곳에 집계해요.
// 카드는 GitHub 이벤트(kanban.yml)로 자동 이동하고, 사람이 옮기지 않아요.

const COLUMNS = ["Backlog", "Todo", "In Progress", "In Review", "Done"]
const COL_TONE: Record<string, string> = { Backlog: "bg-[#8b95a1]", Todo: "bg-blue", "In Progress": "bg-purple", "In Review": "bg-warning", Done: "bg-success" }

type BoardCard = { key: string; kind: "이슈" | "PR"; repo: string; number: number; title: string; url: string; labels: string[]; column: string; fromBoard: boolean }

// stage·state 로 추론한 컬럼 (보드 상태가 없을 때 폴백)
function issueColumn(it: MirrorIssue): string {
  if (it.state === "closed") return "Done"
  switch (it.stage) {
    case "완료": return "Done"
    case "검토": return "In Review"
    case "빌드 중": return "In Progress"
    case "계획": return "Todo"
    default: return "Backlog"
  }
}
function pullColumn(p: MirrorPull): string {
  if (p.merged || p.state === "closed") return "Done"
  return "In Review"
}

// 실제 GitHub Projects 보드 상태(projects_v2_item)를 컬럼으로 매칭
const SYN: Record<string, string> = { "in progress": "In Progress", "in review": "In Review", todo: "Todo", "to do": "Todo", done: "Done", backlog: "Backlog", "in-progress": "In Progress" }
function matchBoardColumn(status?: string | null): string | null {
  if (!status) return null
  const s = status.trim().toLowerCase()
  const hit = COLUMNS.find((c) => c.toLowerCase() === s)
  return hit ?? SYN[s] ?? null
}

export default function Board() {
  const [issues, setIssues] = useState<MirrorIssue[]>([])
  const [pulls, setPulls] = useState<MirrorPull[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [repoFilter, setRepoFilter] = useState("all")

  const load = async () => {
    setLoading(true)
    setErr("")
    try {
      const [i, p] = await Promise.all([mirror.listIssues(), mirror.listPulls()])
      setIssues(i)
      setPulls(p)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const cards = useMemo<BoardCard[]>(
    () => [
      ...issues.map((it) => {
        const board = matchBoardColumn(it.boardStatus)
        return { key: `i-${it.repo}#${it.number}`, kind: "이슈" as const, repo: it.repo, number: it.number, title: it.title, url: it.html_url, labels: it.labels, column: board ?? issueColumn(it), fromBoard: !!board }
      }),
      ...pulls.map((p) => {
        const board = matchBoardColumn(p.boardStatus)
        return { key: `p-${p.repo}#${p.number}`, kind: "PR" as const, repo: p.repo, number: p.number, title: p.title, url: p.html_url, labels: [], column: board ?? pullColumn(p), fromBoard: !!board }
      }),
    ],
    [issues, pulls],
  )

  const repos = useMemo(() => [...new Set(cards.map((c) => c.repo))], [cards])
  const shown = repoFilter === "all" ? cards : cards.filter((c) => c.repo === repoFilter)
  const isEmpty = !loading && cards.length === 0

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Projects 보드"
        desc="프로젝트의 저장소들을 하나의 GitHub Projects 보드로 집계해 관찰해요. 카드는 이벤트로 자동 이동해요."
        action={<Button icon={<Icon name="sync" className="h-4 w-4" />} onClick={load} loading={loading}>새로고침</Button>}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-2.5 text-[12px] text-text-secondary">
        <Icon name="board" className="h-4 w-4 text-text-tertiary" />
        <span><b className="text-text-primary">뷰 전용</b> — 카드는 GitHub 이벤트로 자동 이동해요. 실제 보드 이동은 <code className="font-mono">projects_v2_item</code>로 반영되고(<span className="font-bold text-success">보드 반영</span>), GitHub Projects에서 카드를 <b className="text-purple">In Progress</b>로 옮기면 매칭된 대기 중 AI 작업이 <b className="text-purple">자동 착수</b>돼요.</span>
        <span className="mx-1 text-line-strong">·</span>
        <span>집계 저장소 <b className="text-text-primary">{repos.length}</b>개</span>
      </div>

      {err && <div className="rounded-[10px] bg-error-light px-3 py-2 text-[13px] font-semibold text-error">{err}</div>}

      {isEmpty ? (
        <EmptyState
          title="보드에 카드가 없어요."
          desc="각 저장소에 .github/workflows/kanban.yml 을 넣고 PROJECT_URL 을 같은 보드로 지정하면, 이슈·PR이 웹훅으로 미러되어 여기에 집계돼요."
          action={<Button icon={<Icon name="sync" className="h-4 w-4" />} onClick={load}>다시 확인</Button>}
        />
      ) : (
        <>
          {/* 저장소 필터 — 집계된 저장소 중 선택 */}
          {repos.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] font-semibold text-text-tertiary">저장소</span>
              <FilterPill label="전체" active={repoFilter === "all"} onClick={() => setRepoFilter("all")} />
              {repos.map((r) => <FilterPill key={r} label={r} active={repoFilter === r} onClick={() => setRepoFilter(r)} />)}
            </div>
          )}

          <div className="flex gap-4 overflow-x-auto pb-3">
            {COLUMNS.map((col) => {
              const items = shown.filter((c) => c.column === col)
              return (
                <div key={col} className="w-[280px] shrink-0">
                  <div className="mb-3 flex items-center gap-2 px-1">
                    <span className={`h-2 w-2 rounded-full ${COL_TONE[col]}`} />
                    <span className="text-[13px] font-bold text-text-primary">{col}</span>
                    <span className="rounded-full bg-[#eef1f4] px-2 py-0.5 text-[11px] font-bold text-text-tertiary">{items.length}</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((c) => <BoardCardView key={c.key} card={c} showRepo={repoFilter === "all"} />)}
                    {items.length === 0 && <div className="rounded-[12px] border border-dashed border-line py-8 text-center text-[12px] text-text-disabled">비어 있음</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function BoardCardView({ card, showRepo }: { card: BoardCard; showRepo: boolean }) {
  return (
    <a href={card.url} target="_blank" rel="noreferrer" className="block rounded-[12px] border border-line bg-surface p-3.5 transition-colors hover:border-line-strong hover:bg-hover">
      <div className="flex items-center gap-2 text-[12px]">
        <Badge tone={card.kind === "PR" ? "purple" : "blue"}>{card.kind}</Badge>
        <span className="font-mono font-bold text-text-secondary">#{card.number}</span>
        {card.fromBoard && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-bold text-success" title="실제 GitHub Projects 보드 상태">보드 반영</span>}
      </div>
      <div className="mt-2 text-[13px] font-bold leading-snug text-text-primary">{card.title}</div>
      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.labels.map((l) => <span key={l} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">{l}</span>)}
        </div>
      )}
      {showRepo && (
        <div className="mt-2.5 flex items-center gap-1 border-t border-line pt-2 text-[11px] text-text-tertiary">
          <Icon name="github" className="h-3.5 w-3.5" /><span className="truncate font-mono">{card.repo}</span>
        </div>
      )}
    </a>
  )
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${active ? "bg-blue text-white" : "border border-line bg-surface text-text-secondary hover:bg-hover"}`}>
      {label}
    </button>
  )
}
