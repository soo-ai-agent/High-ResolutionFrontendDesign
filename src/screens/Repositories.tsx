import { Icon, IconButton, Button, Badge, Card, SummaryCard, SectionTitle, SearchField, Progress } from "../components/ui"
import { REPOS } from "../data"

export default function Repositories({ navigate }: { navigate: (r: string) => void }) {
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
          title="저장소"
          desc="연결된 저장소의 자동화 진행 상태를 확인하세요."
          action={<Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />}>저장소 연결</Button>}
        />

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard label="연결된 저장소" value="5" sub="공개 2 · 비공개 3" />
          <SummaryCard label="실행 중인 Actions" value="2" sub="Backend · Repair" tone="blue" />
          <SummaryCard label="열린 Pull Request" value="6" sub="병합 대기 2" tone="purple" />
          <SummaryCard label="실패한 Workflow" value="3" sub="즉시 확인 필요" tone="error" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="min-w-[280px] flex-1"><SearchField placeholder="저장소 검색" /></div>
          <FilterChip label="상태: 전체" />
          <FilterChip label="최근 업데이트 순" />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPOS.map((r) => (
            <Card key={r.full} hover onClick={() => navigate("overview")} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon name="github" className="h-4.5 w-4.5 text-text-secondary" />
                  <span className="text-[15px] font-bold text-text-primary">{r.full}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.visibility === "공개" ? "bg-surface-2 text-text-tertiary" : "bg-purple-light text-purple"}`}>{r.visibility}</span>
              </div>

              <div className="mt-2 flex items-center gap-2 text-[12px] text-text-tertiary">
                <Icon name="flow" className="h-3.5 w-3.5" /> {r.branch}
                <span className="text-line-strong">·</span>
                {r.synced ? <span className="text-success">동기화됨</span> : <span className="text-warning">동기화 필요</span>}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Badge>{`현재 단계 · ${r.phase}`}</Badge>
                <span className="text-[13px] font-bold text-text-primary">{r.progress}%</span>
              </div>
              <div className="mt-2"><Progress value={r.progress} tone={r.progress === 100 ? "success" : "blue"} /></div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="열린 작업" value={r.tasks} />
                <Stat label="열린 PR" value={r.prs} />
                <Stat label="실패 실행" value={r.fails} tone={r.fails > 0 ? "error" : "default"} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-[12px] font-medium text-text-secondary">{r.deploy}</span>
                <span className="text-[12px] text-text-tertiary">{r.updated}</span>
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
