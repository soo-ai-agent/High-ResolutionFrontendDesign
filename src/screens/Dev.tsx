import { useState } from "react"
import { Icon, Button, Badge, Card, SectionTitle, SearchField, Drawer, Row, Tabs, toneFor } from "../components/ui"
import { TASK_COLUMNS, TASKS, PRS, PR_CHECKS, RUNS, RUN_STEPS, TESTS_SUMMARY, TEST_CASES, BUILD_PLUGINS, type Task } from "../data"

const DOMAIN_TONE: Record<string, any> = { backend: "blue", frontend: "purple", test: "success", infra: "warning" }

// TDD 단계 배지 — 테스트 먼저(Red) → 구현(Green) → 리팩터 → 통과
const TDD_BADGE: Record<string, { label: string; tone: any }> = {
  "테스트": { label: "테스트 먼저", tone: "warning" },
  "구현": { label: "구현 · Green", tone: "blue" },
  "리팩터": { label: "리팩터", tone: "purple" },
  "완료": { label: "테스트 통과", tone: "success" },
}
// 도메인별 구현 플러그인 (똑빌더식): 프론트 → Sprint Go, 백엔드 → Ship
const pluginFor = (domain: string) => BUILD_PLUGINS.find((p) => (domain === "frontend" && p.domain === "프론트엔드") || (domain === "backend" && p.domain === "백엔드"))

