import { useState, useEffect, useMemo } from "react"
import { Icon, IconButton, Button, Badge, Card, SummaryCard, SectionTitle, SearchField, Progress, Toggle, RoleChip, EmptyState } from "../components/ui"
import { PROJECTS, BUILD_PHASES, BUILD_DOMAINS, type ProjectItem } from "../data"
import { listProjects, createProject } from "../lib/projects"
import { useServerStatus } from "../lib/status"

export default function Projects({ navigate, onOpen }: { navigate: (r: string) => void; onOpen: (p: ProjectItem) => void }) {
  const [adding, setAdding] = useState(false)
  const [serverProjects, setServerProjects] = useState<ProjectItem[]>([])
  const { connected, summary } = useServerStatus()

  const load = async () => {
    try {
      setServerProjects(await listProjects())
    } catch {
      // 서버 미가동/오류 시 번들 시드(데모)만 보여줘요.
    }
  }
  useEffect(() => {
    void load()
  }, [])

  // 서버(영속) + 번들 시드(데모) 합치기 — 같은 id는 서버 우선, 새로 만든 게 위로.
  const all = useMemo(() => {
    const ids = new Set(serverProjects.map((p) => p.id))
    return [...serverProjects, ...PROJECTS.filter((s) => !ids.has(s.id))]
  }, [serverProjects])

  const repoTotal = all.reduce((n, p) => n + p.repos.length, 0)
  const active = all.filter((p) => p.progress < 100).length
  const failing = all.reduce((n, p) => n + p.fails, 0)

  return (
    <div className="min-h-screen bg-app">
      {/* Slim global header */}
      <header className="flex h-16 items-center gap-4 border-b border-line bg-surface px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue text-white">
            <Icon name="flow" className="h-4.5 w-4.5" />
          </span>
          <span className="text-[17px] font-bold tracking-tight">Agent Flow</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {connected ? (
            <div className="flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-[12px] font-semibold text-success">GitHub 연결됨</span>
            </div>
          ) : (
            <button onClick={() => navigate("settings")} className="flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1.5 hover:brightness-95" title="설정에서 GitHub 연결">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              <span className="text-[12px] font-semibold text-[#b47908]">GitHub 연결 필요</span>
            </button>
          )}
          <IconButton label="알림"><Icon name="bell" /></IconButton>
          <IconButton label="도움말"><Icon name="help" /></IconButton>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3182f6] to-[#7c5cfc] text-[13px] font-bold text-white">SB</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-8 py-8">
        <SectionTitle
          title="프로젝트"
          desc="프로젝트를 선택해 기획부터 배포까지 진행하세요. 한 프로젝트는 여러 깃 저장소를 묶어요."
          action={<Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />} onClick={() => setAdding(true)}>프로젝트 추가</Button>}
        />

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard label="전체 프로젝트" value={String(all.length)} sub={`진행 중 ${active}`} />
          <SummaryCard label="연결된 저장소" value={String(repoTotal)} sub="프로젝트 하위" tone="blue" />
          <SummaryCard label="실행 중인 Actions" value={String(summary?.activeRuns ?? 0)} sub="미러 기준" tone="purple" />
          <SummaryCard label="실패한 Workflow" value={String(failing)} sub="즉시 확인 필요" tone="error" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="min-w-[280px] flex-1"><SearchField placeholder="프로젝트 검색" /></div>
          <FilterChip label="단계: 전체" />
          <FilterChip label="최근 업데이트 순" />
        </div>

        {all.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="아직 프로젝트가 없어요."
              desc="프로젝트를 추가하면 여러 깃 저장소를 묶어 기획부터 배포까지 진행할 수 있어요. GitHub를 연결하면 이슈·PR·Actions가 미러에 실시간으로 채워져요."
              action={<Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />} onClick={() => setAdding(true)}>프로젝트 추가</Button>}
            />
          </div>
        ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {all.map((p) => (
            <Card key={p.id} hover onClick={() => onOpen(p)} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon name="board" className="h-4.5 w-4.5 text-text-secondary" />
                  <span className="text-[15px] font-bold text-text-primary">{p.name}</span>
                </div>
                <Badge tone="blue">{`${p.stage} ${p.progress}%`}</Badge>
              </div>

              <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-text-secondary">{p.desc}</p>

              {/* 이 프로젝트에 속한 깃 저장소들 */}
              <div className="mt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-disabled">
                  <Icon name="github" className="h-3.5 w-3.5" /> 저장소 {p.repos.length}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.repos.map((r) => (
                    <span key={r.name} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">
                      <span className="font-mono">{r.name}</span>
                      <span className="text-text-tertiary">· {r.purpose}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Progress value={p.progress} tone={p.progress === 100 ? "success" : p.fails > 0 ? "warning" : "blue"} />
                <span className="text-[13px] font-bold text-text-primary">{p.progress}%</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="열린 작업" value={p.tasks} />
                <Stat label="열린 PR" value={p.prs} />
                <Stat label="실패 실행" value={p.fails} tone={p.fails > 0 ? "error" : "default"} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[12px]">
                <span className="text-text-tertiary">{p.org}</span>
                <span className="flex items-center gap-2">
                  {p.synced ? <span className="text-success">동기화됨</span> : <span className="text-warning">동기화 필요</span>}
                  <span className="text-text-tertiary">{p.updated}</span>
                </span>
              </div>
            </Card>
          ))}
        </div>
        )}
      </div>
      {adding && <AddProjectModal onClose={() => setAdding(false)} onCreate={async (p) => { await createProject(p); await load() }} />}
    </div>
  )
}

