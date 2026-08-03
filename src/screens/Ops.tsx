import { useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, Row, RoleChip, EmptyState } from "../components/ui"
import { HUMAN_TASKS, type HumanTask, type ExternalKey } from "../data"

const HT_DOMAIN_TONE: Record<string, any> = { admin: "blue", auth: "purple", chat: "success", vehicles: "warning", matching: "blue", notification: "purple", infra: "neutral", release: "error" }
import { useGitHub, GitHubError } from "../lib/github"

const TOKEN_RE = /^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)/
// 프록시 쓰기(repo)·웹훅 등록(admin:repo_hook)·Actions 조회(workflow) 권한을 미리 담아요.
const NEW_TOKEN_URL = "https://github.com/settings/tokens/new?scopes=repo,admin:repo_hook,workflow&description=Agent%20Flow"

const DEMO_USER = { login: "octocat", name: "데모 사용자", avatar_url: "" }

function GitHubConnect({ navigate }: { navigate: (r: string) => void }) {
  const { connected, checking, user, connect, disconnect } = useGitHub()
  const [demo, setDemo] = useState(false)
  const [token, setToken] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const trimmed = token.trim()
  const looksInvalid = trimmed.length > 0 && !TOKEN_RE.test(trimmed)

  const onConnect = async () => {
    setErr("")
    setBusy(true)
    try {
      await connect(token)
      setToken("") // 입력한 토큰은 즉시 비워요 — 화면에 다시 표시하지 않아요.
      setShow(false)
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : "연결에 실패했어요.")
    } finally {
      setBusy(false)
    }
  }

  // 첫 상태 조회 중 — "연결 필요"가 잠깐 깜빡이는 걸 막아요. (데모 미리보기 중엔 건너뛰어요.)
  if (checking && !connected && !demo) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <span className="af-spin h-5 w-5 rounded-full border-2 border-line-strong border-t-blue" />
          <span className="text-[14px] font-semibold text-text-secondary">GitHub 연결 상태를 확인하는 중…</span>
        </div>
      </Card>
    )
  }

  // 실제 연결됨, 또는 데모 미리보기 → 연결 후 뷰
  if (connected || demo) {
    return <ConnectedView user={connected ? user : DEMO_USER} demo={!connected} navigate={navigate} onExit={connected ? disconnect : () => setDemo(false)} />
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-2"><Icon name="github" className="h-5 w-5 text-text-secondary" /></span>
          <div>
            <div className="text-[15px] font-bold text-text-primary">GitHub 연결</div>
            <div className="text-[12px] text-text-tertiary">Personal Access Token으로 실제 저장소에 연결해요.</div>
          </div>
        </div>
        <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[10px] border border-line px-3 py-2 text-[12px] font-semibold text-blue hover:bg-hover"><Icon name="external" className="h-3.5 w-3.5" />토큰 만들기</a>
      </div>

      <label className="mt-5 mb-1.5 block text-[13px] font-bold text-text-primary">Personal Access Token</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && trimmed && onConnect()}
            placeholder="ghp_... 또는 github_pat_..."
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-[10px] border border-line bg-surface pl-3.5 pr-16 font-mono text-[14px] outline-none focus:border-blue"
          />
          {trimmed && (
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[8px] px-2 py-1 text-[12px] font-semibold text-text-tertiary hover:bg-hover">{show ? "숨김" : "표시"}</button>
          )}
        </div>
        <Button variant="primary" onClick={onConnect} loading={busy} disabled={!trimmed}>연결</Button>
      </div>

      {looksInvalid && !err && (
        <div className="mt-2 text-[12px] font-medium text-[#b47908]">토큰 형식이 다른 것 같아요 — 클래식은 <code className="font-mono">ghp_</code>, 파인그레인드는 <code className="font-mono">github_pat_</code>로 시작해요.</div>
      )}
      {err && <div className="mt-2 rounded-[10px] bg-error-light px-3 py-2 text-[12px] font-semibold text-error">{err}</div>}

      <div className="mt-4 space-y-1.5 rounded-[10px] bg-surface-2 p-3.5 text-[12px] text-text-secondary">
        <div className="font-bold text-text-primary">권한 안내</div>
        <div>· 저장소 읽기·이슈/코멘트 쓰기: <code className="rounded bg-surface px-1 font-mono">repo</code> (공개 저장소만이면 <code className="rounded bg-surface px-1 font-mono">public_repo</code>).</div>
        <div>· 웹훅 등록까지 하려면 <code className="rounded bg-surface px-1 font-mono">admin:repo_hook</code>, Actions 조회는 <code className="rounded bg-surface px-1 font-mono">workflow</code>를 함께 선택하세요. (위 ‘토큰 만들기’에 미리 담겨 있어요.)</div>
        <div>· 토큰은 서버로 전송돼 세션 동안 서버 메모리에만 보관되고, 브라우저·화면에는 저장·표시되지 않아요.</div>
        <div>· GitHub 요청은 모두 서버 프록시(<code className="rounded bg-surface px-1 font-mono">/api/github</code>)를 거쳐요.</div>
      </div>

      {/* 데모 미리보기 — 실제 토큰 없이 연결 후 화면을 확인 */}
      <div className="mt-4 flex items-center justify-between rounded-[10px] border border-dashed border-line px-4 py-2.5">
        <span className="text-[12px] text-text-tertiary">토큰이 없나요? 연결 후 화면을 데모로 미리 볼 수 있어요.</span>
        <button type="button" onClick={() => setDemo(true)} className="inline-flex items-center gap-1 rounded-[8px] bg-surface-2 px-2.5 py-1.5 text-[12px] font-semibold text-blue hover:bg-hover"><Icon name="play" className="h-3.5 w-3.5" />연결 후 뷰 미리보기</button>
      </div>
    </Card>
  )
}

