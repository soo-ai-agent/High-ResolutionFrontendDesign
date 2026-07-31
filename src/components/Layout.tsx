import { useState, type ReactNode } from "react"
import { Icon, IconButton, Badge, RoleChip, SyncMark } from "./ui"
import { REPO, PHASES, PROJECT, PROJECT_REPOS } from "../data"

const MENU = [
  { group: "기획", items: [
    { key: "overview", label: "개요", icon: "overview" },
    { key: "sources", label: "자료", icon: "doc" },
    { key: "interview", label: "요구사항 인터뷰", icon: "chat" },
    { key: "prd", label: "PRD", icon: "doc" },
    { key: "critic", label: "PRD Critic", icon: "critic" },
  ] },
  { group: "설계", items: [
    { key: "ia", label: "IA", icon: "ia" },
    { key: "screens", label: "화면 목록", icon: "list" },
    { key: "flow", label: "화면 흐름도", icon: "flow" },
    { key: "design-system", label: "디자인 시스템", icon: "palette" },
  ] },
  { group: "개발", items: [
    { key: "tasks", label: "작업 보드", icon: "board" },
    { key: "pull-requests", label: "Pull Requests", icon: "pr" },
    { key: "runs", label: "Actions 실행", icon: "runs" },
    { key: "tests", label: "테스트", icon: "test" },
  ] },
  { group: "운영", items: [
    { key: "manual-tasks", label: "수동 작업", icon: "manual" },
    { key: "releases", label: "배포 및 릴리스", icon: "rocket" },
    { key: "settings", label: "설정", icon: "settings" },
  ] },
]

