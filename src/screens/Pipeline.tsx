import { Icon, Badge, Card, SectionTitle } from "../components/ui"
import { ACTOR_SUMMARY, PIPELINE_STAGES, type PipelineStage } from "../data"

const ACTOR_TONE = {
  ai: { bg: "bg-purple-light", fg: "text-purple", dot: "bg-purple" },
  auto: { bg: "bg-success-light", fg: "text-success", dot: "bg-success" },
  human: { bg: "bg-warning-light", fg: "text-[#b47908]", dot: "bg-warning" },
}

export default function Pipeline({ navigate }: { navigate: (r: string) => void }) {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="진행 흐름"
        desc="프로젝트가 생성되면 아래 순서로 진행돼요. 에이전트 · GitHub Actions · 사람이 각 단계에서 맡은 일을 이어받아요."
      />

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
          <div className="mt-1.5 flex items-center gap-1.5 pl-8">
            <Badge tone="neutral">{s.phase}</Badge>
            <Badge tone={stateTone as any}>{s.state}</Badge>
          </div>
        </button>
      </td>
      {/* 에이전트 */}
      <td className="px-4 py-4">{s.agent === "—" ? <Muted /> : <span className="text-text-secondary">{s.agent}</span>}</td>
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
