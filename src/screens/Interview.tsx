import { useEffect, useRef, useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, RoleChip, Row } from "../components/ui"
import { INTERVIEW_BACKLOG, INTERVIEW_AMBIGUITIES, INTERVIEW_QUESTIONS, INTERVIEW_SPEC, BUILD_PLUGINS } from "../data"

type Msg = { role: "ai" | "human"; text: string; tag?: string }

const TOTAL = INTERVIEW_QUESTIONS.length
const labelFor = (id: string) => INTERVIEW_AMBIGUITIES.find((a) => a.id === id)?.label ?? id

// 인터뷰 시작 시점의 대화 — AI가 백로그를 분석하고 첫 질문을 던져요.
function initialMessages(): Msg[] {
  return [
    { role: "ai", text: `백로그 "${INTERVIEW_BACKLOG.title}"를 분석했어요. 바로 구현하기엔 모호한 점 ${TOTAL}가지가 있어서 하나씩 여쭤볼게요.`, tag: "AI 분석 완료" },
    { role: "ai", text: INTERVIEW_QUESTIONS[0].question, tag: INTERVIEW_QUESTIONS[0].why },
  ]
}

export default function Interview({ navigate }: { navigate: (r: string) => void }) {
  const [step, setStep] = useState(0) // 답변한 질문 수
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const done = step >= TOTAL

  // 새 메시지가 쌓이면 대화창을 아래로 스크롤해요.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing, done])

  const answer = (text: string) => {
    if (!text.trim() || typing || done) return
    const q = INTERVIEW_QUESTIONS[step]
    const next = step + 1
    setMessages((m) => [...m, { role: "human", text: text.trim() }])
    setInput("")
    setStep(next)
    setTyping(true)
    // AI가 답을 반영해 모호함을 해소하고 다음 질문(또는 확정)으로 넘어가는 흐름을 흉내내요.
    window.setTimeout(() => {
      setTyping(false)
      setMessages((m) => [
        ...m,
        { role: "ai", text: `"${labelFor(q.resolves)}" 항목을 정리했어요.`, tag: "모호함 해소" },
        next < TOTAL
          ? { role: "ai", text: INTERVIEW_QUESTIONS[next].question, tag: INTERVIEW_QUESTIONS[next].why }
          : { role: "ai", text: "모든 항목이 확정됐어요. 요구사항 명세와 테스트 기준을 만들었어요.", tag: "요구사항 확정" },
      ])
    }, 720)
  }

  const reset = () => {
    setStep(0)
    setMessages(initialMessages())
    setTyping(false)
    setInput("")
  }

  const current = done ? null : INTERVIEW_QUESTIONS[step]

  return (
    <div className="space-y-6">
      <SectionTitle
        title="요구사항 인터뷰"
        desc="AI가 모호한 요구사항을 되물어 명확하게 만든 뒤, 스펙과 테스트 기준을 확정해요."
        action={
          <div className="flex gap-2">
            <Button icon={<Icon name="sync" className="h-4 w-4" />} onClick={reset}>다시 시작</Button>
            <Button variant="primary" disabled={!done} onClick={() => navigate("prd")}>PRD에 반영</Button>
          </div>
        }
      />

      {/* 역할 흐름: 사람이 요구사항을 던지면 → AI가 질문 → 사람이 결정 → AI가 확정 */}
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-2.5">
        <RoleChip owner="human" /><span className="text-[12px] text-text-secondary">사람이 요구사항을 던지면</span>
        <Icon name="chevron" className="h-3.5 w-3.5 text-line-strong" />
        <RoleChip owner="ai" /><span className="text-[12px] text-text-secondary">AI가 모호한 점을 되묻고</span>
        <Icon name="chevron" className="h-3.5 w-3.5 text-line-strong" />
        <RoleChip owner="human" /><span className="text-[12px] text-text-secondary">사람이 결정하면 AI가 스펙을 확정해요</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* 왼쪽: 백로그 + 인터뷰 대화 */}
        <div className="space-y-4">
          {/* 백로그 요구사항 (사람이 등록) */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] font-bold text-text-tertiary">{INTERVIEW_BACKLOG.id}</span>
                <span className="text-[15px] font-bold text-text-primary">{INTERVIEW_BACKLOG.title}</span>
              </div>
              <RoleChip owner="human" label="사람이 등록" />
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{INTERVIEW_BACKLOG.raw}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[12px] text-text-tertiary">
              <span>출처 · {INTERVIEW_BACKLOG.from}</span>
              <span className="font-mono">{INTERVIEW_BACKLOG.screen}</span>
            </div>
          </Card>

          {/* 인터뷰 대화 */}
          <Card className="flex h-[520px] flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="flex items-center gap-2">
                <Icon name="chat" className="h-4.5 w-4.5 text-purple" />
                <span className="text-[14px] font-bold text-text-primary">요구사항 인터뷰 루프</span>
              </div>
              <Badge tone={done ? "success" : "blue"}>{done ? "확정 완료" : `진행 ${step}/${TOTAL}`}</Badge>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((m, i) => <Bubble key={i} msg={m} />)}
              {typing && <Typing />}
              {done && <SpecInline navigate={navigate} />}
            </div>

            {/* 입력 영역: 현재 질문의 빠른 답변 + 자유 입력 */}
            {!done ? (
              <div className="border-t border-line bg-surface-2 px-4 py-3">
                {current && (
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {current.options.map((o) => (
                      <button
                        key={o}
                        onClick={() => answer(o)}
                        disabled={typing}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:border-blue hover:text-blue disabled:opacity-50"
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && answer(input)}
                    disabled={typing}
                    placeholder="직접 답변을 입력하거나 위에서 골라주세요"
                    className="h-11 flex-1 rounded-[10px] border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-blue disabled:opacity-50"
                  />
                  <Button variant="primary" onClick={() => answer(input)} disabled={typing || !input.trim()} icon={<Icon name="chevron" className="h-4 w-4" />}>답변</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-t border-line bg-success-light px-5 py-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white"><Icon name="check" className="h-3 w-3" /></span>
                <span className="text-[13px] font-semibold text-success">모호함 {TOTAL}건을 모두 해소했어요. 스펙이 확정됐어요.</span>
              </div>
            )}
          </Card>
        </div>

        {/* 오른쪽: 모호함 해소 현황 / 확정 스펙 */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Ring value={Math.round((step / TOTAL) * 100)} />
              <div>
                <div className="text-[13px] font-medium text-text-tertiary">모호함 해소</div>
                <div className="text-[15px] font-bold text-text-primary">{step} / {TOTAL} 항목</div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              {INTERVIEW_AMBIGUITIES.map((a, i) => {
                const resolved = i < step
                const active = i === step && !done
                return (
                  <div key={a.id} className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 ${active ? "bg-blue-light" : ""}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${resolved ? "bg-success text-white" : active ? "border-2 border-blue" : "border-2 border-line-strong"}`}>
                      {resolved ? <Icon name="check" className="h-3 w-3" /> : active ? <span className="h-1.5 w-1.5 rounded-full bg-blue" /> : null}
                    </span>
                    <span className={`text-[13px] font-semibold ${resolved ? "text-text-primary" : active ? "text-blue" : "text-text-tertiary"}`}>{a.label}</span>
                    {active && <span className="ml-auto text-[11px] font-bold text-blue">질문 중</span>}
                    {resolved && <span className="ml-auto text-[11px] font-semibold text-success">해소</span>}
                  </div>
                )
              })}
            </div>
          </Card>

          {done && <SpecCard navigate={navigate} />}
        </div>
      </div>
    </div>
  )
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === "human") {
    return (
      <div className="flex items-start justify-end gap-2.5">
        <div className="max-w-[80%]">
          <div className="rounded-[14px] rounded-tr-[4px] bg-blue px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-white">{msg.text}</div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-light text-[#b47908]"><Icon name="user" className="h-4 w-4" /></span>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-light text-purple"><Icon name="sparkle" className="h-4 w-4" /></span>
      <div className="max-w-[80%]">
        <div className="rounded-[14px] rounded-tl-[4px] bg-surface-2 px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-text-primary">{msg.text}</div>
        {msg.tag && <div className="mt-1 pl-1 text-[11px] font-semibold text-text-tertiary">{msg.tag}</div>}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-light text-purple"><Icon name="sparkle" className="h-4 w-4" /></span>
      <div className="flex items-center gap-1 rounded-[14px] rounded-tl-[4px] bg-surface-2 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-text-tertiary" style={{ animation: "af-pulse 1s infinite", animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

// 대화창 안에 인라인으로 뜨는 요약 (스펙 상세는 오른쪽 카드에서 확인)
function SpecInline({ navigate }: { navigate: (r: string) => void }) {
  return (
    <div className="ml-11 rounded-[12px] border border-blue/30 bg-blue-light p-3.5">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-blue"><Icon name="doc" className="h-4 w-4" />{INTERVIEW_SPEC.title}</div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">확정된 요구사항으로 스펙을 작성했어요. 테스트 기준을 먼저 만든 뒤 구현으로 넘어갈 수 있어요.</p>
      <button onClick={() => navigate("prd")} className="mt-2 text-[12px] font-semibold text-blue hover:underline">PRD에 반영하기 →</button>
    </div>
  )
}

// 오른쪽 rail 의 확정 스펙 + TDD(테스트 먼저) + 구현 핸드오프
function SpecCard({ navigate }: { navigate: (r: string) => void }) {
  return (
    <>
      <Card className="af-fade p-5">
        <div className="flex items-center gap-2">
          <Icon name="doc" className="h-4.5 w-4.5 text-blue" />
          <span className="text-[14px] font-bold text-text-primary">확정 스펙</span>
          <span className="ml-auto"><RoleChip owner="ai" label="AI 작성" /></span>
        </div>
        <div className="mt-3 rounded-[10px] bg-surface-2 px-3 py-2 font-mono text-[12px] text-text-secondary">{INTERVIEW_SPEC.api}</div>
        <div className="mt-2 divide-y divide-line">
          {INTERVIEW_SPEC.fields.map((f) => <Row key={f.k} label={f.k} value={f.v} />)}
        </div>
      </Card>

      <Card className="af-fade p-5">
        <div className="flex items-center gap-2">
          <Icon name="test" className="h-4.5 w-4.5 text-success" />
          <span className="text-[14px] font-bold text-text-primary">테스트 먼저 (TDD)</span>
        </div>
        <p className="mt-1 text-[12px] text-text-tertiary">구현 전에 인수 기준을 테스트로 먼저 고정해요.</p>
        <div className="mt-3 space-y-1.5">
          {INTERVIEW_SPEC.acceptance.map((a) => (
            <div key={a} className="flex items-start gap-2 rounded-[10px] bg-success-light px-3 py-2">
              <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span className="text-[12px] leading-relaxed text-text-secondary">{a}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="af-fade p-5">
        <div className="text-[14px] font-bold text-text-primary">구현 에이전트</div>
        <p className="mt-1 text-[12px] text-text-tertiary">테스트가 준비되면 도메인별 자동화 플러그인이 구현해요.</p>
        <div className="mt-3 space-y-2">
          {BUILD_PLUGINS.map((p) => (
            <div key={p.name} className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color === "blue" ? "#3182f6" : "#7c5cfc" }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-text-primary">{p.name} <span className="text-[11px] font-semibold text-text-tertiary">· {p.domain}</span></div>
                <div className="text-[11px] text-text-tertiary">{p.note}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => navigate("tests")}>테스트 계획</Button>
          <Button variant="primary" onClick={() => navigate("tasks")} icon={<Icon name="plus" className="h-4 w-4" />}>작업 만들기</Button>
        </div>
      </Card>
    </>
  )
}

function Ring({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r
  const complete = value >= 100
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#eef1f4" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={complete ? "#00a86b" : "#3182f6"} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-text-primary">{value}%</div>
    </div>
  )
}