// ============ TASK BOARD ============
export function Tasks({ navigate }: { navigate: (r: string) => void }) {
  const [view, setView] = useState("칸반")
  const [sel, setSel] = useState<Task | null>(null)

  return (
    <div className="space-y-6">
      <SectionTitle
        title="작업 보드"
        desc="AI 에이전트가 처리할 개발 작업을 단계별로 관리하세요."
        action={
          <div className="flex gap-2">
            <Button icon={<Icon name="sync" className="h-4 w-4" />}>Issue 동기화</Button>
            <Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />}>작업 계획 생성</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Metric label="전체" value="65" />
        <Metric label="테스트 먼저" value="48/65" tone="success" />
        <Metric label="완료" value="38" tone="success" />
        <Metric label="실행 중" value="5" tone="blue" />
        <Metric label="검토 중" value="4" tone="warning" />
        <Metric label="차단" value="2" tone="error" />
      </div>

      <div className="flex items-center justify-between">
        <Tabs tabs={["칸반", "단계 × 도메인", "테이블"]} active={view} onChange={setView} />
        <div className="w-64"><SearchField placeholder="작업 검색" /></div>
      </div>

      {view === "칸반" && (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {TASK_COLUMNS.map((col) => {
            const items = TASKS.filter((t) => t.status === col)
            return (
              <div key={col} className="w-[300px] shrink-0">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-[13px] font-bold text-text-primary">{col}</span>
                  <span className="rounded-full bg-[#eef1f4] px-2 py-0.5 text-[11px] font-bold text-text-tertiary">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((t) => (
                    <TaskCard key={t.id} t={t} onClick={() => setSel(t)} />
                  ))}
                  {items.length === 0 && <div className="rounded-[12px] border border-dashed border-line py-8 text-center text-[12px] text-text-disabled">비어 있음</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === "테이블" && <TaskTable onSelect={setSel} />}
      {view === "단계 × 도메인" && <TaskTable onSelect={setSel} />}

      <TaskDrawer task={sel} onClose={() => setSel(null)} navigate={navigate} />
    </div>
  )
}

function TaskCard({ t, onClick }: { t: Task; onClick: () => void }) {
  return (
    <Card hover onClick={onClick} className="p-4">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-mono font-bold text-text-secondary">{t.id}</span>
        <Badge tone={DOMAIN_TONE[t.domain]}>{t.domain}</Badge>
        <span className="ml-auto"><Badge tone={TDD_BADGE[t.tdd].tone}>{TDD_BADGE[t.tdd].label}</Badge></span>
      </div>
      <div className="mt-2 text-[14px] font-bold leading-snug text-text-primary">{t.title}</div>
      <div className="mt-3 flex items-center gap-1.5">
        <Icon name="manual" className="h-3.5 w-3.5 text-text-tertiary" />
        <span className="text-[12px] text-text-secondary">{t.agent}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-text-tertiary">
        <span>위험도 <b className={t.risk === "높음" ? "text-error" : t.risk === "중간" ? "text-warning" : "text-text-secondary"}>{t.risk}</b></span>
        <span>선행 {t.deps}</span>
        {t.screen !== "—" && <span className="font-mono">{t.screen}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <div className="flex gap-2 text-[12px] font-mono text-text-tertiary">
          {t.issue !== "—" && <span>Issue {t.issue}</span>}
          {t.pr !== "—" && <span className="text-blue">PR {t.pr}</span>}
        </div>
        {t.check !== "—" && <Badge>{t.check}</Badge>}
      </div>
    </Card>
  )
}

function TaskTable({ onSelect }: { onSelect: (t: Task) => void }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
            {["작업", "도메인", "실행 에이전트", "위험도", "선행", "Issue", "PR", "Check", "상태"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {TASKS.map((t) => (
            <tr key={t.id} onClick={() => onSelect(t)} className="cursor-pointer border-b border-line text-[13px] last:border-0 hover:bg-hover">
              <td className="px-5 py-4"><span className="font-mono font-bold text-text-secondary">{t.id}</span><div className="font-semibold text-text-primary">{t.title}</div></td>
              <td className="px-5 py-4"><Badge tone={DOMAIN_TONE[t.domain]}>{t.domain}</Badge></td>
              <td className="px-5 py-4 text-text-secondary">{t.agent}</td>
              <td className="px-5 py-4">{t.risk}</td>
              <td className="px-5 py-4 text-text-tertiary">{t.deps}</td>
              <td className="px-5 py-4 font-mono text-text-tertiary">{t.issue}</td>
              <td className="px-5 py-4 font-mono text-blue">{t.pr}</td>
              <td className="px-5 py-4">{t.check !== "—" ? <Badge>{t.check}</Badge> : "—"}</td>
              <td className="px-5 py-4"><Badge>{t.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function TaskDrawer({ task, onClose, navigate }: { task: Task | null; onClose: () => void; navigate: (r: string) => void }) {
  return (
    <Drawer open={!!task} onClose={onClose} title={task && <span className="font-mono">{task.id} · {task.title}</span>}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button>계획 검증</Button>
          <Button variant="primary" icon={<Icon name="play" className="h-4 w-4" />} onClick={() => navigate("runs")}>AI 작업 시작</Button>
        </div>
      }>
      {task && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2"><Badge tone={DOMAIN_TONE[task.domain]}>{task.domain}</Badge><Badge>{task.status}</Badge><Badge tone={task.risk === "높음" ? "error" : "neutral"}>위험도 {task.risk}</Badge></div>

          <Field title="작업 설명">회원 관리 화면(ADM-002)에서 사용할 회원 목록 조회 API를 구현합니다. 페이지네이션과 검색 파라미터를 지원해야 합니다.</Field>

          <div className="rounded-[12px] bg-purple-light p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><Icon name="manual" className="h-4 w-4 text-purple" /><span className="text-[13px] font-bold text-purple">{task.agent}</span></div>
              {pluginFor(task.domain) && <Badge tone="purple">{pluginFor(task.domain)!.name}</Badge>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-text-secondary"><span>모델 · Claude Sonnet</span><span>최대 Turn · 20</span></div>
          </div>

          <TddFlow phase={task.tdd} />

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-primary">
              <Icon name="test" className="h-4 w-4 text-success" />이 작업의 테스트
              <span className="text-[11px] font-semibold text-text-tertiary">구현 전 먼저 작성</span>
            </div>
            <div className="rounded-[12px] border border-line">
              {(() => {
                const related = TEST_CASES.filter((c) => c.task === task.id)
                if (related.length === 0) return <div className="px-4 py-3 text-[12px] text-text-tertiary">테스트 계획 생성 대기 — AI가 인수 기준을 테스트로 먼저 작성해요.</div>
                return related.map((c, i) => (
                  <div key={c.id} className={`flex items-center justify-between gap-2 px-4 py-2.5 ${i < related.length - 1 ? "border-b border-line" : ""}`}>
                    <div className="min-w-0">
                      <span className="font-mono text-[12px] font-bold text-text-secondary">{c.id}</span>
                      <div className="truncate text-[12px] text-text-secondary">{c.expect}</div>
                    </div>
                    <Badge>{c.status}</Badge>
                  </div>
                ))
              })()}
            </div>
          </div>

          <div className="divide-y divide-line">
            <Row label="작업 범위" value="services/member/*" />
            <Row label="변경 허용 경로" value={<span className="font-mono text-[12px]">api/member/**</span>} />
            <Row label="금지 경로" value={<span className="font-mono text-[12px]">infra/**, .github/**</span>} />
            <Row label="완료 조건" value="목록 API + 단위 테스트 통과" />
            <Row label="테스트 명령" value={<span className="font-mono text-[12px]">pnpm test member</span>} />
            <Row label="선행 작업" value={task.deps} />
            <Row label="관련 화면" value={task.screen} />
            <Row label="GitHub Issue" value={<span className="font-mono text-blue">{task.issue}</span>} />
            <Row label="브랜치" value={<span className="font-mono text-[12px]">feat/{task.id.toLowerCase()}-member-api</span>} />
            <Row label="Pull Request" value={<span className="font-mono text-blue">{task.pr}</span>} />
            <Row label="수정 횟수" value="1 / 2" />
          </div>

          <Field title="Actions 실행 이력">
            <div className="space-y-1.5">
              <RunLine id="#512" text="Backend Agent · 완료 · 11분" />
              <RunLine id="#511" text="CI · 실패 · integration-test" tone="error" />
            </div>
          </Field>
        </div>
      )}
    </Drawer>
  )
}

// ============ PULL REQUESTS ============
export function PullRequests({ navigate }: { navigate: (r: string) => void }) {
  const [sel, setSel] = useState<typeof PRS[number] | null>(null)
  return (
    <div className="space-y-6">
      <SectionTitle title="Pull Requests" desc="에이전트가 생성한 변경을 검토하고 병합하세요." />
      <div className="flex flex-wrap gap-3">
        <Metric label="Draft" value="1" />
        <Metric label="검토 중" value="2" tone="blue" />
        <Metric label="수정 필요" value="1" tone="warning" />
        <Metric label="병합 가능" value="2" tone="success" />
        <Metric label="Check 실패" value="1" tone="error" />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
              {["PR", "제목", "작업", "파일", "위험도", "CI", "AI 검토", "수정", "병합", "상태"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {PRS.map((p) => (
              <tr key={p.num} onClick={() => setSel(p)} className="cursor-pointer border-b border-line text-[13px] last:border-0 hover:bg-hover">
                <td className="px-4 py-4 font-mono font-bold text-blue">{p.num}</td>
                <td className="px-4 py-4 font-semibold text-text-primary">{p.title}</td>
                <td className="px-4 py-4 font-mono text-text-tertiary">{p.task}</td>
                <td className="px-4 py-4 text-text-secondary">{p.files}</td>
                <td className="px-4 py-4">{p.risk}</td>
                <td className="px-4 py-4"><Badge>{`CI ${p.ci}`}</Badge></td>
                <td className="px-4 py-4"><Badge>{p.ai}</Badge></td>
                <td className="px-4 py-4 text-text-secondary">{p.fixes}</td>
                <td className="px-4 py-4"><Badge>{p.mergeable}</Badge></td>
                <td className="px-4 py-4"><Badge>{p.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel && <span className="font-mono">{sel.num} {sel.title}</span>}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={() => navigate("runs")}>AI 수정 요청</Button>
            <Button variant="primary">병합</Button>
          </div>
        }>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2"><Badge>{`CI ${sel.ci}`}</Badge><Badge>{sel.mergeable}</Badge><Badge tone="neutral">수정 {sel.fixes}</Badge></div>
            <Field title="관련 작업 완료 조건">회원 목록 API + 단위 테스트 통과, 페이지네이션 지원</Field>

            <div>
              <div className="mb-2 text-[13px] font-bold">Check 목록</div>
              <div className="rounded-[12px] border border-line">
                {PR_CHECKS.map((c, i) => {
                  const tone = toneFor(c.status)
                  return (
                    <div key={c.name} className={`flex items-center justify-between px-4 py-2.5 text-[13px] ${i < PR_CHECKS.length - 1 ? "border-b border-line" : ""}`}>
                      <span className="font-mono text-text-secondary">{c.name}</span>
                      <span className="flex items-center gap-1.5 font-semibold" style={{ color: tone === "success" ? "#00a86b" : tone === "error" ? "#f04452" : "#f59f00" }}>
                        {c.status === "성공" ? <Icon name="check" className="h-4 w-4" /> : c.status === "실패" ? <Icon name="close" className="h-4 w-4" /> : <span className="af-spin h-3 w-3 rounded-full border-2 border-warning/30 border-t-warning" />}
                        {c.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="divide-y divide-line">
              <Row label="변경 파일" value={`${sel.files}개`} />
              <Row label="변경 범위 위반" value="없음" />
              <Row label="Review Agent 결과" value={<span className="text-warning">경고 1건</span>} />
              <Row label="보안 영향" value="없음" />
              <Row label="배포 영향" value="DB 스키마 변경 없음" />
            </div>

            <div className="rounded-[12px] bg-error-light p-4">
              <div className="text-[13px] font-bold text-error">integration-test 실패</div>
              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">회원 목록 페이지네이션에서 빈 결과 처리 누락. Repair Agent로 자동 수정을 요청할 수 있어요.</p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ============ RUNS ============
export function Runs() {
  const [sel, setSel] = useState<typeof RUNS[number] | null>(null)
  return (
    <div className="space-y-6">
      <SectionTitle title="Actions 실행" desc="GitHub Actions와 AI 에이전트 실행 현황을 확인하세요."
        action={<div className="flex gap-2"><Button icon={<Icon name="sync" className="h-4 w-4" />}>새로고침</Button><Button variant="primary" icon={<Icon name="play" className="h-4 w-4" />}>Workflow 실행</Button></div>} />
      <div className="flex flex-wrap gap-3">
        <Metric label="실행 중" value="2" tone="blue" />
        <Metric label="성공" value="184" tone="success" />
        <Metric label="실패" value="7" tone="error" />
        <Metric label="취소" value="3" />
        <Metric label="평균 실행 시간" value="6분 12초" />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
              {["Run", "Workflow", "대상", "에이전트", "시도", "시작", "실행 시간", "모델", "상태", "결과"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {RUNS.map((r) => (
              <tr key={r.id} onClick={() => setSel(r)} className="cursor-pointer border-b border-line text-[13px] last:border-0 hover:bg-hover">
                <td className="px-4 py-4 font-mono font-bold text-text-secondary">{r.id}</td>
                <td className="px-4 py-4 font-semibold text-text-primary">{r.workflow}</td>
                <td className="px-4 py-4 font-mono text-text-tertiary">{r.target}</td>
                <td className="px-4 py-4 text-text-secondary">{r.agent}</td>
                <td className="px-4 py-4 text-text-tertiary">{r.attempt}</td>
                <td className="px-4 py-4 text-text-tertiary">{r.started}</td>
                <td className="px-4 py-4 text-text-secondary">{r.dur}</td>
                <td className="px-4 py-4 text-text-tertiary">{r.model}</td>
                <td className="px-4 py-4"><Badge>{r.status}</Badge></td>
                <td className="px-4 py-4 font-mono text-blue">{r.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel && <span className="font-mono">{sel.id} {sel.workflow}</span>}
        footer={<Button variant="primary" full icon={<Icon name="sync" className="h-4 w-4" />}>다시 실행</Button>}>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2"><Badge>{sel.status}</Badge><Badge tone="purple">{sel.model}</Badge><Badge tone="neutral">{sel.attempt}</Badge></div>
            <div>
              <div className="mb-2 text-[13px] font-bold">실행 타임라인</div>
              <div className="space-y-0">
                {RUN_STEPS.map((s, i) => (
                  <div key={s.name} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white"><Icon name="check" className="h-3.5 w-3.5" /></span>
                      {i < RUN_STEPS.length - 1 && <span className="h-6 w-0.5 bg-success/40" />}
                    </div>
                    <div className="pb-3">
                      <div className="text-[13px] font-semibold text-text-primary">{s.name}</div>
                      <div className="text-[12px] text-text-tertiary">{s.started} · {s.dur}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="divide-y divide-line">
              <Row label="입력 문서" value="설계 v1.1" />
              <Row label="Prompt 버전" value="backend-agent@2.3" />
              <Row label="변경 파일" value="7개" />
              <Row label="테스트 명령" value={<span className="font-mono text-[12px]">pnpm test member</span>} />
            </div>

            <div>
              <div className="mb-2 text-[13px] font-bold">로그</div>
              <div className="rounded-[12px] border border-line bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-text-secondary">
                <div><span className="text-text-tertiary">10:07:56</span> Running tests…</div>
                <div><span className="text-text-tertiary">10:08:20</span> <span className="text-success">✓ member.list returns paginated</span></div>
                <div><span className="text-text-tertiary">10:08:44</span> <span className="text-success">✓ member.list applies search</span></div>
                <div><span className="text-text-tertiary">10:09:16</span> Created PR #83</div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ============ TESTS ============
export function Tests() {
  const [tab, setTab] = useState("테스트 케이스")
  const [sel, setSel] = useState<typeof TEST_CASES[number] | null>(null)
  return (
    <div className="space-y-6">
      <SectionTitle title="테스트" desc="화면과 작업별 테스트 결과와 결함을 확인하세요." />
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-success-light px-4 py-2.5">
        <Icon name="test" className="h-4 w-4 shrink-0 text-success" />
        <span className="text-[13px] font-semibold text-success">구현 전에 테스트를 먼저 작성해요 (TDD).</span>
        <span className="text-[12px] text-text-secondary">인수 기준 → 테스트 작성(Red) → 구현(Green) 순서로 진행돼요.</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {TESTS_SUMMARY.map((s) => <Metric key={s.label} label={s.label} value={s.value} tone={(s as any).tone} />)}
      </div>
      <Tabs tabs={["테스트 계획", "테스트 케이스", "실행 결과", "결함", "인수 기준"]} active={tab} onChange={setTab} />

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
              {["ID", "관련 화면", "관련 작업", "유형", "사전 조건", "기대 결과", "상태"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {TEST_CASES.map((c) => (
              <tr key={c.id} onClick={() => c.status === "실패" && setSel(c)} className={`border-b border-line text-[13px] last:border-0 ${c.status === "실패" ? "cursor-pointer hover:bg-hover" : ""}`}>
                <td className="px-4 py-4 font-mono font-bold text-text-secondary">{c.id}</td>
                <td className="px-4 py-4 font-mono text-text-tertiary">{c.screen}</td>
                <td className="px-4 py-4 font-mono text-text-tertiary">{c.task}</td>
                <td className="px-4 py-4"><Badge tone="neutral">{c.type}</Badge></td>
                <td className="px-4 py-4 text-text-secondary">{c.pre}</td>
                <td className="px-4 py-4 text-text-secondary">{c.expect}</td>
                <td className="px-4 py-4"><Badge>{c.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel && <span className="font-mono">{sel.id} 실패</span>}
        footer={<Button variant="primary" full icon={<Icon name="manual" className="h-4 w-4" />}>Repair Agent 실행</Button>}>
        {sel && (
          <div className="space-y-5">
            <Field title="실패 원인">기대한 20건 대신 0건이 반환되었습니다. 페이지네이션 offset 계산 오류로 추정됩니다.</Field>
            <Field title="재현 방법">관리자 세션으로 /admin/members 접근 → 목록 요청 → 응답 검증</Field>
            <Field title="관련 로그">
              <div className="rounded-[10px] bg-surface-2 p-3 font-mono text-[12px] text-error">AssertionError: expected 20 to equal 0</div>
            </Field>
            <div className="divide-y divide-line">
              <Row label="관련 Pull Request" value={<span className="font-mono text-blue">#83</span>} />
              <Row label="관련 작업" value={<span className="font-mono">{sel.task}</span>} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ---- shared bits ----
function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  const color = tone === "success" ? "text-success" : tone === "error" ? "text-error" : tone === "warning" ? "text-[#b47908]" : tone === "blue" ? "text-blue" : "text-text-primary"
  return (
    <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
      <div className="text-[12px] font-medium text-text-tertiary">{label}</div>
      <div className={`text-[20px] font-bold ${color}`}>{value}</div>
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
function RunLine({ id, text, tone }: { id: string; text: string; tone?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-[12px]">
      <span className="font-mono font-bold text-text-secondary">{id}</span>
      <span className={tone === "error" ? "text-error" : "text-text-secondary"}>{text}</span>
    </div>
  )
}

// TDD 3단계 진행 표시 — 테스트 먼저(Red) → 구현(Green) → 리팩터. 현재 단계를 강조해요.
function TddFlow({ phase }: { phase: string }) {
  const order = ["테스트", "구현", "리팩터", "완료"]
  const cur = order.indexOf(phase)
  const steps = [
    { key: "테스트", label: "테스트 먼저", sub: "Red" },
    { key: "구현", label: "구현", sub: "Green" },
    { key: "리팩터", label: "리팩터", sub: "Refactor" },
  ]
  return (
    <div className="rounded-[12px] border border-line p-4">
      <div className="flex items-center gap-1.5 text-[13px] font-bold text-text-primary"><Icon name="test" className="h-4 w-4 text-success" />TDD 진행 · 테스트 먼저</div>
      <div className="mt-3 flex items-center gap-0.5">
        {steps.map((s, i) => {
          const stepIdx = order.indexOf(s.key)
          const done = phase === "완료" || cur > stepIdx
          const active = phase === s.key
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <div className={`flex-1 rounded-[10px] border p-2.5 text-center ${active ? "border-blue bg-blue-light" : done ? "border-line bg-surface-2" : "border-dashed border-line bg-surface"}`}>
                <div className="flex items-center justify-center gap-1">
                  {done && <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success text-white"><Icon name="check" className="h-2.5 w-2.5" /></span>}
                  <span className={`text-[12px] font-bold ${active ? "text-blue" : done ? "text-text-primary" : "text-text-tertiary"}`}>{s.label}</span>
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-text-tertiary">{s.sub}</div>
              </div>
              {i < steps.length - 1 && <Icon name="chevron" className="h-3.5 w-3.5 shrink-0 text-line-strong" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