function ConnectedView({ user, demo, navigate, onExit }: { user: { login: string; name: string | null; avatar_url: string } | null; demo: boolean; navigate: (r: string) => void; onExit: () => void }) {
  return (
    <Card className="p-6">
      {demo && (
        <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-blue-light px-3 py-2.5 text-[12px] font-semibold text-blue">
          <Icon name="play" className="h-4 w-4 shrink-0" />데모 미리보기 — 실제로는 연결되지 않았어요. 아래 계정·기능은 예시이고, 쓰기·웹훅은 동작하지 않아요.
        </div>
      )}
      <div className="flex items-center gap-3">
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2"><Icon name="github" className="h-5 w-5 text-text-secondary" /></span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-text-primary">{user?.name ?? user?.login ?? "GitHub 계정"}</span>
            <Badge tone="success">연결됨</Badge>
            {demo && <Badge tone="blue">데모</Badge>}
          </div>
          <div className="text-[13px] text-text-tertiary">{user ? `@${user.login}` : "실제 저장소·이슈·문서를 불러올 수 있어요"}</div>
        </div>
        <Button onClick={onExit} icon={<Icon name="github" className="h-4 w-4" />}>{demo ? "데모 종료" : "연결 해제"}</Button>
      </div>

      {/* 지금 무엇이 켜졌는지 */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Cap icon="doc" label="자료·이슈 읽기" />
        <Cap icon="plus" label="이슈·@claude 쓰기" />
        <Cap icon="sync" label="웹훅 등록" />
      </div>

      {/* 바로 가기 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={<Icon name="sync" className="h-4 w-4" />} onClick={() => navigate("mirror")}>GitHub 미러 열기</Button>
        <Button icon={<Icon name="doc" className="h-4 w-4" />} onClick={() => navigate("sources")}>자료 불러오기</Button>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-success-light px-4 py-2.5">
        <Icon name="lock" className="h-4 w-4 text-success" />
        <span className="text-[12px] font-semibold text-success">토큰은 서버 메모리에만 있어요. 세션이 끝나거나 ‘연결 해제’ 하면 사라져요.</span>
      </div>
    </Card>
  )
}

function Cap({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-success-light text-success"><Icon name={icon} className="h-3.5 w-3.5" /></span>
      <span className="text-[12px] font-semibold text-text-secondary">{label}</span>
    </div>
  )
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-bold text-text-primary">{title}</div>
      <div className="text-[13px] leading-relaxed text-text-secondary">{children}</div>
    </div>
  )
}

// ============ HUMAN TASKS (사람 전용 작업) ============
export function HumanTasks() {
  const [tasks, setTasks] = useState<HumanTask[]>(HUMAN_TASKS)
  const [selId, setSelId] = useState(HUMAN_TASKS[0]?.id ?? "")
  const sel = tasks.find((t) => t.id === selId) ?? tasks[0]

  const waiting = tasks.filter((t) => t.status === "대기").length
  const inprog = tasks.filter((t) => t.status === "진행 중").length
  const done = tasks.filter((t) => t.status === "완료").length
  const blocked = tasks.filter((t) => t.status !== "완료").length

  const patchSel = (patch: Partial<HumanTask>) => setTasks((ts) => ts.map((t) => (t.id === selId ? { ...t, ...patch } : t)))
  const saveKey = (name: string) => patchSel({ keys: sel.keys.map((k) => (k.name === name ? { ...k, state: "등록됨" } : k)) })
  const toggleCheck = (i: number) => patchSel({ checklist: sel.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)) })
  const markDone = () => patchSel({ status: "완료" })

  const statusTone = (s: string) => (s === "완료" ? "success" : s === "진행 중" ? "blue" : "warning")

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitle title="휴먼태스크" desc="AI가 대신할 수 없는 외부 계정·키 발급, 서비스 등록, 배포 승인만 모았어요."
          action={<span className="flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1.5 text-[12px] font-bold text-[#b47908]"><Icon name="hand" className="h-3.5 w-3.5" />사람 전용 작업</span>} />
        <EmptyState title="휴먼태스크가 없어요." desc="사람만 할 수 있는 외부 키 발급·서비스 등록·배포 승인이 생기면 여기에 모여요. 스키마·프론트·백엔드·QA 등 나머지는 AI·자동화가 알아서 진행해요." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="휴먼태스크" desc="AI가 대신할 수 없는 외부 계정·키 발급, 서비스 등록, 배포 승인만 모았어요."
        action={<span className="flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1.5 text-[12px] font-bold text-[#b47908]"><Icon name="hand" className="h-3.5 w-3.5" />사람 전용 작업</span>} />

      {/* 분리 안내: 사람은 이것만, 나머지는 AI가 */}
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-3">
        <RoleChip owner="human" /><span className="text-[13px] font-semibold text-text-primary">이 목록만 처리하면 돼요.</span>
        <span className="mx-1 text-line-strong">·</span>
        <span className="text-[12px] text-text-secondary">스키마·프론트·백엔드·QA 등 나머지는</span>
        <RoleChip owner="ai" /><RoleChip owner="auto" /><span className="text-[12px] text-text-secondary">가 알아서 진행하니 신경 쓰지 않아도 돼요.</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <Metric label="휴먼태스크" value={String(tasks.length)} />
        <Metric label="대기" value={String(waiting)} tone="warning" />
        <Metric label="진행 중" value={String(inprog)} tone="blue" />
        <Metric label="완료" value={String(done)} tone="success" />
        <Metric label="차단 중인 자동 작업" value={String(blocked)} tone="error" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* 왼쪽: 휴먼태스크 목록 */}
        <Card className="h-fit overflow-hidden p-2">
          {tasks.map((m) => (
            <button key={m.id} onClick={() => setSelId(m.id)} className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left ${sel.id === m.id ? "bg-selected" : "hover:bg-hover"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m.status === "완료" ? "bg-success text-white" : m.status === "진행 중" ? "border-2 border-blue" : "border-2 border-line-strong"}`}>
                {m.status === "완료" ? <Icon name="check" className="h-3.5 w-3.5" /> : m.status === "진행 중" ? <span className="h-1.5 w-1.5 rounded-full bg-blue" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-text-tertiary">{m.id}</span>
                  <Badge tone={HT_DOMAIN_TONE[m.domain]}>{m.domain}</Badge>
                </div>
                <div className={`truncate text-[14px] font-semibold ${sel.id === m.id ? "text-blue" : "text-text-primary"}`}>{m.title}</div>
              </div>
              <Badge tone={statusTone(m.status) as any}>{m.status}</Badge>
            </button>
          ))}
        </Card>

        {/* 오른쪽: 태스크 상세 */}
        <Card className="h-fit p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-bold text-text-tertiary">{sel.id}</span>
                <Badge tone={HT_DOMAIN_TONE[sel.domain]}>{sel.domain}</Badge>
                <span className="text-[11px] text-text-tertiary">{sel.phase}</span>
              </div>
              <h2 className="mt-0.5 text-[18px] font-bold">{sel.title}</h2>
            </div>
            <Badge tone={statusTone(sel.status) as any}>{sel.status}</Badge>
          </div>

          <div className="mt-5 space-y-6">
            <Field title="작업 목적">{sel.purpose}</Field>

            {/* 외부 키 등록 */}
            {sel.keys.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-primary"><Icon name="key" className="h-4 w-4 text-text-tertiary" />외부 키 등록</div>
                <div className="space-y-3">
                  {sel.keys.map((k) => <ExternalKeyRow key={k.name} k={k} onSave={() => saveKey(k.name)} />)}
                </div>
              </div>
            )}

            {/* 수동 처리 */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-primary"><Icon name="hand" className="h-4 w-4 text-text-tertiary" />수동 처리</div>
              <p className="rounded-[12px] bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-secondary">{sel.manual}</p>
            </div>

            {/* 체크리스트 */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-primary"><Icon name="critic" className="h-4 w-4 text-text-tertiary" />체크리스트</div>
              <div className="rounded-[12px] border border-line">
                {sel.checklist.map((c, i) => (
                  <button key={c.text} onClick={() => toggleCheck(i)} className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left ${i < sel.checklist.length - 1 ? "border-b border-line" : ""} hover:bg-hover`}>
                    <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[6px] ${c.done ? "bg-success text-white" : "border-2 border-line-strong"}`}>{c.done && <Icon name="check" className="h-3 w-3" />}</span>
                    <span className={`text-[13px] ${c.done ? "text-text-tertiary line-through" : "text-text-secondary"}`}>{c.text}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-line">
              <Row label="차단 중인 자동 작업" value={<span className="text-error">{sel.blocks}</span>} />
              <Row label="확인 방법" value="키 등록 후 관련 워크플로 재실행" />
            </div>

            {/* 진행 노트 */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-primary"><Icon name="doc" className="h-4 w-4 text-text-tertiary" />진행 노트</div>
              <textarea rows={2} placeholder="진행 상황이나 메모를 남겨보세요." className="w-full rounded-[12px] border border-line bg-surface p-3 text-[13px] outline-none focus:border-blue" />
            </div>

            <div className="flex gap-2">
              <Button icon={<Icon name="external" className="h-4 w-4" />}>GitHub에서 열기</Button>
              <Button variant="primary" onClick={markDone} disabled={sel.status === "완료"}>완료로 표시</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// 외부 API 키 입력 행 — 값은 저장 즉시 마스킹돼요.
function ExternalKeyRow({ k, onSave }: { k: ExternalKey; onSave: () => void }) {
  const [val, setVal] = useState("")
  const registered = k.state === "등록됨"
  return (
    <div className="rounded-[12px] border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[13px] font-bold text-text-primary">{k.name}</span>
        <Badge tone={registered ? "success" : "warning"}>{k.state}</Badge>
      </div>
      <div className="mt-1.5 text-[12px] text-text-secondary">{k.desc}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={k.site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-blue hover:underline"><Icon name="external" className="h-3.5 w-3.5" />발급 사이트</a>
        {k.docs && <a href={k.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-text-secondary hover:underline"><Icon name="doc" className="h-3.5 w-3.5" />Docs</a>}
      </div>
      {registered ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-[10px] bg-success-light px-3 py-2 text-[12px] font-semibold text-success"><Icon name="lock" className="h-4 w-4" />등록 완료 · 값은 마스킹되어 표시되지 않아요</div>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <input type="password" value={val} onChange={(e) => setVal(e.target.value)} placeholder="값 입력 (저장 즉시 마스킹)" autoComplete="off" className="h-10 flex-1 rounded-[10px] border border-line bg-surface px-3 font-mono text-[13px] outline-none focus:border-blue" />
          <Button variant="primary" onClick={onSave} disabled={!val.trim()}>저장</Button>
        </div>
      )}
    </div>
  )
}

// ============ SETTINGS (MVP: 연동만) ============
export function Settings({ navigate }: { navigate: (r: string) => void }) {
  return (
    <div className="space-y-5">
      <SectionTitle title="연동 설정" desc="GitHub 계정을 연결하면 미러·이슈·웹훅이 실제로 동작해요." />
      <GitHubConnect navigate={navigate} />
    </div>
  )
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  const color = tone === "success" ? "text-success" : tone === "error" ? "text-error" : tone === "warning" ? "text-[#b47908]" : tone === "blue" ? "text-blue" : "text-text-primary"
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
      <div className="text-[12px] font-medium text-text-tertiary">{label}</div>
      <div className={`text-[20px] font-bold ${color}`}>{value}</div>
    </div>
  )
}