function FilterChip({ label }: { label: string }) {
  return (
    <button className="flex h-11 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 text-[13px] font-semibold text-text-secondary hover:bg-hover">
      {label}
      <Icon name="chevronDown" className="h-4 w-4 text-text-tertiary" />
    </button>
  )
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-text-tertiary">{label}</div>
      <div className={`text-[16px] font-bold ${tone === "error" && value > 0 ? "text-error" : "text-text-primary"}`}>{value}</div>
    </div>
  )
}

// 각 빌드 단계의 담당(자동/AI/사람) — 사람 몫은 곧 휴먼태스크가 돼요.
const PHASE_ROLE: Record<string, "auto" | "ai" | "human"> = {
  "스키마": "auto", "프론트엔드": "ai", "백엔드": "ai", "외부 키 발급": "human", "QA": "auto", "릴리즈": "human",
}
const REPO_PURPOSES = ["프론트엔드", "백엔드", "인프라", "공용 패키지"]
const WIZARD_STEPS = ["프로젝트 정보", "저장소 연결", "도메인·단계", "역할·연동", "확인"]

// 프로젝트 추가 위저드 — 정보 → 저장소(여러 개) → 도메인·단계 → 역할·연동 → 확인.
function AddProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: ProjectItem) => Promise<void> }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [org, setOrg] = useState("sample-org")
  const [repos, setRepos] = useState([{ name: "", purpose: "프론트엔드" }])
  const [domains, setDomains] = useState<string[]>(["admin", "auth"])
  const [integ, setInteg] = useState({ github: true, supabase: true, slack: false })

  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? repos.some((r) => r.name.trim()) : true
  const next = () => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))
  const prev = () => setStep((s) => Math.max(s - 1, 0))

  const setRepo = (i: number, patch: Partial<{ name: string; purpose: string }>) => setRepos((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addRepo = () => setRepos((rs) => [...rs, { name: "", purpose: "백엔드" }])
  const removeRepo = (i: number) => setRepos((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))
  const toggleDomain = (d: string) => setDomains((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))

  const validRepos = repos.filter((r) => r.name.trim())

  const submit = async () => {
    setBusy(true)
    setErr("")
    try {
      const project: ProjectItem = {
        id: `p-${Date.now()}`,
        name: name.trim(),
        org: org.trim() || "sample-org",
        desc: desc.trim(),
        stage: "계획",
        progress: 0,
        repos: validRepos.map((r) => ({ name: r.name.trim(), purpose: r.purpose })),
        tasks: 0,
        prs: 0,
        fails: 0,
        updated: "방금",
        synced: false,
      }
      await onCreate(project)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "생성에 실패했어요.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="af-overlay absolute inset-0 bg-[#191f28]/30" onClick={onClose} />
      <div className="af-fade relative flex max-h-[88vh] w-full max-w-[640px] flex-col rounded-[20px] bg-surface shadow-[var(--shadow-modal)]">
        {/* 헤더 + 스텝퍼 */}
        <div className="border-b border-line px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-text-primary">프로젝트 추가</h2>
            <IconButton label="닫기" onClick={onClose}><Icon name="close" /></IconButton>
          </div>
          <div className="mt-3 flex items-center">
            {WIZARD_STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-1.5">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${i < step ? "bg-success text-white" : i === step ? "bg-blue text-white" : "bg-surface-2 text-text-tertiary"}`}>{i < step ? <Icon name="check" className="h-3 w-3" /> : i + 1}</span>
                  <span className={`hidden text-[11px] font-semibold md:block ${i === step ? "text-blue" : "text-text-tertiary"}`}>{s}</span>
                </div>
                {i < WIZARD_STEPS.length - 1 && <span className="mx-2 h-px flex-1 bg-line" />}
              </div>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="프로젝트 이름">
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="예: 커머스 어드민 리뉴얼" className="h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-blue" />
              </Field>
              <Field label="설명">
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="프로젝트가 무엇을 만드는지 한두 문장으로 적어주세요." className="w-full rounded-[10px] border border-line bg-surface p-3.5 text-[14px] outline-none focus:border-blue" />
              </Field>
              <Field label="조직">
                <input value={org} onChange={(e) => setOrg(e.target.value)} className="h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 font-mono text-[14px] outline-none focus:border-blue" />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="rounded-[10px] bg-surface-2 px-4 py-2.5 text-[12px] text-text-secondary">한 프로젝트는 <b className="text-text-primary">여러 깃 저장소</b>를 묶어요. 프론트·백엔드·인프라처럼 역할별로 저장소를 나눠 연결하세요.</p>
              {repos.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2"><Icon name="github" className="h-4.5 w-4.5 text-text-secondary" /></span>
                  <input value={r.name} onChange={(e) => setRepo(i, { name: e.target.value })} placeholder="저장소 이름 (예: admin-web)" className="h-10 flex-1 rounded-[10px] border border-line bg-surface px-3 font-mono text-[13px] outline-none focus:border-blue" />
                  <select value={r.purpose} onChange={(e) => setRepo(i, { purpose: e.target.value })} className="h-10 rounded-[10px] border border-line bg-surface px-2 text-[13px] outline-none focus:border-blue">
                    {REPO_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => removeRepo(i)} disabled={repos.length === 1} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-text-tertiary hover:bg-hover disabled:opacity-30" aria-label="삭제"><Icon name="close" className="h-4 w-4" /></button>
                </div>
              ))}
              <button onClick={addRepo} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong py-2.5 text-[13px] font-semibold text-text-secondary hover:bg-hover"><Icon name="plus" className="h-4 w-4" />저장소 추가</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Field label="도메인">
                <p className="mb-2 text-[12px] text-text-tertiary">작업을 나눌 기준이 되는 도메인을 선택하세요.</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUILD_DOMAINS.map((d) => {
                    const on = domains.includes(d)
                    return <button key={d} onClick={() => toggleDomain(d)} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? "bg-blue text-white" : "border border-line bg-surface text-text-secondary hover:bg-hover"}`}>{d}</button>
                  })}
                </div>
              </Field>
              <div>
                <div className="mb-1.5 text-[13px] font-bold text-text-primary">빌드 단계</div>
                <p className="mb-2 text-[12px] text-text-tertiary">단계는 자동으로 구성돼요. 각 단계의 담당이 아래처럼 나뉩니다.</p>
                <div className="flex flex-wrap gap-2">
                  {BUILD_PHASES.map((ph, i) => (
                    <div key={ph} className="rounded-[10px] border border-line px-3 py-2">
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-text-primary"><span className="text-text-tertiary">{i + 1}</span>{ph}</div>
                      <div className="mt-1"><RoleChip owner={PHASE_ROLE[ph]} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="rounded-[12px] bg-surface-2 p-4">
                <div className="text-[13px] font-bold text-text-primary">업무 분리</div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">스키마·프론트·백엔드·QA는 <RoleChip owner="ai" /> <RoleChip owner="auto" />가 자동으로 진행하고, 외부 키 발급·배포 승인처럼 사람만 할 수 있는 일은 <RoleChip owner="human" /> <b className="text-[#b47908]">휴먼태스크</b>로 따로 모여요. 사람은 휴먼태스크만 신경 쓰면 됩니다.</p>
              </div>
              <Field label="외부 연동">
                <div className="space-y-2">
                  <IntegRow icon="github" title="GitHub" desc="저장소·Actions·PR 연동 (필수)" on={integ.github} disabled onChange={() => {}} />
                  <IntegRow icon="board" title="Supabase" desc="스키마·데이터베이스 프로비저닝" on={integ.supabase} onChange={() => setInteg((s) => ({ ...s, supabase: !s.supabase }))} />
                  <IntegRow icon="chat" title="Slack" desc="휴먼태스크·이슈 알림 수신" on={integ.slack} onChange={() => setInteg((s) => ({ ...s, slack: !s.slack }))} />
                </div>
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-[12px] border border-line p-4">
                <div className="text-[15px] font-bold text-text-primary">{name || "제목 없는 프로젝트"}</div>
                {desc && <p className="mt-1 text-[13px] text-text-secondary">{desc}</p>}
                <div className="mt-3 divide-y divide-line">
                  <SumRow label="조직" value={org} />
                  <SumRow label="저장소" value={validRepos.length ? validRepos.map((r) => r.name).join(", ") : "없음"} />
                  <SumRow label="도메인" value={domains.length ? domains.join(", ") : "없음"} />
                  <SumRow label="연동" value={[integ.github && "GitHub", integ.supabase && "Supabase", integ.slack && "Slack"].filter(Boolean).join(", ")} />
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-[12px] bg-blue-light p-4">
                <Icon name="bolt" className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
                <p className="text-[12px] leading-relaxed text-text-secondary">생성하면 <b className="text-text-primary">스키마 → 프론트엔드 → 백엔드 → 외부 키 발급 → QA → 릴리즈</b> 빌드가 자동으로 준비돼요. 사람은 <b className="text-[#b47908]">휴먼태스크</b>만 처리하면 됩니다.</p>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        {err && <div className="border-t border-line bg-error-light px-6 py-2 text-[12px] font-semibold text-error">{err}</div>}
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <Button onClick={step === 0 ? onClose : prev}>{step === 0 ? "취소" : "이전"}</Button>
          {step < WIZARD_STEPS.length - 1
            ? <Button variant="primary" onClick={next} disabled={!canNext}>다음</Button>
            : <Button variant="primary" onClick={submit} loading={busy} disabled={!name.trim()} icon={<Icon name="check" className="h-4 w-4" />}>프로젝트 생성</Button>}
        </div>
      </div>
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

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-[12px] text-text-tertiary">{label}</span>
      <span className="text-right text-[13px] font-medium text-text-primary">{value || "—"}</span>
    </div>
  )
}

function IntegRow({ icon, title, desc, on, onChange, disabled }: { icon: string; title: string; desc: string; on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-line px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2"><Icon name={icon} className="h-4.5 w-4.5 text-text-secondary" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[14px] font-semibold text-text-primary">{title}{disabled && <Badge tone="neutral">필수</Badge>}</div>
        <div className="text-[12px] text-text-tertiary">{desc}</div>
      </div>
      <Toggle on={on} onChange={disabled ? undefined : onChange} />
    </div>
  )
}
