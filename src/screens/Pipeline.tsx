import { Icon, Badge, Card, SectionTitle } from "../components/ui"
import { ACTOR_SUMMARY, PIPELINE_STAGES, FUTURE_INTEGRATION, type PipelineStage } from "../data"

const ACTOR_TONE = {
  ai: { bg: "bg-purple-light", fg: "text-purple", dot: "bg-purple" },
  auto: { bg: "bg-success-light", fg: "text-success", dot: "bg-success" },
  human: { bg: "bg-warning-light", fg: "text-[#b47908]", dot: "bg-warning" },
}

// 실제 동작 판정 — live(실동작) / partial(부분) / mock(목업)
const REAL_META: Record<string, { label: string; cls: string; dot: string }> = {
  live: { label: "실동작", cls: "bg-success-light text-success", dot: "bg-success" },
  partial: { label: "부분", cls: "bg-warning-light text-[#b47908]", dot: "bg-warning" },
  mock: { label: "목업", cls: "bg-[#eef1f4] text-text-tertiary", dot: "bg-[#8b95a1]" },
}

function RealChip({ real }: { real: string }) {
  const m = REAL_META[real] ?? REAL_META.mock
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />{m.label}</span>
}

// 지금 실제로 동작하는 기반(backbone) — Phase 0~2 로 만든 실제 연동
const LIVE_BACKBONE = [
  "GitHub 프록시 — 저장소·이슈·문서 읽기, 이슈 생성·@claude 코멘트 쓰기",
  "웹훅 수신(서명 검증) · 저장소 웹훅 등록 · projects_v2_item 보드 이동 미러",
  "백필 — 현재 이슈·PR·Actions를 미러에 채우기",
  "DB 미러 · Projects 보드 · 상단바 실시간 상태",
  "PAT 연결(서버 보관) · 배포 준비(Dockerfile · fly.toml)",
]

