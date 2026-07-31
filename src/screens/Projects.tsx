import { Icon, IconButton, Button, Badge, Card, SummaryCard, SectionTitle, SearchField, Progress } from "../components/ui"
import { PROJECTS } from "../data"

export default function Projects({ navigate }: { navigate: (r: string) => void }) {
  const repoTotal = PROJECTS.reduce((n, p) => n + p.repos.length, 0)
  const active = PROJECTS.filter((p) => p.progress < 100).length
  const failing = PROJECTS.reduce((n, p) => n + p.fails, 0)

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
          <div className="flex items-center gap-1.5 rounded-full bg-success-light px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[12px] font-semibold text-success">GitHub 동기화됨</span>
          </div>
          <IconButton label="알림"><Icon name="bell" /></IconButton>
          <IconButton label="도움말"><Icon name="help" /></IconButton>
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3182f6] to-[#7c5cfc] text-[13px] font-bold text-white">SB</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-8 py-8">
        <SectionTitle
          title="프로젝트"
          desc="프로젝트를 선택해 기획부터 배포까지 진행하세요. 한 프로젝트는 여러 깃 저장소를 묶어요."
          action={<Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />}>프로젝트 추가</Button>}
        />

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard label="전체 프로젝트" value={String(PROJECTS.length)} sub={`진행 중 ${active}`} />
          <SummaryCard label="연결된 저장소" value={String(repoTotal)} sub="프로젝트 하위" tone="blue" />
          <SummaryCard label="실행 중인 Actions" value="2" sub="Backend · Repair" tone="purple" />
          <SummaryCard label="실패한 Workflow" value={String(failing)} sub="즉시 확인 필요" tone="error" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="min-w-[280px] flex-1"><SearchField placeholder="프로젝트 검색" /></div>
          <FilterChip label="단계: 전체" />
          <FilterChip label="최근 업데이트 순" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PROJECTS.map((p) => (
            <Card key={p.id} hover onClick={() => navigate("overview")} className="flex flex-col p-5">
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
      </div>
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
