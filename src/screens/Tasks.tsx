import { useEffect, useMemo, useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, EmptyState, RoleChip } from "../components/ui"
import { BUILD_PHASES, type ProjectItem } from "../data"
import { listTasks, generateTasks, patchTask, deleteTask, syncTaskIssue, type Task, type TaskPatch } from "../lib/tasks"

const STATUS_TONE: Record<string, "success" | "blue" | "warning"> = { "완료": "success", "진행 중": "blue", "대기": "warning" }
const OWNERS: Task["owner"][] = ["ai", "human", "auto"]
const PRIORITIES = ["P1", "P2", "P3"]
const ESTIMATES = ["S", "M", "L"]
const STATUSES = ["대기", "진행 중", "완료"]

export default function TasksScreen({ project }: { project: ProjectItem | null }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selId, setSelId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TaskPatch>({})

  const sel = tasks.find((t) => t.id === selId) ?? null

  const load = (pid: string) =>
    listTasks(pid).then((ts) => {
      setTasks(ts)
      setSelId((cur) => cur && ts.some((t) => t.id === cur) ? cur : ts[0]?.id ?? null)
    })

  useEffect(() => {
    if (!project) return
    let alive = true
    setLoading(true)
    load(project.id)
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [project])

  useEffect(() => {
    if (sel) setDraft({ title: sel.title, detail: sel.detail, phase: sel.phase, repo: sel.repo, owner: sel.owner, priority: sel.priority, estimate: sel.estimate, status: sel.status })
  }, [selId, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const order = [...BUILD_PHASES, "기타"]
    const by = new Map<string, Task[]>()
    tasks.forEach((t) => {
      const key = BUILD_PHASES.includes(t.phase) ? t.phase : "기타"
      by.set(key, [...(by.get(key) ?? []), t])
    })
    return order.filter((p) => by.has(p)).map((p) => ({ phase: p, items: by.get(p)! }))
  }, [tasks])

  if (!project) {
    return (
      <div className="space-y-6">
        <SectionTitle title="작업 계획" desc="PRD·IA 문서를 근거로 에이전트가 작업을 분해하고, 관리자가 수정해요." />
        <EmptyState title="선택된 프로젝트가 없어요." desc="프로젝트 목록에서 프로젝트를 열면 그 프로젝트의 작업 계획을 볼 수 있어요." />
      </div>
    )
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError("")
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const regenerate = () => run(async () => {
    if (tasks.length && !window.confirm("현재 작업 계획(이슈 연결 포함)을 새 분해로 대체해요. 계속할까요?")) return
    setTasks(await generateTasks(project.id))
  })

  const save = () => run(async () => {
    if (!sel) return
    const updated = await patchTask(project.id, sel.id, draft)
    setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
  })

  const remove = () => run(async () => {
    if (!sel || !window.confirm(`${sel.code} 작업을 삭제할까요?`)) return
    await deleteTask(project.id, sel.id)
    setTasks((ts) => ts.filter((t) => t.id !== sel.id))
    setSelId(null)
  })

  const syncIssue = () => run(async () => {
    if (!sel) return
    const updated = await syncTaskIssue(project.id, sel.id)
    setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
  })

  const counts = {
    ai: tasks.filter((t) => t.owner === "ai").length,
    human: tasks.filter((t) => t.owner === "human").length,
    auto: tasks.filter((t) => t.owner === "auto").length,
    synced: tasks.filter((t) => t.issueNumber != null).length,
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="작업 계획"
        desc="PRD·IA 문서를 근거로 에이전트가 분해한 작업이에요. 각각 수정할 수 있고, 태스크별로 GitHub 이슈에 동기화해요."
        action={tasks.length ? (
          <Button variant="secondary" size="sm" onClick={regenerate} disabled={busy} icon={<Icon name="sparkle" className="h-4 w-4" />}>{busy ? "생성 중…" : "다시 분해"}</Button>
        ) : undefined}
      />

      {error && <div className="rounded-[12px] bg-error-light px-4 py-3 text-[13px] font-semibold text-error">{error}</div>}

      {loading ? (
        <Card className="p-10 text-center text-[13px] text-text-tertiary">작업을 불러오는 중…</Card>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="작업 계획이 아직 없어요."
          desc="PRD·IA 문서를 근거로 에이전트가 작업을 분해해요. 서버에 ANTHROPIC_API_KEY 가 있으면 Claude 가, 없으면 저장소 구성 기반 표준 분해가 초안을 만들어요."
          action={<Button variant="primary" onClick={regenerate} disabled={busy} icon={<Icon name="sparkle" className="h-4.5 w-4.5" />}>{busy ? "생성 중…" : "에이전트로 작업 분해"}</Button>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-3 text-[12px] text-text-secondary">
            <span className="font-bold text-text-primary">작업 {tasks.length}개</span>
            <span className="mx-1 text-line-strong">·</span>
            <RoleChip owner="ai" /> {counts.ai}
            <RoleChip owner="human" /> {counts.human}
            <RoleChip owner="auto" /> {counts.auto}
            <span className="mx-1 text-line-strong">·</span>
            <span>GitHub 이슈 동기화 <b className="text-text-primary">{counts.synced}</b></span>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[400px_1fr]">
            {/* 왼쪽: 단계별 작업 목록 */}
            <Card className="h-fit overflow-hidden p-2">
              {groups.map((g) => (
                <div key={g.phase}>
                  <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-text-disabled">{g.phase}</div>
                  {g.items.map((t) => (
                    <button key={t.id} onClick={() => setSelId(t.id)}
                      className={`flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left ${selId === t.id ? "bg-selected" : "hover:bg-hover"}`}>
                      <span className="font-mono text-[11px] font-bold text-text-tertiary">{t.code}</span>
                      <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${selId === t.id ? "text-blue" : "text-text-primary"}`}>{t.title}</span>
                      {t.issueNumber != null && <span className="font-mono text-[11px] font-bold text-success">#{t.issueNumber}</span>}
                      <RoleChip owner={t.owner} />
                      <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status}</Badge>
                    </button>
                  ))}
                </div>
              ))}
            </Card>

            {/* 오른쪽: 태스크 상세 · 수정 */}
            {sel ? (
              <Card className="h-fit p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-bold text-text-tertiary">{sel.code}</span>
                    <RoleChip owner={sel.owner} />
                    <Badge tone={sel.source === "agent" ? "purple" : sel.source === "human" ? "blue" : "neutral"}>
                      {sel.source === "agent" ? "에이전트 분해" : sel.source === "human" ? "사람 수정됨" : "템플릿 분해"}
                    </Badge>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="danger" size="sm" onClick={remove} disabled={busy}>삭제</Button>
                    <Button variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? "저장 중…" : "저장"}</Button>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-bold text-text-secondary">제목</span>
                    <input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="w-full rounded-[10px] border border-line px-3 py-2 text-[14px]" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-bold text-text-secondary">상세</span>
                    <textarea value={draft.detail ?? ""} onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                      className="h-28 w-full resize-y rounded-[10px] border border-line p-3 text-[13px] leading-relaxed" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Select label="단계" value={draft.phase ?? ""} onChange={(v) => setDraft({ ...draft, phase: v })} options={BUILD_PHASES} />
                    <Select label="담당 저장소" value={draft.repo ?? ""} onChange={(v) => setDraft({ ...draft, repo: v })} options={project.repos.map((r) => r.name)} />
                    <Select label="담당" value={draft.owner ?? "ai"} onChange={(v) => setDraft({ ...draft, owner: v as Task["owner"] })} options={OWNERS} />
                    <Select label="우선순위" value={draft.priority ?? "P2"} onChange={(v) => setDraft({ ...draft, priority: v })} options={PRIORITIES} />
                    <Select label="추정" value={draft.estimate ?? "M"} onChange={(v) => setDraft({ ...draft, estimate: v })} options={ESTIMATES} />
                    <Select label="상태" value={draft.status ?? "대기"} onChange={(v) => setDraft({ ...draft, status: v })} options={STATUSES} />
                  </div>

                  {/* GitHub 이슈 동기화 */}
                  <div className="rounded-[12px] bg-surface-2 p-4">
                    {sel.issueUrl ? (
                      <div className="flex items-center gap-2 text-[13px]">
                        <Icon name="github" className="h-4 w-4 text-text-secondary" />
                        <span className="font-semibold text-text-primary">이슈 동기화됨:</span>
                        <a href={sel.issueUrl} target="_blank" rel="noreferrer" className="font-mono text-[13px] font-bold text-blue hover:underline">#{sel.issueNumber}</a>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[12px] text-text-secondary">이 태스크를 담당 저장소의 GitHub 이슈로 만들어요. 설정에서 PAT 연결이 필요해요.</div>
                        <Button variant="secondary" size="sm" onClick={syncIssue} disabled={busy} icon={<Icon name="github" className="h-4 w-4" />}>이슈 생성</Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-10 text-center text-[13px] text-text-tertiary">왼쪽에서 작업을 선택하세요.</Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-text-secondary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-[10px] border border-line bg-surface px-2 text-[13px] outline-none focus:border-blue">
        {!options.includes(value) && value !== "" && <option value={value}>{value}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}
