import { useEffect, useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, Tabs, EmptyState, Modal } from "../components/ui"
import * as mirror from "../lib/mirror"
import type { MirrorIssue, MirrorPull, MirrorRun, MirrorEvent, MirrorSummary } from "../lib/mirror"
import { useGitHub, createIssue, mentionClaude, listHooks, createHook, pingHook } from "../lib/github"
import type { GHHook } from "../lib/github"

const STAGE_OPTS = ["초안", "계획", "빌드 중", "검토", "완료"]
const PRIORITY_OPTS = ["낮음", "중간", "높음"]

const fmt = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "—")

type ClaudeTarget = { owner: string; repo: string; number: number; title: string; kind: "이슈" | "PR" }
const splitRepo = (full: string) => {
  const [owner, ...rest] = full.split("/")
  return { owner, repo: rest.join("/") }
}

export default function Mirror({ navigate }: { navigate: (r: string) => void }) {
  const { connected } = useGitHub()
  const [tab, setTab] = useState("이슈")
  const [summary, setSummary] = useState<MirrorSummary | null>(null)
  const [issues, setIssues] = useState<MirrorIssue[]>([])
  const [pulls, setPulls] = useState<MirrorPull[]>([])
  const [runs, setRuns] = useState<MirrorRun[]>([])
  const [events, setEvents] = useState<MirrorEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")

  // 쓰기 상태
  const [creating, setCreating] = useState(false)
  const [claudeTarget, setClaudeTarget] = useState<ClaudeTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [writeMsg, setWriteMsg] = useState<{ text: string; url: string } | null>(null)
  const [writeErr, setWriteErr] = useState("")
  // 이슈 생성 폼
  const [repoInput, setRepoInput] = useState("")
  const [title, setTitle] = useState("")
  const [bodyText, setBodyText] = useState("")
  const [labels, setLabels] = useState("")
  // @claude 폼
  const [prompt, setPrompt] = useState("")

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

  const patchIssue = async (it: MirrorIssue, field: "stage" | "priority", value: string | null) => {
    const prev = issues
    setIssues((xs) => xs.map((x) => (x.repo === it.repo && x.number === it.number ? { ...x, [field]: value } : x)))
    try {
      await mirror.setIssueAdmin(it.repo, it.number, { [field]: value })
    } catch {
      setIssues(prev)
    }
  }

  const openCreate = () => {
    setRepoInput(issues[0]?.repo ?? "")
    setCreating(true)
  }

  const submitIssue = async () => {
    const { owner, repo } = splitRepo(repoInput.trim())
    if (!owner || !repo || !title.trim()) return
    setBusy(true)
    setWriteErr("")
    try {
      const labelArr = labels.split(",").map((s) => s.trim()).filter(Boolean)
      const res = await createIssue(owner, repo, { title: title.trim(), body: bodyText, labels: labelArr })
      setWriteMsg({ text: `이슈 #${res.number} 를 생성했어요 · 웹훅으로 곧 미러에 나타나요.`, url: res.html_url })
      setCreating(false)
      setTitle("")
      setBodyText("")
      setLabels("")
      window.setTimeout(load, 1500)
    } catch (e) {
      setWriteErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const submitClaude = async () => {
    if (!claudeTarget || !prompt.trim()) return
    setBusy(true)
    setWriteErr("")
    try {
      const res = await mentionClaude(claudeTarget.owner, claudeTarget.repo, claudeTarget.number, prompt.trim())
      setWriteMsg({ text: `${claudeTarget.kind} #${claudeTarget.number} 에 @claude 코멘트를 남겼어요 · Claude Action이 트리거돼요.`, url: res.html_url })
      setClaudeTarget(null)
      setPrompt("")
    } catch (e) {
      setWriteErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const askClaude = (repo: string, number: number, tTitle: string, kind: "이슈" | "PR") => {
    const { owner, repo: name } = splitRepo(repo)
    setPrompt("")
    setWriteErr("")
    setClaudeTarget({ owner, repo: name, number, title: tTitle, kind })
  }

  const isEmpty = !!summary && summary.issues + summary.pulls + summary.runs + summary.events === 0

  return (
    <div className="space-y-6">
      <SectionTitle
        title="GitHub 미러"
        desc="GitHub → 웹훅 → DB 미러를 실시간으로 읽고, 이슈 생성·@claude 요청은 서버 프록시로 GitHub에 써요."
        action={
          <div className="flex gap-2">
            <Button icon={<Icon name="sync" className="h-4 w-4" />} onClick={load} loading={loading}>새로고침</Button>
            <Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />} onClick={openCreate}>이슈 생성</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-2.5 text-[12px] text-text-secondary">
        <Icon name="github" className="h-4 w-4 text-text-tertiary" />
        <span>읽기는 <b className="text-text-primary">미러</b>, 쓰기는 <b className="text-text-primary">서버 프록시</b>(<code className="font-mono">/api/github</code>)로 GitHub에 단방향. 결과는 웹훅으로 다시 미러에 반영돼요.</span>
        {summary?.updatedAt && <span className="ml-auto text-text-tertiary">마지막 동기화 {fmt(summary.updatedAt)}</span>}
      </div>

      <WebhookSetup connected={connected} navigate={navigate} defaultRepo={issues[0]?.repo ?? ""} />

      {writeMsg && (
        <div className="flex items-center justify-between gap-2 rounded-[10px] bg-success-light px-4 py-2.5 text-[13px] font-semibold text-success">
          <span>{writeMsg.text} <a href={writeMsg.url} target="_blank" rel="noreferrer" className="underline">GitHub에서 보기</a></span>
          <button onClick={() => setWriteMsg(null)} aria-label="닫기"><Icon name="close" className="h-4 w-4" /></button>
        </div>
      )}
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
          desc="GitHub 저장소 Webhook을 서버의 /api/webhook/github 로 설정하면 이슈·PR·Actions 이벤트가 실시간으로 나타나요. 위 ‘이슈 생성’으로 첫 이슈를 만들 수도 있어요."
          action={<Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />} onClick={openCreate}>이슈 생성</Button>}
        />
      ) : (
        <>
          <Tabs tabs={["이슈", "PR", "Actions", "이벤트"]} active={tab} onChange={setTab} />
          {tab === "이슈" && <IssueTable issues={issues} onPatch={patchIssue} onClaude={(it) => askClaude(it.repo, it.number, it.title, "이슈")} />}
          {tab === "PR" && <PullTable pulls={pulls} onClaude={(p) => askClaude(p.repo, p.number, p.title, "PR")} />}
          {tab === "Actions" && <RunTable runs={runs} />}
          {tab === "이벤트" && <EventTable events={events} />}
        </>
      )}

      {/* 이슈 생성 */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="이슈 생성"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>취소</Button>
            <Button variant="primary" onClick={submitIssue} loading={busy} disabled={!repoInput.trim() || !title.trim()}>생성</Button>
          </>
        }
      >
        <div className="space-y-3 text-left">
          <Field label="저장소 (owner/repo)"><input value={repoInput} onChange={(e) => setRepoInput(e.target.value)} placeholder="예: sample-org/admin-web" className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 font-mono text-[13px] outline-none focus:border-blue" /></Field>
          <Field label="제목"><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="이슈 제목" className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-blue" /></Field>
          <Field label="본문"><textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} placeholder="이슈 내용" className="w-full rounded-[10px] border border-line bg-surface p-3 text-[14px] outline-none focus:border-blue" /></Field>
          <Field label="라벨 (쉼표로 구분, 선택)"><input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="auth, bug" className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] outline-none focus:border-blue" /></Field>
          {!connected && <ConnectHint navigate={navigate} />}
          {writeErr && <div className="rounded-[10px] bg-error-light px-3 py-2 text-[12px] font-semibold text-error">{writeErr}</div>}
        </div>
      </Modal>

      {/* @claude 요청 */}
      <Modal
        open={!!claudeTarget}
        onClose={() => setClaudeTarget(null)}
        title={claudeTarget ? `@claude 요청 · ${claudeTarget.kind} #${claudeTarget.number}` : ""}
        footer={
          <>
            <Button onClick={() => setClaudeTarget(null)}>취소</Button>
            <Button variant="primary" onClick={submitClaude} loading={busy} disabled={!prompt.trim()}>코멘트 남기기</Button>
          </>
        }
      >
        <div className="space-y-3 text-left">
          <p className="text-[13px] text-text-secondary">이 {claudeTarget?.kind}에 <b className="text-purple">@claude</b> 코멘트를 남겨 Claude GitHub Action을 트리거해요.</p>
          <Field label="요청 내용"><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} autoFocus rows={4} placeholder="예: 이 이슈의 로그인 실패 흐름을 TDD로 구현해줘" className="w-full rounded-[10px] border border-line bg-surface p-3 text-[14px] outline-none focus:border-blue" /></Field>
          <div className="rounded-[10px] bg-surface-2 p-2.5 font-mono text-[12px] text-text-secondary">@claude {prompt || "…"}</div>
          {!connected && <ConnectHint navigate={navigate} />}
          {writeErr && <div className="rounded-[10px] bg-error-light px-3 py-2 text-[12px] font-semibold text-error">{writeErr}</div>}
        </div>
      </Modal>
    </div>
  )
}

