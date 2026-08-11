import { useEffect, useMemo, useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, EmptyState, RoleChip, Toggle } from "../components/ui"
import { BUILD_PHASES, type ProjectItem } from "../data"
import { listTasks, generateTasks, patchTask, deleteTask, syncTaskIssue, kickoffTask, getTaskInsight, reviewTask, getDispatch, setDispatch, runDispatchNow, type Task, type TaskPatch, type TaskInsight, type DispatchStatus } from "../lib/tasks"

const STATUS_TONE: Record<string, "success" | "blue" | "warning" | "purple"> = { "완료": "success", "진행 중": "blue", "대기": "warning", "검토 대기": "purple" }
const OWNERS: Task["owner"][] = ["ai", "human", "auto"]
const PRIORITIES = ["P1", "P2", "P3"]
const ESTIMATES = ["S", "M", "L"]
const STATUSES = ["대기", "진행 중", "검토 대기", "완료"]

export default function TasksScreen({ project }: { project: ProjectItem | null }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selId, setSelId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TaskPatch>({})
  const [insight, setInsight] = useState<TaskInsight | null>(null)
  const [feedback, setFeedback] = useState("")
  const [dispatch, setDispatchState] = useState<DispatchStatus | null>(null)

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
    getDispatch(project.id).then((d) => { if (alive) setDispatchState(d) }).catch(() => {})
    return () => { alive = false }
  }, [project])

  useEffect(() => {
    if (sel) setDraft({ title: sel.title, detail: sel.detail, phase: sel.phase, repo: sel.repo, owner: sel.owner, priority: sel.priority, estimate: sel.estimate, status: sel.status })
  }, [selId, tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  // 선택한 태스크의 진행·결과 조회 — 조회 중 미러 동기화(자동 연결·자동 완료)가 반영될 수 있어 목록도 갱신
  useEffect(() => {
    if (!project || !selId) { setInsight(null); return }
    let alive = true
    getTaskInsight(project.id, selId)
      .then((ins) => {
        if (!alive) return
        setInsight(ins)
        return listTasks(project.id).then((ts) => { if (alive) setTasks(ts) })
      })
      .catch(() => { if (alive) setInsight(null) })
    return () => { alive = false }
  }, [project, selId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const kickoff = () => run(async () => {
    if (!sel) return
    const updated = await kickoffTask(project.id, sel.id)
    setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
    setInsight(await getTaskInsight(project.id, sel.id))
  })

  // 디스패치 조작 — 설정·실행 응답으로 상태를 갱신하고, 착수가 일어났으면 목록도 다시 불러요.
  const applyDispatch = async (st: DispatchStatus) => {
    setDispatchState(st)
    if (st.started.length > 0) await load(project.id)
  }
  const toggleDispatch = () => run(async () => applyDispatch(await setDispatch(project.id, { enabled: !(dispatch?.enabled ?? false) })))
  const toggleBoardAutoStart = () => run(async () => applyDispatch(await setDispatch(project.id, { boardAutoStart: !(dispatch?.boardAutoStart ?? true) })))
  const toggleReviewLoop = () => run(async () => applyDispatch(await setDispatch(project.id, { reviewLoop: !(dispatch?.reviewLoop ?? true) })))
  const changeReviewLimit = (n: number) => run(async () => applyDispatch(await setDispatch(project.id, { reviewRoundLimit: n })))
  const toggleCiRecovery = () => run(async () => applyDispatch(await setDispatch(project.id, { ciRecovery: !(dispatch?.ciRecovery ?? true) })))
  const changeLimit = (n: number) => run(async () => applyDispatch(await setDispatch(project.id, { limit: n })))
  const dispatchNow = () => run(async () => applyDispatch(await runDispatchNow(project.id)))

  const review = (action: "approve" | "feedback") => run(async () => {
    if (!sel) return
    const updated = await reviewTask(project.id, sel.id, action, action === "feedback" ? feedback : undefined)
    setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
    setFeedback("")
    setInsight(await getTaskInsight(project.id, sel.id))
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
        desc="PRD·IA 문서를 근거로 에이전트가 분해한 작업이에요. 각각 수정할 수 있고, 태스크별로 GitHub 이슈에 동기화해요. GitHub 이슈에 'agent-flow:분해' 라벨을 붙이면 그 이슈도 [T-00x] 작업들로 분해돼 여기에 추가돼요."
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
          desc="PRD·IA 문서를 근거로 에이전트가 작업을 분해해요. 서버에 ANTHROPIC_API_KEY(또는 OPENAI_API_KEY)가 있으면 에이전트가, 없으면 저장소 구성 기반 표준 분해가 초안을 만들어요."
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

          {/* 자동 디스패치 — 단계 순서·우선순위대로 동시 실행 한도 안에서 ai 작업 자동 착수 */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <Icon name="bolt" className="h-4 w-4 text-blue" />
                <span className="text-[13px] font-bold text-text-primary">자동 디스패치</span>
                <Toggle on={dispatch?.enabled ?? false} onChange={toggleDispatch} />
              </div>
              <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                동시 실행
                <select value={dispatch?.limit ?? 2} onChange={(e) => changeLimit(Number(e.target.value))}
                  className="h-8 rounded-[8px] border border-line bg-surface px-1.5 text-[12px] outline-none focus:border-blue">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-2" title="GitHub Projects 보드에서 카드를 In Progress 로 옮기면 매칭 작업을 자동 착수해요(B안). 끄면 보드 이동은 표시만 돼요.">
                <span className="text-[12px] font-semibold text-text-secondary">보드 이동 자동 착수</span>
                <Toggle on={dispatch?.boardAutoStart ?? true} onChange={toggleBoardAutoStart} />
              </div>
              {dispatch && (
                <span className="text-[12px] text-text-secondary">
                  현재 단계 <b className="text-text-primary">{dispatch.activePhase ?? "—"}</b>
                  <span className="mx-1 text-line-strong">·</span>
                  진행 중 <b className="text-blue">{dispatch.active}/{dispatch.limit}</b>
                  <span className="mx-1 text-line-strong">·</span>
                  대기 <b className="text-text-primary">{dispatch.waiting}</b>
                </span>
              )}
              <div className="ml-auto">
                <Button variant="secondary" size="sm" onClick={dispatchNow} disabled={busy} icon={<Icon name="play" className="h-4 w-4" />}>지금 실행</Button>
              </div>
            </div>
            {/* 루프 설정 — 리뷰 왕복·CI 회복도 프로젝트별로 켜고 끄고 한도를 조절해요 */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
              <div className="flex items-center gap-2" title="PR 이 열리거나 커밋이 push 되면 자동으로 리뷰를 지시해요. 한도 초과 시 자동 지시를 멈추고 사람 검토로 넘겨요.">
                <span className="text-[12px] font-semibold text-text-secondary">자동 리뷰 루프</span>
                <Toggle on={dispatch?.reviewLoop ?? true} onChange={toggleReviewLoop} />
              </div>
              <label className="flex items-center gap-1.5 text-[12px] text-text-secondary" title="PR 당 자동 리뷰 왕복 한도 — 초과하면 '리뷰 한도' 기록과 함께 사람 검토로 에스컬레이션">
                한도
                <select value={dispatch?.reviewRoundLimit ?? 3} onChange={(e) => changeReviewLimit(Number(e.target.value))}
                  disabled={!(dispatch?.reviewLoop ?? true)}
                  className="h-8 rounded-[8px] border border-line bg-surface px-1.5 text-[12px] outline-none focus:border-blue disabled:opacity-50">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                라운드
              </label>
              <div className="flex items-center gap-2" title="실패한 Actions 실행에 수정 지시를 자동으로 보내요(실행당 1회). 상태는 진행 흐름 화면의 CI 회복 카드에서 봐요.">
                <span className="text-[12px] font-semibold text-text-secondary">CI 자동 회복</span>
                <Toggle on={dispatch?.ciRecovery ?? true} onChange={toggleCiRecovery} />
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
              켜 두면 30초마다 현재 단계의 대기 중 AI 작업을 우선순위(P1→P3) 순으로, 동시 실행 한도 안에서 자동 착수해요(이슈 생성 + 에이전트 지시).
              앞 단계 작업이 모두 완료돼야 다음 단계로 넘어가요. 상태 동기화(이슈 닫힘→검토 대기)도 같은 주기로 서버가 돌려서, 화면을 열지 않아도 반영돼요.
            </p>
            {dispatch?.message && <div className="mt-2 rounded-[8px] bg-surface-2 px-3 py-2 text-[12px] font-medium text-text-secondary">{dispatch.message}</div>}
          </Card>

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

                  {/* 원클릭 에이전트 착수 — ai 담당 작업만. 이슈 생성 + @claude 착수 코멘트 */}
                  {sel.owner === "ai" && (sel.status === "대기" || sel.status === "진행 중") && (
                    <div className="rounded-[12px] border-2 border-blue/25 bg-blue-light p-4">
                      <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-blue"><Icon name="sparkle" className="h-4 w-4" />에이전트 착수</div>
                      <p className="mb-3 text-[12px] text-text-secondary">
                        이슈가 없으면 만들고, @claude 멘션 코멘트로 작업 내용·PR 제목 규칙(<code className="rounded bg-surface px-1 font-mono">[{sel.code}]</code>)·완료 기준을 전달해요.
                        저장소에 Claude GitHub App(claude-code-action)이 설치돼 있으면 에이전트가 브랜치를 만들어 구현하고 PR 을 올려요.
                      </p>
                      <div className="flex justify-end">
                        <Button variant="primary" size="sm" onClick={kickoff} disabled={busy} icon={<Icon name="bolt" className="h-4 w-4" />}>
                          {busy ? "착수 중…" : sel.status === "대기" ? "에이전트 착수" : "착수 지시 다시 보내기"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 검토 대기 — 완료는 사람만. 승인하거나 피드백으로 재개 */}
                  {sel.status === "검토 대기" && (
                    <div className="rounded-[12px] border-2 border-purple/30 bg-purple-light p-4">
                      <div className="mb-1 flex items-center gap-2 text-[13px] font-bold text-purple"><Icon name="hand" className="h-4 w-4" />검토 대기 — 사람 확인이 필요해요</div>
                      <p className="mb-3 text-[12px] text-text-secondary">결과(이슈·PR)를 확인한 뒤 완료를 승인하세요. 보완이 필요하면 피드백을 남기면 진행 중으로 재개되고, 연결 이슈가 있으면 다시 열어 @claude 코멘트로 전달해요.</p>
                      <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)}
                        placeholder="피드백 (예: 모바일에서 버튼 정렬이 어긋나요 — 수정 후 다시 올려주세요)"
                        className="mb-2 h-20 w-full resize-y rounded-[10px] border border-line bg-surface p-3 text-[13px]" />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => review("feedback")} disabled={busy || !feedback.trim()}>피드백 보내고 재개</Button>
                        <Button variant="primary" size="sm" onClick={() => review("approve")} disabled={busy}>검토 승인 · 완료</Button>
                      </div>
                    </div>
                  )}

                  {/* 진행·결과 — 활동 이력 + 연결 이슈 상태 + 매칭 PR */}
                  {insight && (
                    <div className="rounded-[12px] border border-line p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-wide text-text-disabled">진행·결과</span>
                        <span className="text-[11px] text-text-tertiary">이슈가 닫히면 검토 대기 — 완료는 사람이 승인해요</span>
                      </div>
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
                        <span className="font-bold text-text-secondary">결과:</span>
                        {sel.issueNumber != null ? (
                          <span className="flex items-center gap-1.5">
                            <Icon name="github" className="h-3.5 w-3.5 text-text-secondary" />
                            {sel.issueUrl ? <a href={sel.issueUrl} target="_blank" rel="noreferrer" className="font-mono font-bold text-blue hover:underline">#{sel.issueNumber}</a> : <span className="font-mono font-bold">#{sel.issueNumber}</span>}
                            <Badge tone={insight.issueState === "closed" ? "success" : "blue"}>{insight.issueState === "closed" ? "이슈 닫힘" : insight.issueState === "open" ? "이슈 열림" : "미러 대기"}</Badge>
                          </span>
                        ) : (
                          <span className="text-text-tertiary">연결된 이슈 없음</span>
                        )}
                        {insight.pulls.map((p) => (
                          <span key={p.number} className="flex items-center gap-1">
                            <Icon name="pr" className="h-3.5 w-3.5 text-text-secondary" />
                            {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="font-mono font-bold text-blue hover:underline">PR #{p.number}</a> : <span className="font-mono font-bold">PR #{p.number}</span>}
                            <Badge tone={p.merged ? "purple" : p.state === "open" ? "blue" : "neutral"}>{p.merged ? "머지됨" : p.state === "open" ? "열림" : "닫힘"}</Badge>
                          </span>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {insight.activity.length === 0 && <div className="text-[12px] text-text-tertiary">아직 활동 기록이 없어요.</div>}
                        {insight.activity.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 text-[12px]">
                            <Badge tone={a.kind === "완료" ? "success" : a.kind === "검토 대기" ? "purple" : a.kind === "피드백" ? "warning" : a.kind === "이슈 연결" || a.kind === "재개" ? "blue" : a.kind === "생성" ? "purple" : "neutral"}>{a.kind}</Badge>
                            <span className="min-w-0 flex-1 text-text-primary">{a.note}</span>
                            <span className="shrink-0 font-mono text-[11px] text-text-tertiary">{a.at.slice(5, 16).replace("T", " ")}</span>
                          </div>
                        ))}
                      </div>

                      {/* 코멘트 미러 — 연결 이슈·PR 의 대화(에이전트 리뷰·결과 회신 포함) */}
                      {insight.comments.length > 0 && (
                        <div className="mt-3 border-t border-line pt-3">
                          <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-disabled">코멘트 (이슈·PR)</div>
                          <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                            {insight.comments.map((c, i) => (
                              <div key={i} className="rounded-[10px] bg-surface-2 p-2.5">
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  <span className="font-bold text-text-secondary">{c.user ?? "?"}</span>
                                  <Badge tone={c.kind === "review" ? "purple" : "neutral"}>{c.kind === "review" ? "리뷰" : `#${c.number}`}</Badge>
                                  {c.at && <span className="ml-auto font-mono text-text-tertiary">{c.at.slice(5, 16).replace("T", " ")}</span>}
                                  {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-blue hover:underline">열기</a>}
                                </div>
                                <div className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text-primary">{c.body.length > 400 ? c.body.slice(0, 400) + "…" : c.body}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