export default function Layout({ route, navigate, children }: { route: string; navigate: (r: string) => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-app">
      <Header navigate={navigate} onMenu={() => setCollapsed((c) => !c)} />
      <PhaseStepper route={route} navigate={navigate} />
      <div className="flex min-h-0 flex-1">
        <Sidebar route={route} navigate={navigate} collapsed={collapsed} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

function Header({ navigate, onMenu }: { navigate: (r: string) => void; onMenu: () => void }) {
  const [repoOpen, setRepoOpen] = useState(false)
  return (
    <header className="relative flex h-16 shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
      <button onClick={onMenu} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-secondary hover:bg-hover lg:hidden" aria-label="메뉴">
        <Icon name="menu" />
      </button>
      <button onClick={() => navigate("projects")} className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blue text-white">
          <Icon name="flow" className="h-4.5 w-4.5" />
        </span>
        <span className="text-[17px] font-bold tracking-tight text-text-primary">Agent Flow</span>
      </button>

      {/* Project + repository scope: one project, many repos */}
      <div className="ml-2 flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2 sm:flex">
          <Icon name="board" className="h-4 w-4 text-text-tertiary" />
          <span className="text-[14px] font-bold text-text-primary">{PROJECT.name}</span>
          <span className="rounded-full bg-blue-light px-1.5 py-0.5 text-[11px] font-bold text-blue">프로젝트</span>
        </div>
        <div className="relative">
          <button onClick={() => setRepoOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-[10px] border border-line px-3.5 hover:bg-hover">
            <Icon name="github" className="h-4 w-4 text-text-secondary" />
            <span className="text-[13px] font-semibold text-text-primary">저장소 {PROJECT_REPOS.length}개</span>
            <Icon name="chevronDown" className="h-4 w-4 text-text-tertiary" />
          </button>
          {repoOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setRepoOpen(false)} />
              <div className="af-fade absolute left-0 top-12 z-40 w-72 rounded-[14px] border border-line bg-surface p-2 shadow-[var(--shadow-modal)]">
                <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-text-disabled">프로젝트 저장소</div>
                {PROJECT_REPOS.map((r) => (
                  <button key={r.full} onClick={() => { setRepoOpen(false); navigate("overview") }} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2.5 text-left hover:bg-hover">
                    <Icon name="github" className="h-4 w-4 text-text-tertiary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-text-primary">{r.full}</div>
                      <div className="text-[11px] text-text-tertiary">{r.purpose} · {r.branch}</div>
                    </div>
                    <span className="text-[12px] font-bold text-blue">{r.progress}%</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden xl:block"><SyncMark synced /></div>
        <div className="hidden items-center gap-1.5 rounded-full bg-success-light px-3 py-1.5 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-[12px] font-semibold text-success">GitHub 동기화됨</span>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full bg-blue-light px-3 py-1.5 sm:flex">
          <span className="af-spin h-3 w-3 rounded-full border-2 border-blue/30 border-t-blue" />
          <span className="text-[12px] font-semibold text-blue">Actions 2</span>
        </div>
        <IconButton label="알림"><span className="relative"><Icon name="bell" /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error ring-2 ring-white" /></span></IconButton>
        <IconButton label="도움말"><Icon name="help" /></IconButton>
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3182f6] to-[#7c5cfc] text-[13px] font-bold text-white" aria-label="계정">SB</button>
      </div>
    </header>
  )
}

function PhaseStepper({ route, navigate }: { route: string; navigate: (r: string) => void }) {
  const phaseRoute: Record<string, string> = { overview: "overview", sources: "sources", interview: "interview", prd: "prd", critic: "prd", ia: "ia", tasks: "tasks", test: "tests", build: "tasks", verify: "tests", deploy: "releases", release: "releases" }
  const ownerDot: Record<string, string> = { human: "bg-warning", ai: "bg-purple", both: "bg-blue" }
  const active = PHASES.find((p) => phaseRoute[p.key] === route)
  return (
    <div className="shrink-0 border-b border-line bg-surface">
      <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-6 py-2.5">
        {PHASES.map((p, i) => {
          const isActive = phaseRoute[p.key] === route
          const done = p.status === "완료"
          return (
            <div key={p.key} className="flex items-center">
              <button
                onClick={() => navigate(phaseRoute[p.key] ?? "overview")}
                title={p.ownerNote}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${isActive ? "bg-blue-light" : "hover:bg-hover"}`}
              >
                <span className={`relative flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-success text-white" : isActive ? "bg-blue text-white" : "bg-[#eef1f4] text-text-tertiary"}`}>
                  {done ? <Icon name="check" className="h-3 w-3" /> : i + 1}
                  <span className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white ${ownerDot[p.owner]}`} />
                </span>
                <span className={`whitespace-nowrap text-[13px] font-semibold ${isActive ? "text-blue" : done ? "text-text-primary" : "text-text-tertiary"}`}>{p.label}</span>
                {!done && p.status !== "대기" && (
                  <span className={`h-1.5 w-1.5 rounded-full ${p.status === "실행 중" ? "bg-blue" : "bg-warning"}`} />
                )}
              </button>
              {i < PHASES.length - 1 && <span className="mx-0.5 h-px w-4 bg-line" />}
            </div>
          )
        })}
      </div>
      {/* Context bar: who owns the current phase + legend */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-6 py-2">
        {active && (
          <div className="flex items-center gap-2">
            <RoleChip owner={active.owner} />
            <span className="text-[12px] text-text-secondary">{active.ownerNote}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 text-[11px] font-medium text-text-tertiary">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />사람</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple" />AI</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue" />협업</span>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ route, navigate, collapsed }: { route: string; navigate: (r: string) => void; collapsed: boolean }) {
  return (
    <aside className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-all duration-200 lg:flex ${collapsed ? "w-[72px]" : "w-[240px]"}`}>
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {MENU.map((g) => (
          <div key={g.group} className="mb-6">
            {!collapsed && <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-text-disabled">{g.group}</div>}
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = route === it.key
                return (
                  <button
                    key={it.key}
                    onClick={() => navigate(it.key)}
                    title={it.label}
                    className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-semibold transition-colors ${active ? "bg-selected text-blue" : "text-text-secondary hover:bg-hover"} ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon name={it.icon} className={`h-5 w-5 shrink-0 ${active ? "text-blue" : "text-text-tertiary"}`} />
                    {!collapsed && <span>{it.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      {!collapsed && (
        <div className="border-t border-line p-3">
          <div className="rounded-[12px] bg-surface-2 p-3">
            <div className="flex items-center justify-between text-[12px] font-semibold text-text-secondary">
              <span>현재 진행률</span>
              <span className="text-blue">{REPO.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1f4]">
              <div className="h-full rounded-full bg-blue" style={{ width: `${REPO.progress}%` }} />
            </div>
            <div className="mt-2"><Badge tone="blue">구현 단계</Badge></div>
          </div>
        </div>
      )}
    </aside>
  )
}
