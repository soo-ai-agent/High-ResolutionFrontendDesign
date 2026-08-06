import { useState, type ReactNode } from "react"
import { Icon, IconButton, Badge, SyncMark } from "./ui"
import type { ProjectItem } from "../data"
import { useServerStatus } from "../lib/status"

const fmtTime = (iso: string) => iso.slice(11, 16)

// MVP 메뉴 — 실동작/준실동작 화면만
const MENU = [
  { group: "흐름", items: [
    { key: "pipeline", label: "진행 흐름", icon: "handoff" },
  ] },
  { group: "기획", items: [
    { key: "prd", label: "PRD", icon: "doc" },
    { key: "ia", label: "IA·화면설계", icon: "ia" },
    { key: "rules", label: "코드 규칙", icon: "critic" },
    { key: "tasks", label: "작업 계획", icon: "list" },
  ] },
  { group: "개발", items: [
    { key: "mirror", label: "GitHub 미러", icon: "sync" },
    { key: "projects-board", label: "Projects 보드", icon: "board" },
  ] },
  { group: "운영", items: [
    { key: "human-tasks", label: "휴먼태스크", icon: "hand" },
    { key: "settings", label: "설정", icon: "settings" },
  ] },
]

export default function Layout({ route, navigate, project, children }: { route: string; navigate: (r: string) => void; project?: ProjectItem | null; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-app">
      <Header navigate={navigate} project={project} onMenu={() => setCollapsed((c) => !c)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar route={route} navigate={navigate} collapsed={collapsed} project={project} />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

function Header({ navigate, project, onMenu }: { navigate: (r: string) => void; project?: ProjectItem | null; onMenu: () => void }) {
  const [repoOpen, setRepoOpen] = useState(false)
  const { connected, user, summary } = useServerStatus()
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

      {/* 실제 선택한 프로젝트 + 소속 저장소 (카드 클릭으로 진입한 그 프로젝트) */}
      {project && (
        <div className="ml-2 flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2 sm:flex">
            <Icon name="board" className="h-4 w-4 text-text-tertiary" />
            <span className="text-[14px] font-bold text-text-primary">{project.name}</span>
            <span className="rounded-full bg-blue-light px-1.5 py-0.5 text-[11px] font-bold text-blue">프로젝트</span>
          </div>
          <div className="relative">
            <button onClick={() => setRepoOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-[10px] border border-line px-3.5 hover:bg-hover">
              <Icon name="github" className="h-4 w-4 text-text-secondary" />
              <span className="text-[13px] font-semibold text-text-primary">저장소 {project.repos.length}개</span>
              <Icon name="chevronDown" className="h-4 w-4 text-text-tertiary" />
            </button>
            {repoOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setRepoOpen(false)} />
                <div className="af-fade absolute left-0 top-12 z-40 w-72 rounded-[14px] border border-line bg-surface p-2 shadow-[var(--shadow-modal)]">
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-text-disabled">프로젝트 저장소</div>
                  {project.repos.map((r) => (
                    <div key={r.name} className="flex w-full items-center gap-2 rounded-[10px] px-2 py-2.5 text-left">
                      <Icon name="github" className="h-4 w-4 text-text-tertiary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[13px] font-semibold text-text-primary">{project.org} / {r.name}</div>
                        <div className="text-[11px] text-text-tertiary">{r.purpose}</div>
                      </div>
                    </div>
                  ))}
                  {project.repos.length === 0 && <div className="px-2 py-3 text-[12px] text-text-tertiary">연결된 저장소가 없어요.</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden xl:block"><SyncMark synced={connected} /></div>

        {/* 실제 GitHub 연결 상태 (프록시 /api/github/status) */}
        {connected ? (
          <div className="hidden items-center gap-1.5 rounded-full bg-success-light px-3 py-1.5 md:flex" title={summary?.updatedAt ? `마지막 미러 동기화 ${fmtTime(summary.updatedAt)}` : "웹훅 수신 대기 중"}>
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[12px] font-semibold text-success">GitHub 연결됨{user?.login ? ` · ${user.login}` : ""}</span>
          </div>
        ) : (
          <button onClick={() => navigate("settings")} className="hidden items-center gap-1.5 rounded-full bg-warning-light px-3 py-1.5 hover:brightness-95 md:flex" title="설정에서 GitHub 연결">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            <span className="text-[12px] font-semibold text-[#b47908]">GitHub 연결 필요</span>
          </button>
        )}

        {/* 진행 중 Actions — 실제 미러 요약 기준 (없으면 숨김) */}
        {summary && summary.activeRuns > 0 && (
          <button onClick={() => navigate("runs")} className="hidden items-center gap-1.5 rounded-full bg-blue-light px-3 py-1.5 hover:brightness-95 sm:flex" title="진행 중인 Actions 실행">
            <span className="af-spin h-3 w-3 rounded-full border-2 border-blue/30 border-t-blue" />
            <span className="text-[12px] font-semibold text-blue">Actions {summary.activeRuns}</span>
          </button>
        )}

        <IconButton label="알림"><span className="relative"><Icon name="bell" /><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error ring-2 ring-white" /></span></IconButton>
        <IconButton label="도움말"><Icon name="help" /></IconButton>
        <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3182f6] to-[#7c5cfc] text-[13px] font-bold text-white" aria-label="계정">{user?.login ? user.login.slice(0, 2).toUpperCase() : "SB"}</button>
      </div>
    </header>
  )
}

function Sidebar({ route, navigate, collapsed, project }: { route: string; navigate: (r: string) => void; collapsed: boolean; project?: ProjectItem | null }) {
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
      {!collapsed && project && (
        <div className="border-t border-line p-3">
          <div className="rounded-[12px] bg-surface-2 p-3">
            <div className="flex items-center justify-between text-[12px] font-semibold text-text-secondary">
              <span>현재 진행률</span>
              <span className="text-blue">{project.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1f4]">
              <div className="h-full rounded-full bg-blue" style={{ width: `${project.progress}%` }} />
            </div>
            <div className="mt-2"><Badge tone="blue">{project.stage} 단계</Badge></div>
          </div>
        </div>
      )}
    </aside>
  )
}