function WebhookSetup({ connected, navigate, defaultRepo }: { connected: boolean; navigate: (r: string) => void; defaultRepo: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const receiver = `${origin}/api/webhook/github`
  const [open, setOpen] = useState(false)
  const [repo, setRepo] = useState(defaultRepo)
  const [url, setUrl] = useState(receiver)
  const [secret, setSecret] = useState("")
  const [hooks, setHooks] = useState<GHHook[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")

  const parsed = () => splitRepo(repo.trim())
  const load = async () => {
    const { owner, repo: name } = parsed()
    if (!owner || !name) return setError("저장소를 owner/repo 형식으로 입력해 주세요.")
    setBusy(true); setError(""); setMsg("")
    try {
      const hs = await listHooks(owner, name)
      setHooks(hs)
      setMsg(hs.length ? `등록된 웹훅 ${hs.length}개를 찾았어요.` : "등록된 웹훅이 없어요. 아래에서 등록하세요.")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const create = async () => {
    const { owner, repo: name } = parsed()
    if (!owner || !name || !url.trim()) return setError("저장소와 전달 URL이 필요해요.")
    setBusy(true); setError(""); setMsg("")
    try {
      const h = await createHook(owner, name, { url: url.trim(), secret: secret.trim() || undefined })
      setHooks((xs) => [h, ...xs.filter((x) => x.id !== h.id)])
      setMsg(`웹훅 #${h.id}을(를) 등록했어요${secret.trim() ? " · 같은 시크릿을 서버 GITHUB_WEBHOOK_SECRET 로도 설정하세요." : " · 시크릿 없이 등록돼 이벤트는 ‘미검증’으로 표시돼요."}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const ping = async (id: number) => {
    const { owner, repo: name } = parsed()
    if (!owner || !name) return
    setBusy(true); setError(""); setMsg("")
    try {
      await pingHook(owner, name, id)
      setMsg(`웹훅 #${id}에 ping을 보냈어요 · ‘이벤트’ 탭에서 수신을 확인하세요.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-0">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue-light text-blue"><Icon name="sync" className="h-4.5 w-4.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-bold text-text-primary">웹훅 연결 <span className="ml-1 align-middle text-[11px] font-semibold text-text-tertiary">GitHub → 서버 수신</span></div>
          <div className="truncate text-[12px] text-text-tertiary">저장소에 수신 웹훅을 등록하면 이슈·PR·Actions가 실시간으로 미러에 반영돼요.</div>
        </div>
        <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-4 text-left">
          {/* 수신 엔드포인트 */}
          <div className="rounded-[10px] bg-surface-2 p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-disabled">서버 수신 엔드포인트</div>
            <code className="block break-all font-mono text-[12px] font-semibold text-text-primary">{receiver}</code>
            <div className="mt-1.5 text-[11px] text-text-tertiary">content type <code className="font-mono">application/json</code> · 서명 <code className="font-mono">x-hub-signature-256</code> (HMAC-SHA256)</div>
          </div>

          {/* 공개 URL 안내 — 정직하게 */}
          <div className="flex items-start gap-2 rounded-[10px] bg-warning-light px-3 py-2.5 text-[12px] text-[#8a6d1a]">
            <Icon name="help" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>이 <b>미리보기</b>에는 공개 주소가 없어 GitHub가 직접 수신할 수 없어요. 실제 수신은 서버를 배포(<code className="font-mono">pnpm serve</code>)해 공개 URL로 노출하거나, 로컬은 <code className="font-mono">smee.io</code>·<code className="font-mono">cloudflared</code> 터널의 URL을 아래 ‘전달 URL’에 넣으세요.</span>
          </div>

          {!connected && <ConnectHint navigate={navigate} />}

          {/* 등록 폼 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="저장소 (owner/repo)"><input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="soo-ai-agent/high-resolutionfrontenddesign" className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 font-mono text-[13px] outline-none focus:border-blue" /></Field>
            <Field label="전달 URL (공개 수신 주소)"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-host/api/webhook/github" className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 font-mono text-[12px] outline-none focus:border-blue" /></Field>
          </div>
          <Field label="시크릿 (선택 · 서버 GITHUB_WEBHOOK_SECRET 과 동일하게)"><input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" placeholder="비우면 서명 미검증(개발용)" className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] outline-none focus:border-blue" /></Field>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={create} loading={busy} disabled={!connected}>웹훅 등록</Button>
            <Button onClick={load} loading={busy} disabled={!connected}>등록 목록 조회</Button>
          </div>

          {msg && <div className="rounded-[10px] bg-success-light px-3 py-2 text-[12px] font-semibold text-success">{msg}</div>}
          {error && <div className="rounded-[10px] bg-error-light px-3 py-2 text-[12px] font-semibold text-error">{error}</div>}

          {hooks.length > 0 && (
            <div className="divide-y divide-line rounded-[10px] border border-line">
              {hooks.map((h) => (
                <div key={h.id} className="flex items-center gap-2 px-3 py-2.5 text-[12px]">
                  <Badge tone={h.active ? "success" : "neutral"}>{h.active ? "active" : "off"}</Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-text-secondary" title={h.url}>{h.url}</span>
                  {h.last_code != null && <span className="text-text-tertiary">last {h.last_code}</span>}
                  <button onClick={() => ping(h.id)} disabled={busy} className="rounded-[8px] bg-surface-2 px-2.5 py-1 font-semibold text-text-secondary hover:bg-hover disabled:opacity-50">ping</button>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-text-tertiary">등록되는 이벤트: <code className="font-mono">issues · pull_request · workflow_run · push</code>. 실제 보드 이동(<code className="font-mono">projects_v2_item</code>)은 조직 레벨 이벤트라 조직 설정의 웹훅에서 따로 켜야 해요.</p>
        </div>
      )}
    </Card>
  )
}

function ConnectHint({ navigate }: { navigate: (r: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-warning-light px-3 py-2 text-[12px] font-semibold text-[#b47908]">
      <Icon name="github" className="h-4 w-4" />GitHub 연결이 필요해요.
      <button onClick={() => navigate("settings")} className="underline">설정에서 연결</button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-bold text-text-primary">{label}</label>
      {children}
    </div>
  )
}

function IssueTable({ issues, onPatch, onClaude }: { issues: MirrorIssue[]; onPatch: (it: MirrorIssue, f: "stage" | "priority", v: string | null) => void; onClaude: (it: MirrorIssue) => void }) {
  if (issues.length === 0) return <Empty text="미러된 이슈가 없어요." />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[960px]">
        <Thead cols={["이슈", "제목", "상태", "라벨", "stage (확장)", "priority (확장)", "액션"]} />
        <tbody>
          {issues.map((it) => (
            <tr key={`${it.repo}#${it.number}`} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
              <td className="px-4 py-3 font-mono font-bold text-text-secondary">#{it.number}</td>
              <td className="px-4 py-3 font-semibold text-text-primary">{it.title}</td>
              <td className="px-4 py-3"><Badge tone={it.state === "open" ? "blue" : "neutral"}>{it.state}</Badge></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">{it.labels.map((l) => <span key={l} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-tertiary">{l}</span>)}</div>
              </td>
              <td className="px-4 py-3"><AdminSelect value={it.stage} opts={STAGE_OPTS} onChange={(v) => onPatch(it, "stage", v)} /></td>
              <td className="px-4 py-3"><AdminSelect value={it.priority} opts={PRIORITY_OPTS} onChange={(v) => onPatch(it, "priority", v)} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => onClaude(it)} className="inline-flex items-center gap-1 rounded-[8px] bg-purple-light px-2.5 py-1.5 text-[12px] font-semibold text-purple hover:bg-[#e6e2ff]"><Icon name="sparkle" className="h-3.5 w-3.5" />@claude</button>
                  <a href={it.html_url} target="_blank" rel="noreferrer" className="text-blue hover:underline"><Icon name="external" className="h-4 w-4" /></a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function AdminSelect({ value, opts, onChange }: { value: string | null; opts: string[]; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[12px] font-semibold text-text-secondary outline-none focus:border-blue">
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function PullTable({ pulls, onClaude }: { pulls: MirrorPull[]; onClaude: (p: MirrorPull) => void }) {
  if (pulls.length === 0) return <Empty text="미러된 PR이 없어요." />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[820px]">
        <Thead cols={["PR", "제목", "상태", "담당", "액션"]} />
        <tbody>
          {pulls.map((p) => (
            <tr key={`${p.repo}#${p.number}`} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
              <td className="px-4 py-3 font-mono font-bold text-blue">#{p.number}</td>
              <td className="px-4 py-3 font-semibold text-text-primary">{p.title}</td>
              <td className="px-4 py-3"><Badge tone={p.merged ? "purple" : p.draft ? "neutral" : p.state === "open" ? "blue" : "neutral"}>{p.merged ? "merged" : p.draft ? "draft" : p.state}</Badge></td>
              <td className="px-4 py-3 text-text-tertiary">{p.user ?? "—"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => onClaude(p)} className="inline-flex items-center gap-1 rounded-[8px] bg-purple-light px-2.5 py-1.5 text-[12px] font-semibold text-purple hover:bg-[#e6e2ff]"><Icon name="sparkle" className="h-3.5 w-3.5" />@claude</button>
                  <a href={p.html_url} target="_blank" rel="noreferrer" className="text-blue hover:underline"><Icon name="external" className="h-4 w-4" /></a>
                </div>
              </td>
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