export default function Pipeline({ navigate }: { navigate: (r: string) => void }) {
  const counts = PIPELINE_STAGES.reduce((a, s) => ({ ...a, [s.real]: (a[s.real] ?? 0) + 1 }), {} as Record<string, number>)
  return (
    <div className="space-y-6">
      <SectionTitle
        title="진행 흐름"
        desc="프로젝트가 생성되면 아래 순서로 진행돼요. 에이전트 · GitHub Actions · 사람이 각 단계에서 맡은 일을 이어받아요."
      />

      {/* 지금 실제로 동작하는 기반(backbone) */}
      <Card className="border-success/30 bg-success-light/20 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-success-light text-success"><Icon name="bolt" className="h-4.5 w-4.5" /></span>
          <div>
            <div className="flex items-center gap-2"><span className="text-[15px] font-bold text-text-primary">지금 실제로 동작하는 기반</span><Badge tone="success">실동작</Badge></div>
            <div className="text-[12px] text-text-tertiary">아래 GitHub 연동은 목업이 아니라 서버로 실제 동작해요(연결·배포 시).</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {LIVE_BACKBONE.map((b) => (
            <div key={b} className="flex items-start gap-2 text-[13px] text-text-secondary">
              <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-success" />{b}
            </div>
          ))}
        </div>
      </Card>

      {/* 판정 범례 + 요약 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] bg-surface-2 px-4 py-3 text-[12px] text-text-secondary">
        <span className="font-bold text-text-primary">단계별 실제 동작 판정</span>
        <span className="flex items-center gap-1.5"><RealChip real="live" /> 핵심 자동화가 지금 실제로 수행</span>
        <span className="flex items-center gap-1.5"><RealChip real="partial" /> 일부만 실제(주로 GitHub 연동), 에이전트 미실행</span>
        <span className="flex items-center gap-1.5"><RealChip real="mock" /> 화면만, 실제 실행 없음</span>
        <span className="ml-auto text-text-tertiary">실동작 {counts.live ?? 0} · 부분 {counts.partial ?? 0} · 목업 {counts.mock ?? 0}</span>
      </div>

      {/* 세 주체가 각각 하는 일 요약 */}
      <div className="grid gap-4 md:grid-cols-3">
        {ACTOR_SUMMARY.map((a) => {
          const t = ACTOR_TONE[a.key]
          return (
            <Card key={a.key} className={`p-5 ${a.key === "human" ? "border-warning/40" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${t.bg}`}><Icon name={a.icon} className={`h-4.5 w-4.5 ${t.fg}`} /></span>
                <span className="text-[15px] font-bold text-text-primary">{a.title}</span>
                {a.key === "human" && <span className="ml-auto rounded-full bg-warning-light px-2.5 py-1 text-[11px] font-bold text-[#b47908]">여기만 신경 쓰면 돼요</span>}
              </div>
              <ul className="mt-3 space-y-2">
                {a.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />{it}
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>

      {/* 단계별 담당 매트릭스 */}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
              <th className="w-[240px] px-4 py-3">단계</th>
              <th className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple" />에이전트 (AI)</span></th>
              <th className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />GitHub Actions</span></th>
              <th className="bg-warning-light/40 px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" />사람 (체크)</span></th>
            </tr>
          </thead>
          <tbody>
            {PIPELINE_STAGES.map((s) => <StageRow key={s.n} s={s} navigate={navigate} />)}
          </tbody>
        </table>
      </Card>

      <div className="flex items-start gap-2 rounded-[12px] bg-surface-2 px-4 py-3">
        <Icon name="hand" className="mt-0.5 h-4 w-4 shrink-0 text-[#b47908]" />
        <p className="text-[13px] leading-relaxed text-text-secondary">
          사람은 <b className="text-[#b47908]">사람 열</b>과 <b className="text-[#b47908]">휴먼태스크</b>만 챙기면 돼요. 나머지 단계는 에이전트와 GitHub Actions가 자동으로 진행하고, 사람 확인이 필요할 때만 알려줘요.
        </p>
      </div>

      {/* 추후 실제 연동 (현재는 목업 프로토타입) */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-light text-blue"><Icon name="bolt" className="h-4.5 w-4.5" /></span>
          <div>
            <div className="flex items-center gap-2"><span className="text-[15px] font-bold text-text-primary">추후 구현 · 실제 연동</span><Badge tone="neutral">프로토타입</Badge></div>
            <div className="text-[12px] text-text-tertiary">지금은 목업 데이터로 흐름을 보여줘요. 실제 운영하려면 아래 연동이 이어져야 해요.</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {FUTURE_INTEGRATION.map((f, i) => (
            <div key={f.title} className="flex items-start gap-2.5 rounded-[12px] border border-line p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-text-tertiary">{i + 1}</span>
              <div>
                <div className="text-[13px] font-bold text-text-primary">{f.title}</div>
                <div className="text-[12px] leading-relaxed text-text-secondary">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function StageRow({ s, navigate }: { s: PipelineStage; navigate: (r: string) => void }) {
  const running = s.state === "진행 중"
  const stateTone = s.state === "완료" ? "success" : running ? "blue" : "neutral"
  return (
    <tr className={`border-b border-line align-top text-[13px] last:border-0 ${running ? "bg-blue-light/30" : ""}`}>
      {/* 단계 */}
      <td className="px-4 py-4">
        <button onClick={() => navigate(s.route)} className="group text-left">
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s.state === "완료" ? "bg-success text-white" : running ? "bg-blue text-white" : "bg-surface-2 text-text-tertiary"}`}>
              {s.state === "완료" ? <Icon name="check" className="h-3.5 w-3.5" /> : s.n}
            </span>
            <span className="text-[14px] font-bold text-text-primary group-hover:text-blue">{s.stage}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
            <Badge tone="neutral">{s.phase}</Badge>
            <Badge tone={stateTone as any}>{s.state}</Badge>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text-tertiary"><Icon name="runs" className="h-3 w-3" />{s.duration}</span>
            <RealChip real={s.real} />
          </div>
        </button>
        <div className="mt-2 max-w-[560px] pl-8 text-[11px] leading-relaxed text-text-tertiary">{s.realNote}</div>
      </td>
      {/* 에이전트 */}
      <td className="px-4 py-4">
        {s.agent === "—" ? <Muted /> : (
          <div>
            <div className="text-text-secondary">{s.agent}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-light px-2 py-0.5 font-semibold text-purple"><Icon name="sparkle" className="h-3 w-3" />{s.agentName}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-text-tertiary">{s.model}</span>
            </div>
          </div>
        )}
      </td>
      {/* GitHub Actions */}
      <td className="px-4 py-4">{s.actions === "—" ? <Muted /> : <span className="text-text-secondary">{s.actions}</span>}</td>
      {/* 사람 */}
      <td className={`px-4 py-4 ${s.humanCheck ? "bg-warning-light/50" : ""}`}>
        {s.human === "—" ? (
          <span className="inline-flex items-center gap-1.5 text-text-tertiary"><Icon name="bolt" className="h-3.5 w-3.5 text-success" />자동 진행 · 대기 불필요</span>
        ) : (
          <div className="flex items-start gap-1.5">
            <Icon name="user" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b47908]" />
            <div>
              <div className="font-medium text-text-primary">{s.human}</div>
              {s.humanCheck && <span className="mt-1.5 inline-block"><Badge tone="warning">사람 확인 필요</Badge></span>}
            </div>
          </div>
        )}
      </td>
    </tr>
  )
}

function Muted() {
  return <span className="text-text-disabled">—</span>
}
