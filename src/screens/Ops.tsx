import { useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, Drawer, Row, Modal, Toggle, RoleChip } from "../components/ui"
import { MANUAL_TASKS, SECRETS, RELEASES, AGENTS, AUTOMATION } from "../data"
import { useGitHub, GitHubError } from "../lib/github"

function GitHubConnect() {
  const { connected, user, connect, disconnect } = useGitHub()
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const onConnect = async () => {
    setErr("")
    setBusy(true)
    try {
      await connect(token)
      setToken("") // 입력한 토큰은 즉시 비워요 — 화면에 다시 표시하지 않아요.
    } catch (e) {
      setErr(e instanceof GitHubError ? e.message : "연결에 실패했어요.")
    } finally {
      setBusy(false)
    }
  }

  if (connected) {
    return (
      <Card className="p-6">
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
            </div>
            <div className="text-[13px] text-text-tertiary">{user ? `@${user.login}` : "실제 저장소·이슈·문서를 불러올 수 있어요"}</div>
          </div>
          <Button onClick={disconnect} icon={<Icon name="github" className="h-4 w-4" />}>연결 해제</Button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-success-light px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[12px] font-semibold text-success">기획 단계의 GitHub Issue·저장소 문서 가져오기가 실제 API로 동작해요.</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-2"><Icon name="github" className="h-5 w-5 text-text-secondary" /></span>
        <div>
          <div className="text-[15px] font-bold text-text-primary">GitHub 연결</div>
          <div className="text-[12px] text-text-tertiary">Personal Access Token으로 실제 저장소에 연결해요.</div>
        </div>
      </div>
      <label className="mt-5 mb-1.5 block text-[13px] font-bold text-text-primary">Personal Access Token</label>
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && onConnect()}
          placeholder="ghp_... 또는 github_pat_..."
          autoComplete="off"
          className="h-11 flex-1 rounded-[10px] border border-line bg-surface px-3.5 font-mono text-[14px] outline-none focus:border-blue"
        />
        <Button variant="primary" onClick={onConnect} loading={busy} disabled={!token.trim()}>연결</Button>
      </div>
      {err && <div className="mt-2 rounded-[10px] bg-error-light px-3 py-2 text-[12px] font-semibold text-error">{err}</div>}
      <div className="mt-4 space-y-1.5 rounded-[10px] bg-surface-2 p-3.5 text-[12px] text-text-secondary">
        <div className="font-bold text-text-primary">권한 안내</div>
        <div>· 공개 저장소만 사용한다면 <code className="rounded bg-surface px-1 font-mono">public_repo</code>, 비공개 저장소까지 쓰려면 <code className="rounded bg-surface px-1 font-mono">repo</code> 권한을 선택하세요.</div>
        <div>· 토큰은 이 브라우저에만 저장되고, 입력 후에는 화면에 다시 표시되지 않아요.</div>
        <div>· 백엔드가 구축되면 이 연결은 서버 측 OAuth로 대체될 예정이에요.</div>
      </div>
    </Card>
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

// ============ MANUAL TASKS ============
export function ManualTasks() {
  const [sel, setSel] = useState(MANUAL_TASKS[4])
  return (
    <div className="space-y-6">
      <SectionTitle title="수동 작업" desc="AI가 수행할 수 없는 외부 설정 작업만 표시됩니다."
        action={<span className="flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1.5 text-[12px] font-bold text-[#b47908]"><Icon name="user" className="h-3.5 w-3.5" />사람 전용 작업</span>} />
      <div className="flex flex-wrap gap-3">
        <Metric label="전체 수동 작업" value="7" />
        <Metric label="완료" value="3" tone="success" />
        <Metric label="미완료" value="4" tone="warning" />
        <Metric label="차단 중인 자동 작업" value="2" tone="error" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden p-2">
          {MANUAL_TASKS.map((m) => (
            <button key={m.id} onClick={() => setSel(m)} className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left ${sel.id === m.id ? "bg-selected" : "hover:bg-hover"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${m.done ? "bg-success text-white" : "border-2 border-line-strong"}`}>{m.done && <Icon name="check" className="h-3.5 w-3.5" />}</span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] font-bold text-text-tertiary">{m.id}</div>
                <div className={`truncate text-[14px] font-semibold ${sel.id === m.id ? "text-blue" : "text-text-primary"}`}>{m.title}</div>
              </div>
              {!m.done && <Badge tone="warning">미완료</Badge>}
            </button>
          ))}
        </Card>

        <Card className="h-fit p-6">
          <div className="flex items-center justify-between">
            <div><span className="font-mono text-[12px] font-bold text-text-tertiary">{sel.id}</span><h2 className="text-[18px] font-bold">{sel.title}</h2></div>
            <Badge tone={sel.done ? "success" : "warning"}>{sel.done ? "완료" : "미완료"}</Badge>
          </div>
          <div className="mt-5 space-y-5">
            <Field title="작업 목적">Production 데이터베이스 연결을 위한 Secret을 GitHub 저장소에 등록합니다.</Field>
            <div className="divide-y divide-line">
              <Row label="외부 서비스" value={sel.service} />
              <Row label="필요한 Secret" value={<span className="font-mono text-[12px]">{sel.secret}</span>} />
              <Row label="차단 중인 작업" value={<span className="text-error">{sel.blocks}</span>} />
              <Row label="확인 방법" value="배포 워크플로 재실행 후 연결 확인" />
            </div>
            <Field title="수행 단계">
              <ol className="ml-4 list-decimal space-y-1">
                <li>Supabase에서 Production 연결 문자열 발급</li>
                <li>저장소 Settings → Secrets에 등록</li>
                <li>Agent Flow에서 상태 확인</li>
              </ol>
            </Field>

            <div>
              <div className="mb-2 text-[13px] font-bold">Secret 상태</div>
              <div className="rounded-[12px] border border-line">
                {SECRETS.map((s, i) => (
                  <div key={s.name} className={`flex items-center justify-between px-4 py-3 ${i < SECRETS.length - 1 ? "border-b border-line" : ""}`}>
                    <span className="flex items-center gap-2 font-mono text-[13px] text-text-secondary"><Icon name="lock" className="h-4 w-4 text-text-tertiary" />{s.name}</span>
                    <Badge>{s.state}</Badge>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-text-tertiary">Secret 값 자체는 화면에 표시되지 않습니다.</p>
            </div>

            <div className="flex gap-2"><Button icon={<Icon name="external" className="h-4 w-4" />}>GitHub에서 열기</Button><Button variant="primary">완료로 표시</Button></div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ============ RELEASES ============
export function Releases() {
  const [modal, setModal] = useState(false)
  return (
    <div className="space-y-6">
      <SectionTitle title="배포 및 릴리스" desc="환경별 배포 상태와 릴리스를 관리하세요." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Icon name="rocket" className="h-5 w-5 text-success" /><span className="text-[16px] font-bold">Staging</span></div><Badge tone="success">배포 완료</Badge></div>
          <div className="mt-4 divide-y divide-line">
            <Row label="최근 배포" value="성공 · 07/29 18:20" />
            <Row label="Commit" value={<span className="font-mono text-[12px]">a3f92c1</span>} />
            <Row label="Smoke Test" value={<Badge tone="success">통과</Badge>} />
          </div>
          <Button full icon={<Icon name="external" className="h-4 w-4" />}>서비스 열기</Button>
        </Card>

        <Card className="border-purple/30 bg-purple-light/30 p-6">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Icon name="rocket" className="h-5 w-5 text-purple" /><span className="text-[16px] font-bold">Production</span></div><Badge tone="purple">승인 대기</Badge></div>
          <div className="mt-4 divide-y divide-line">
            <Row label="대상 Release" value="v0.9.2" />
            <Row label="필수 Check" value={<Badge tone="warning">2/3 통과</Badge>} />
            <Row label="포함 PR" value="8개" />
          </div>
          <Button variant="primary" full icon={<Icon name="rocket" className="h-4 w-4" />} onClick={() => setModal(true)}>Production 배포</Button>
        </Card>
      </div>

      {/* deploy timeline */}
      <Card className="p-6">
        <h2 className="text-[16px] font-bold">배포 타임라인 · v0.9.1</h2>
        <div className="mt-5 flex items-center gap-2 overflow-x-auto">
          {["Build", "Test", "Artifact", "Deploy", "Smoke Test", "Complete"].map((s, i, a) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-white"><Icon name="check" className="h-4 w-4" /></span><span className="text-[12px] font-semibold text-text-secondary">{s}</span></div>
              {i < a.length - 1 && <span className="mx-2 h-0.5 w-12 bg-success/40" />}
            </div>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-[16px] font-bold">릴리스</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {RELEASES.map((r) => (
            <Card key={r.version} hover className="p-5">
              <div className="flex items-center justify-between"><span className="text-[18px] font-bold">{r.version}</span><Badge tone={r.env === "Production" ? "purple" : "neutral"}>{r.env}</Badge></div>
              <div className="mt-2"><Badge>{r.status}</Badge></div>
              <div className="mt-4 flex gap-4 text-[13px] text-text-secondary"><span>PR {r.prs}</span><span>Issue {r.issues}</span></div>
              <div className="mt-1 text-[12px] text-text-tertiary">{r.created}</div>
              <button className="mt-4 text-[13px] font-semibold text-blue hover:underline">Release Note 보기</button>
            </Card>
          ))}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Production에 배포할까요?"
        footer={<><Button onClick={() => setModal(false)}>취소</Button><Button variant="primary" onClick={() => setModal(false)}>배포하기</Button></>}>
        <div className="divide-y divide-line">
          <Row label="대상 Commit" value={<span className="font-mono text-[12px]">a3f92c1</span>} />
          <Row label="포함 Pull Request" value="8개" />
          <Row label="데이터베이스 변경" value={<span className="text-warning">마이그레이션 1건</span>} />
          <Row label="알려진 위험" value="세션 정책 변경" />
          <Row label="Rollback 기준" value="Smoke Test 실패 시 자동" />
        </div>
      </Modal>
    </div>
  )
}

// ============ SETTINGS ============
export function Settings() {
  const [menu, setMenu] = useState("연동")
  const [autos, setAutos] = useState(AUTOMATION.map((a) => a.on))
  const [confirm, setConfirm] = useState<number | null>(null)
  const items = ["연동", "저장소", "경로", "명령어", "에이전트", "자동화", "환경", "알림"]

  return (
    <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
      <div>
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-disabled">설정</div>
        {items.map((m) => <button key={m} onClick={() => setMenu(m)} className={`block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold ${menu === m ? "bg-selected text-blue" : "text-text-secondary hover:bg-hover"}`}>{m}</button>)}
      </div>

      <div className="space-y-5">
        <SectionTitle title={`${menu} 설정`} />
        {menu === "연동" && <GitHubConnect />}
        {menu === "명령어" && (
          <Card className="divide-y divide-line p-6">
            {[["Install Command", "pnpm install"], ["Lint Command", "pnpm lint"], ["Type Check Command", "pnpm typecheck"], ["Unit Test Command", "pnpm test"], ["Integration Test Command", "pnpm test:int"], ["Build Command", "pnpm build"]].map(([n, v]) => (
              <div key={n} className="flex items-center justify-between py-3">
                <span className="text-[14px] font-semibold text-text-primary">{n}</span>
                <code className="rounded-[8px] bg-surface-2 px-3 py-1.5 font-mono text-[13px] text-text-secondary">{v}</code>
              </div>
            ))}
          </Card>
        )}

        {menu === "에이전트" && (
          <div className="grid gap-4 md:grid-cols-2">
            {AGENTS.map((a) => (
              <Card key={a.name} className="p-5">
                <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full`} style={{ background: a.color === "blue" ? "#3182f6" : a.color === "purple" ? "#7c5cfc" : a.color === "success" ? "#00a86b" : a.color === "warning" ? "#f59f00" : "#f04452" }} /><span className="text-[15px] font-bold">{a.name}</span></div>
                <div className="mt-3 divide-y divide-line">
                  <Row label="모델" value={a.model} />
                  <Row label="최대 Turn" value={a.turns} />
                  <Row label="Timeout" value={a.timeout} />
                </div>
                {a.name === "Repair Agent" && (
                  <div className="mt-3 space-y-2 rounded-[10px] bg-error-light p-3">
                    <div className="flex items-center justify-between text-[13px]"><span className="text-text-secondary">최대 자동 수정 횟수</span><b>1회</b></div>
                    <div className="flex items-center justify-between text-[13px]"><span className="text-text-secondary">동일 오류 반복 시 중단</span><Toggle on onChange={() => {}} /></div>
                    <div className="flex items-center justify-between text-[13px]"><span className="text-text-secondary">허용 경로 밖 변경 시 중단</span><Toggle on onChange={() => {}} /></div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {menu === "자동화" && (
          <Card className="divide-y divide-line p-6">
            {AUTOMATION.map((a, i) => (
              <div key={a.label} className="flex items-center justify-between py-3.5">
                <div>
                  <div className="text-[14px] font-semibold text-text-primary">{a.label}{a.danger && <span className="ml-2 rounded bg-error-light px-1.5 py-0.5 text-[11px] font-bold text-error">주의</span>}</div>
                  {a.note && <div className="text-[12px] text-text-tertiary">최대 {a.note}</div>}
                </div>
                <Toggle on={autos[i]} danger={a.danger}
                  onChange={() => {
                    if (a.danger && !autos[i]) { setConfirm(i); return }
                    setAutos((s) => s.map((v, j) => (j === i ? !v : v)))
                  }} />
              </div>
            ))}
          </Card>
        )}

        {["저장소", "경로", "환경", "알림"].includes(menu) && (
          <Card className="divide-y divide-line p-6">
            {(menu === "경로" ? [["문서 경로", "docs/"], ["프론트엔드 경로", "apps/web/"], ["백엔드 경로", "services/"], ["테스트 경로", "tests/"]] : [["저장소", "sample-org / agent-workflow"], ["기본 브랜치", "main"], ["환경", "Staging, Production"], ["알림 채널", "Slack #agent-flow"]]).map(([n, v]) => (
              <div key={n} className="flex items-center justify-between py-3"><span className="text-[14px] font-semibold text-text-primary">{n}</span><span className="font-mono text-[13px] text-text-secondary">{v}</span></div>
            ))}
          </Card>
        )}

        <Modal open={confirm !== null} onClose={() => setConfirm(null)} title="위험한 설정을 켤까요?"
          footer={<><Button onClick={() => setConfirm(null)}>취소</Button><Button variant="primary" onClick={() => { setAutos((s) => s.map((v, j) => (j === confirm ? true : v))); setConfirm(null) }}>켜기</Button></>}>
          Production 자동 배포는 검토 없이 실서비스에 반영됩니다. 정말 켤까요?
        </Modal>
      </div>
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
