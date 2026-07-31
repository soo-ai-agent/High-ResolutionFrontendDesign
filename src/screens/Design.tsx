import { useState, useEffect } from "react"
import { Icon, Button, Badge, Card, SectionTitle, SearchField, Drawer, Modal, Row, Tabs, EmptyState, RoleChip, SyncMark, toneFor } from "../components/ui"
import { SOURCES, CRITIC_SCORES, CRITIC_ISSUES, SCREENS } from "../data"
import { useGitHub, listRepos, listIssues, listDocs, getFileContent, GitHubError, type GHRepo, type GHIssue, type GHDoc } from "../lib/github"

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-bold text-text-primary">{title}</div>
      <div className="text-[13px] leading-relaxed text-text-secondary">{children}</div>
    </div>
  )
}

// ============ SOURCES ============
type BaseSource = typeof SOURCES[number]
type Source = BaseSource & { content?: string; url?: string; origin?: "github" }

const ADD_METHODS: { label: string; type: string; icon: string; input: "text" | "file" | "issue" | "repo" }[] = [
  { label: "텍스트 입력", type: "텍스트", icon: "doc", input: "text" },
  { label: "Markdown 업로드", type: "Markdown", icon: "doc", input: "file" },
  { label: "PDF 업로드", type: "PDF", icon: "doc", input: "file" },
  { label: "문서 업로드", type: "문서", icon: "doc", input: "file" },
  { label: "이미지 업로드", type: "이미지", icon: "palette", input: "file" },
  { label: "GitHub Issue 가져오기", type: "GitHub Issue", icon: "github", input: "issue" },
  { label: "저장소 문서 가져오기", type: "저장소 문서", icon: "github", input: "repo" },
]

// GitHub에서 실제 이슈·문서를 골라 자료로 가져오는 위젯
function GitHubImport({ mode, navigate, onImport }: { mode: "issue" | "repo"; navigate: (r: string) => void; onImport: (s: { title: string; content: string; type: string; url?: string }) => void }) {
  const { connected } = useGitHub()
  const [repos, setRepos] = useState<GHRepo[]>([])
  const [repo, setRepo] = useState<GHRepo | null>(null)
  const [issues, setIssues] = useState<GHIssue[]>([])
  const [entries, setEntries] = useState<GHDoc[]>([])
  const [dir, setDir] = useState("")
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!connected) return
    setLoading(true); setErr("")
    listRepos().then(setRepos).catch((e) => setErr(e instanceof GitHubError ? e.message : "저장소를 불러오지 못했어요.")).finally(() => setLoading(false))
  }, [connected])

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-line-strong bg-surface-2 px-4 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface"><Icon name="github" className="h-5 w-5 text-text-secondary" /></span>
        <div className="text-[14px] font-bold text-text-primary">GitHub 연결이 필요해요</div>
        <div className="text-[12px] text-text-secondary">실제 이슈·문서를 가져오려면 먼저 GitHub에 연결하세요.</div>
        <Button variant="primary" onClick={() => navigate("settings")}>설정에서 연결하기</Button>
      </div>
    )
  }

  const openRepo = async (r: GHRepo) => {
    setRepo(r); setLoading(true); setErr(""); setDir(""); setQ("")
    try {
      if (mode === "issue") setIssues(await listIssues(r.owner, r.name))
      else setEntries(await listDocs(r.owner, r.name, ""))
    } catch (e) { setErr(e instanceof GitHubError ? e.message : "불러오지 못했어요.") } finally { setLoading(false) }
  }
  const openDir = async (p: string) => {
    if (!repo) return
    setLoading(true); setErr("")
    try { setEntries(await listDocs(repo.owner, repo.name, p)); setDir(p) }
    catch (e) { setErr(e instanceof GitHubError ? e.message : "불러오지 못했어요.") } finally { setLoading(false) }
  }
  const pickDoc = async (d: GHDoc) => {
    if (!repo) return
    setLoading(true); setErr("")
    try {
      const content = await getFileContent(repo.owner, repo.name, d.path)
      onImport({ title: d.name, content, type: "저장소 문서", url: `https://github.com/${repo.full_name}/blob/${repo.default_branch}/${d.path}` })
    } catch (e) { setErr(e instanceof GitHubError ? e.message : "파일을 읽지 못했어요."); setLoading(false) }
  }

  const spinner = <div className="flex justify-center py-10"><span className="af-spin h-6 w-6 rounded-full border-2 border-line-strong border-t-blue" /></div>

  // 저장소 선택 단계
  if (!repo) {
    const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase()))
    return (
      <div className="space-y-3">
        <SearchField placeholder="저장소 검색" value={q} onChange={setQ} />
        {err && <div className="rounded-[10px] bg-error-light px-3 py-2 text-[12px] font-semibold text-error">{err}</div>}
        {loading ? spinner : (
          <div className="max-h-[320px] space-y-1 overflow-y-auto">
            {filtered.map((r) => (
              <button key={r.id} onClick={() => openRepo(r)} className="flex w-full items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 text-left hover:bg-hover">
                <Icon name="github" className="h-4 w-4 shrink-0 text-text-tertiary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-text-primary">{r.full_name}</div>
                  <div className="text-[11px] text-text-tertiary">{r.private ? "비공개" : "공개"} · {r.default_branch}</div>
                </div>
                <Icon name="chevron" className="h-4 w-4 text-text-tertiary" />
              </button>
            ))}
            {filtered.length === 0 && <div className="py-8 text-center text-[13px] text-text-tertiary">저장소가 없어요.</div>}
          </div>
        )}
      </div>
    )
  }

  // 이슈/문서 선택 단계
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px]">
        <button onClick={() => { setRepo(null); setIssues([]); setEntries([]) }} className="font-semibold text-blue hover:underline">저장소 변경</button>
        <Icon name="chevron" className="h-3.5 w-3.5 text-line-strong" />
        <span className="font-mono font-semibold text-text-secondary">{repo.full_name}</span>
        {mode === "repo" && dir && <><Icon name="chevron" className="h-3.5 w-3.5 text-line-strong" /><span className="font-mono text-text-tertiary">{dir}</span></>}
      </div>
      {err && <div className="rounded-[10px] bg-error-light px-3 py-2 text-[12px] font-semibold text-error">{err}</div>}
      {loading ? spinner : mode === "issue" ? (
        <div className="max-h-[320px] space-y-1 overflow-y-auto">
          {issues.map((i) => (
            <button key={i.number} onClick={() => onImport({ title: `#${i.number} ${i.title}`, content: i.body ?? "", type: "GitHub Issue", url: i.html_url })}
              className="flex w-full items-start gap-2.5 rounded-[10px] border border-line px-3 py-2.5 text-left hover:bg-hover">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${i.state === "open" ? "bg-success" : "bg-text-disabled"}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-text-primary"><span className="font-mono text-text-tertiary">#{i.number}</span> {i.title}</div>
                <div className="text-[11px] text-text-tertiary">{i.state === "open" ? "열림" : "닫힘"}{i.user && ` · @${i.user}`}{i.labels.length > 0 && ` · ${i.labels.slice(0, 3).join(", ")}`}</div>
              </div>
            </button>
          ))}
          {issues.length === 0 && <div className="py-8 text-center text-[13px] text-text-tertiary">이슈가 없어요.</div>}
        </div>
      ) : (
        <div className="max-h-[320px] space-y-1 overflow-y-auto">
          {dir && (
            <button onClick={() => openDir(dir.split("/").slice(0, -1).join("/"))} className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold text-text-secondary hover:bg-hover">
              <Icon name="chevron" className="h-4 w-4 rotate-180 text-text-tertiary" /> 상위 폴더
            </button>
          )}
          {entries.map((d) => (
            <button key={d.path} onClick={() => (d.type === "dir" ? openDir(d.path) : pickDoc(d))}
              className="flex w-full items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5 text-left hover:bg-hover">
              <Icon name={d.type === "dir" ? "board" : "doc"} className="h-4 w-4 shrink-0 text-text-tertiary" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{d.name}</span>
              {d.type === "dir" ? <Icon name="chevron" className="h-4 w-4 text-text-tertiary" /> : <span className="text-[11px] text-text-tertiary">{(d.size / 1024).toFixed(1)}KB</span>}
            </button>
          ))}
          {entries.length === 0 && <div className="py-8 text-center text-[13px] text-text-tertiary">문서가 없어요.</div>}
        </div>
      )}
    </div>
  )
}

export function Sources({ navigate }: { navigate: (r: string) => void }) {
  const [items, setItems] = useState<Source[]>(SOURCES)
  const [sel, setSel] = useState<Source | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adding, setAdding] = useState<typeof ADD_METHODS[number] | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  const closeAdd = () => { setAdding(null); setTitle(""); setBody("") }

  // 자료 생성 공통 로직 — 등록 후 AI 분석(목업)을 흉내 내요.
  const createSource = (s: { title: string; type: string; content?: string; url?: string; origin?: "github" }) => {
    const id = `SRC-${String(items.length + 1).padStart(2, "0")}`
    const draft: Source = { id, title: s.title, type: s.type, state: "분석 중", reqs: 0, conflicts: 0, prd: "미반영", created: "방금", content: s.content, url: s.url, origin: s.origin }
    setItems((prev) => [draft, ...prev])
    closeAdd()
    setTimeout(() => {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, state: "분석 완료", reqs: Math.floor(Math.random() * 12) + 6, conflicts: Math.random() > 0.6 ? 1 : 0 } : x)))
    }, 2200)
  }

  const submitManual = () => {
    if (!adding || !title.trim()) return
    createSource({ title: title.trim(), type: adding.type, content: body || undefined })
  }

  const isGitHub = adding?.input === "issue" || adding?.input === "repo"

  return (
    <div className="space-y-6">
      <SectionTitle title="자료" desc="PRD와 화면 설계에 사용할 원본 자료를 관리하세요."
        action={
          <div className="relative">
            <Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />} onClick={() => setMenuOpen((o) => !o)}>자료 추가</Button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="af-fade absolute right-0 top-12 z-40 w-64 rounded-[14px] border border-line bg-surface p-2 shadow-[var(--shadow-modal)]">
                  {ADD_METHODS.map((m) => (
                    <button key={m.label} onClick={() => { setMenuOpen(false); setAdding(m) }} className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left hover:bg-hover">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface-2 text-text-secondary"><Icon name={m.icon} className="h-4 w-4" /></span>
                      <span className="text-[13px] font-semibold text-text-primary">{m.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        } />
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-2.5">
        <RoleChip owner="human" /><span className="text-[12px] text-text-secondary">사람이 자료를 등록하면</span>
        <Icon name="chevron" className="h-3.5 w-3.5 text-line-strong" />
        <RoleChip owner="ai" /><span className="text-[12px] text-text-secondary">AI가 요구사항·충돌을 자동으로 정리해요</span>
        <span className="ml-auto"><SyncMark synced /></span>
      </div>
      <div>
        <div className="mb-4"><SearchField placeholder="자료 검색" /></div>
        {items.length === 0 ? (
          <EmptyState title="아직 등록된 자료가 없어요." desc="문서나 GitHub Issue를 추가하면 AI가 요구사항을 정리해드려요."
            action={<Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />} onClick={() => setMenuOpen(true)}>자료 추가</Button>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <Card key={s.id} hover onClick={() => setSel(s)} className="p-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-bold text-text-tertiary">{s.id}</span>
                  <Badge tone="neutral">{s.type}</Badge>
                </div>
                <div className="mt-2 text-[15px] font-bold text-text-primary">{s.title}</div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-secondary">
                  <span>요구사항 {s.reqs}</span>
                  <span className={s.conflicts > 0 ? "text-warning" : ""}>충돌 {s.conflicts}</span>
                  <span className="text-text-tertiary">{s.created}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="flex items-center gap-1.5">
                    {s.state === "분석 중" && <span className="af-spin h-3 w-3 rounded-full border-2 border-warning/30 border-t-warning" />}
                    <Badge>{s.state}</Badge>
                  </span>
                  <Badge tone={s.prd === "반영됨" ? "success" : s.prd === "미반영" ? "neutral" : "warning"}>{s.prd}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 자료 추가 입력 */}
      <Modal open={!!adding} onClose={closeAdd} title={adding ? adding.label : ""}
        footer={isGitHub ? <Button onClick={closeAdd}>닫기</Button> : <><Button onClick={closeAdd}>취소</Button><Button variant="primary" onClick={submitManual} disabled={!title.trim()}>추가하기</Button></>}>
        {adding && (
          <div className="space-y-4 text-left">
            {isGitHub ? (
              <GitHubImport mode={adding.input === "issue" ? "issue" : "repo"} navigate={navigate} onImport={(s) => createSource({ ...s, origin: "github" })} />
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-[13px] font-bold text-text-primary">자료 제목</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="예: 회원 관리 요구사항 정리"
                    className="h-11 w-full rounded-[10px] border border-line bg-surface px-3.5 text-[14px] outline-none focus:border-blue" />
                </div>
                {adding.input === "text" && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-bold text-text-primary">내용</label>
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="요구사항이나 회의 내용을 붙여넣으세요."
                      className="w-full rounded-[10px] border border-line bg-surface p-3.5 text-[14px] outline-none focus:border-blue" />
                  </div>
                )}
                {adding.input === "file" && (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-line-strong bg-surface-2 py-8 text-center hover:bg-hover">
                    <Icon name="download" className="h-6 w-6 rotate-180 text-text-tertiary" />
                    <span className="text-[13px] font-semibold text-text-secondary">{adding.type} 파일을 끌어다 놓거나 선택하세요</span>
                    <span className="text-[12px] text-text-tertiary">최대 20MB</span>
                    <input type="file" className="hidden" onChange={(e) => setBody(e.target.files?.[0]?.name ?? "")} />
                    {body && <span className="mt-1 rounded-full bg-blue-light px-3 py-1 text-[12px] font-semibold text-blue">{body}</span>}
                  </label>
                )}
              </>
            )}
            <div className="flex items-center gap-2 rounded-[10px] bg-purple-light p-3">
              <RoleChip owner="ai" /><span className="text-[12px] text-text-secondary">{isGitHub ? "가져오면 AI가 내용을 자동으로 분석해요." : "추가하면 AI가 요구사항을 자동으로 분석해요."}</span>
            </div>
          </div>
        )}
      </Modal>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.title}
        footer={
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[12px] text-text-tertiary"><RoleChip owner="human" /> 사람이 확인 후 반영해요</div>
            <Button variant="primary" full>PRD에 반영하기</Button>
          </div>
        }>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{sel.type}</Badge><Badge>{sel.state}</Badge>
              {sel.origin === "github" && <Badge tone="blue">GitHub</Badge>}
              <span className="text-[11px] text-text-tertiary">분석: AI</span>
            </div>
            {sel.url && (
              <a href={sel.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue hover:underline">
                <Icon name="external" className="h-4 w-4" /> GitHub에서 원본 보기
              </a>
            )}
            {sel.content !== undefined && (
              <Field title="가져온 원본 내용">
                {sel.content.trim() ? (
                  <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap rounded-[10px] bg-surface-2 p-3 font-mono text-[12px] leading-relaxed text-text-secondary">{sel.content}</pre>
                ) : (
                  <span className="text-text-tertiary">본문이 비어 있어요.</span>
                )}
              </Field>
            )}
            <div className="flex items-center gap-2"><RoleChip owner="ai" /><span className="text-[12px] text-text-secondary">아래 요약과 요구사항은 AI가 자동 추출했어요</span></div>
            <Field title="AI 요약">관리자 대시보드에서 회원과 콘텐츠를 관리하기 위한 요구사항을 담은 자료입니다. 목록·검색·권한이 핵심입니다.</Field>
            <Field title="핵심 요구사항"><ul className="ml-4 list-disc space-y-1">{["회원 목록 페이지네이션", "역할 기반 접근 제어", "콘텐츠 상태 필터"].map((x) => <li key={x}>{x}</li>)}</ul></Field>
            <Field title="결정 사항">관리 화면은 데스크톱 우선으로 설계</Field>
            <Field title="미결 사항"><span className="text-warning">세션 만료 정책 미정</span></Field>
            <Field title="화면 후보">ADM-002 회원 관리, ADM-003 콘텐츠 관리</Field>
            <Field title="다른 자료와의 충돌"><div className="rounded-[10px] bg-warning-light p-3 text-[12px] text-[#b47908]">SRC-03과 로그인 실패 정책이 상충합니다.</div></Field>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ============ PRD ============
export function PRD({ navigate }: { navigate: (r: string) => void }) {
  const toc = ["배경 및 문제 정의", "목표", "비목표", "기술 스펙 요약", "미결 사항", "핵심 플로우", "화면 명세", "데이터 및 권한", "비기능 요구사항", "배포 및 운영", "테스트 및 인수 기준"]
  const [active, setActive] = useState(0)
  return (
    <div className="grid gap-6 xl:grid-cols-[220px_1fr_360px]">
      {/* TOC */}
      <div className="hidden xl:block">
        <div className="sticky top-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-disabled">목차</div>
          <ol className="space-y-0.5">
            {toc.map((t, i) => (
              <li key={t}><button onClick={() => setActive(i)} className={`flex w-full gap-2 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium ${active === i ? "bg-selected text-blue" : "text-text-secondary hover:bg-hover"}`}><span className="text-text-tertiary">{i + 1}.</span>{t}</button></li>
            ))}
          </ol>
        </div>
      </div>

      {/* Body */}
      <div>
        {/* toolbar */}
        <div className="sticky top-0 z-10 -mx-1 mb-5 flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-surface/90 px-3 py-2.5 backdrop-blur">
          <Badge>검토 중</Badge>
          <span className="text-[13px] font-semibold text-text-secondary">v1.2</span>
          <span className="text-[12px] text-text-tertiary">· 자동 저장됨</span>
          <span className="hidden items-center gap-1.5 md:inline-flex"><RoleChip owner="ai" label="AI 초안" /><RoleChip owner="human" label="사람 승인" /></span>
          <span className="ml-auto hidden lg:inline-flex"><SyncMark synced /></span>
          <div className="ml-2 flex gap-1.5">
            <Button size="sm">변경사항 비교</Button>
            <Button size="sm" onClick={() => navigate("critic")} icon={<Icon name="critic" className="h-4 w-4" />}>AI 검토 실행</Button>
            <Button size="sm">다운로드</Button>
            <Button size="sm" variant="primary">PR 생성</Button>
          </div>
        </div>

        <Card className="p-8">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-b border-line pb-5 sm:grid-cols-3">
            <Row label="저장소" value="agent-workflow" />
            <Row label="문서 버전" value="v1.2" />
            <Row label="상태" value={<Badge>검토 중</Badge>} />
            <Row label="최초 작성일" value="07/24" />
            <Row label="최종 수정일" value="07/30" />
            <Row label="사용 자료 수" value="4" />
          </div>

          <article className="mt-6 space-y-5">
            <h2 className="text-[20px] font-bold">1. 배경 및 문제 정의</h2>
            <p className="text-[15px] leading-[1.8] text-text-secondary">관리자는 늘어나는 회원과 콘텐츠를 수기로 관리하며 반복 작업에 많은 시간을 씁니다. 목록 조회·검색·권한 관리를 하나의 관리 화면으로 통합해 운영 효율을 높입니다.</p>
            <h2 className="text-[20px] font-bold">2. 목표</h2>
            <ul className="ml-5 list-disc space-y-2 text-[15px] leading-[1.8] text-text-secondary">
              <li>회원·콘텐츠 관리 화면 통합 (핵심 성공 지표: 처리 시간 40% 단축)</li>
              <li>역할 기반 접근 제어 적용</li>
            </ul>
            <div className="rounded-[12px] border border-blue/30 bg-blue-light p-4">
              <div className="flex items-center gap-2 text-[12px] font-bold text-blue"><Icon name="critic" className="h-4 w-4" />문단 선택 시 AI 메뉴</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["AI로 수정", "더 구체적으로", "짧게 정리", "표로 변환", "근거 확인", "미결 사항으로 이동"].map((a) => <span key={a} className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-text-secondary">{a}</span>)}
              </div>
            </div>
            <h2 className="text-[20px] font-bold">6. 핵심 플로우</h2>
            <p className="text-[15px] leading-[1.8] text-text-secondary">로그인 → 대시보드 → 회원 관리 → 상세. 인증 실패 시 처리 흐름은 <span className="rounded bg-error-light px-1.5 font-semibold text-error">미정</span> 상태입니다.</p>
          </article>
        </Card>
      </div>

      {/* AI Critic panel */}
      <div className="hidden xl:block">
        <div className="sticky top-4">
          <Card className="p-5">
            <div className="flex items-center gap-2"><Icon name="critic" className="h-5 w-5 text-blue" /><span className="text-[15px] font-bold">AI Critic</span></div>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-[28px] font-bold text-blue">87</div>
              <span className="text-[13px] text-text-tertiary">/ 100 완성도</span>
            </div>
            <div className="mt-4 space-y-2">
              {CRITIC_ISSUES.slice(0, 3).map((c) => (
                <button key={c.title} onClick={() => navigate("critic")} className="w-full rounded-[10px] border border-line p-3 text-left hover:bg-hover">
                  <Badge tone={c.severity === "차단" ? "error" : c.severity === "경고" ? "warning" : "blue"}>{c.severity}</Badge>
                  <div className="mt-1.5 text-[13px] font-semibold text-text-primary">{c.title}</div>
                  <div className="text-[12px] text-text-tertiary">{c.section}</div>
                </button>
              ))}
            </div>
            <Button full onClick={() => navigate("critic")} icon={<Icon name="sync" className="h-4 w-4" />}>AI 검토 다시 실행</Button>

            {/* AI diff preview */}
            <div className="mt-4 rounded-[10px] border border-line p-3">
              <div className="text-[12px] font-bold text-text-secondary">AI 수정 제안 (Diff)</div>
              <div className="mt-2 space-y-1 font-mono text-[11px]">
                <div className="rounded bg-error-light px-2 py-1 text-error line-through">인증 실패 흐름 미정</div>
                <div className="rounded bg-success-light px-2 py-1 text-success">401·403 응답 처리 및 이동 화면 정의</div>
              </div>
              <div className="mt-2 flex gap-1.5"><Button size="sm">무시</Button><Button size="sm" variant="primary">적용</Button></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ============ CRITIC ============
export function Critic({ navigate }: { navigate: (r: string) => void }) {
  const [filter, setFilter] = useState("전체")
  const filters = ["전체", "차단", "경고", "개선 권장", "해결 완료"]
  const list = filter === "전체" ? CRITIC_ISSUES : CRITIC_ISSUES.filter((c) => c.severity === filter)
  return (
    <div className="space-y-6 pb-20">
      <SectionTitle title="PRD Critic" desc="요구사항의 누락과 충돌을 AI가 점검했어요."
        action={<Button variant="primary" icon={<Icon name="sync" className="h-4 w-4" />}>다시 실행</Button>} />
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-surface-2 px-4 py-2.5">
        <RoleChip owner="ai" /><span className="text-[12px] text-text-secondary">AI가 점검하고 수정안을 제안하면</span>
        <Icon name="chevron" className="h-3.5 w-3.5 text-line-strong" />
        <RoleChip owner="human" /><span className="text-[12px] text-text-secondary">사람이 반영 여부를 결정해요</span>
      </div>
      <div className="flex items-center gap-6 rounded-[16px] border border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          <ScoreRing value={87} />
          <div><div className="text-[13px] font-medium text-text-tertiary">전체 완성도</div><div className="text-[13px] text-text-secondary">마지막 실행 · 10분 전</div></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CRITIC_SCORES.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[13px] font-medium text-text-secondary">{s.label}</div>
            <div className={`mt-1 text-[22px] font-bold ${s.score < 75 ? "text-warning" : "text-text-primary"}`}>{s.score}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eef1f4]"><div className={`h-full rounded-full ${s.score < 75 ? "bg-warning" : "bg-blue"}`} style={{ width: `${s.score}%` }} /></div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        {filters.map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${filter === f ? "bg-blue text-white" : "bg-surface text-text-secondary hover:bg-hover border border-line"}`}>{f}</button>)}
      </div>

      <div className="space-y-3">
        {list.map((c) => (
          <Card key={c.title} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={c.severity === "차단" ? "error" : c.severity === "경고" ? "warning" : c.severity === "해결 완료" ? "success" : "blue"}>{c.severity}</Badge>
              <span className="text-[12px] font-semibold text-text-tertiary">관련: {c.section}</span>
              <span className="ml-auto"><Badge>{c.status}</Badge></span>
            </div>
            <div className="mt-3 text-[16px] font-bold text-text-primary">{c.title}</div>
            <Field title="AI 판단 근거">{c.reason}</Field>
            {c.fix !== "—" && <div className="mt-3 rounded-[10px] bg-success-light p-3"><div className="text-[12px] font-bold text-success">권장 수정안</div><div className="mt-1 text-[13px] text-text-secondary">{c.fix}</div></div>}
            {c.status !== "해결 완료" && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => navigate("prd")}>PRD에서 위치 보기</Button>
                <Button size="sm" variant="primary">수정안 적용</Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-8 py-3">
          <Button>선택 항목 제외</Button>
          <Button variant="primary" onClick={() => navigate("prd")}>PRD 수정안 만들기</Button>
        </div>
      </div>
    </div>
  )
}

function ScoreRing({ value }: { value: number }) {
  const r = 30, c = 2 * Math.PI * r
  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#eef1f4" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="#3182f6" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[20px] font-bold text-text-primary">{value}</div>
    </div>
  )
}

// ============ IA ============
export function IA({ navigate }: { navigate: (r: string) => void }) {
  const [sel, setSel] = useState<any>(null)
  const nodes = [
    { id: "SCR-101", name: "로그인", route: "/login", domain: "auth", x: 40, y: 40, status: "구현 완료", test: "통과", issues: 3 },
    { id: "SCR-102", name: "회원가입", route: "/signup", domain: "auth", x: 40, y: 190, status: "진행 중", test: "미실행", issues: 2 },
    { id: "ADM-001", name: "대시보드", route: "/admin", domain: "admin", x: 340, y: 40, status: "구현 완료", test: "통과", issues: 4 },
    { id: "ADM-002", name: "회원 관리", route: "/admin/members", domain: "admin", x: 340, y: 190, status: "PR 검토 중", test: "미실행", issues: 5 },
    { id: "ADM-003", name: "콘텐츠 관리", route: "/admin/contents", domain: "admin", x: 640, y: 190, status: "대기", test: "미실행", issues: 3 },
  ]
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56"><SearchField placeholder="화면 검색" /></div>
        <Button size="sm">도메인</Button><Button size="sm">권한</Button><Button size="sm">상태</Button>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm">자동 정렬</Button><Button size="sm">전체 보기</Button>
          <Button size="sm" icon={<Icon name="download" className="h-4 w-4" />}>PNG</Button>
          <Button size="sm" icon={<Icon name="download" className="h-4 w-4" />}>SVG</Button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <Card className="h-fit p-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-disabled">도메인</div>
          {["auth", "common", "admin", "chat", "infra", "release"].map((d) => (
            <button key={d} className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-[13px] font-semibold text-text-secondary hover:bg-hover"><span className="h-2 w-2 rounded-full bg-blue" />{d}</button>
          ))}
        </Card>
        <Card className="relative h-[560px] overflow-hidden bg-[radial-gradient(circle,#e5e8eb_1px,transparent_1px)] [background-size:20px_20px]">
          <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
            <path d="M180 76 H340 M180 226 H340 M480 226 H640 M400 116 V190" stroke="#c3ccd6" strokeWidth="1.5" fill="none" />
          </svg>
          {nodes.map((n) => (
            <button key={n.id} onClick={() => setSel(n)} style={{ left: n.x, top: n.y }} className="absolute w-[150px] rounded-[12px] border border-line bg-surface p-3 text-left shadow-[var(--shadow-card)] transition-all hover:border-blue hover:shadow-md">
              <div className="flex items-center justify-between"><span className="font-mono text-[11px] font-bold text-text-tertiary">{n.id}</span><Badge tone="neutral">{n.domain}</Badge></div>
              <div className="mt-1 text-[13px] font-bold">{n.name}</div>
              <div className="font-mono text-[11px] text-text-tertiary">{n.route}</div>
              <div className="mt-2"><Badge>{n.status}</Badge></div>
            </button>
          ))}
          <div className="absolute bottom-3 right-3 h-24 w-36 rounded-[8px] border border-line bg-surface-2/80 p-1"><div className="text-[10px] font-bold text-text-tertiary">미니맵</div></div>
        </Card>
      </div>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel && <span className="font-mono">{sel.id} {sel.name}</span>}
        footer={<Button variant="primary" full onClick={() => { setSel(null); navigate("screen-detail") }}>상세 명세 보기</Button>}>
        {sel && (
          <div className="space-y-4">
            <div className="flex gap-2"><Badge tone="neutral">{sel.domain}</Badge><Badge>{sel.status}</Badge></div>
            <div className="divide-y divide-line">
              <Row label="라우트" value={<span className="font-mono text-[12px]">{sel.route}</span>} />
              <Row label="테스트 상태" value={<Badge>{sel.test}</Badge>} />
              <Row label="연결 화면" value="대시보드" />
              <Row label="관련 작업" value="3건" />
              <Row label="관련 Pull Request" value={<span className="font-mono text-blue">#83, #84</span>} />
              <Row label="관련 API" value={<span className="font-mono text-[12px]">GET /member</span>} />
              <Row label="관련 Issue" value={`${sel.issues}건`} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ============ SCREEN LIST ============
export function ScreenList({ navigate }: { navigate: (r: string) => void }) {
  const [view, setView] = useState("테이블 보기")
  return (
    <div className="space-y-6">
      <SectionTitle title="화면 목록" desc="설계된 화면의 구현·API·테스트 상태를 확인하세요."
        action={<div className="flex gap-2"><Button>화면 명세 재생성</Button><Button variant="primary">작업 생성</Button></div>} />
      <div className="flex items-center justify-between">
        <Tabs tabs={["트리 보기", "테이블 보기"]} active={view} onChange={setView} />
        <div className="flex gap-2"><div className="w-56"><SearchField placeholder="화면 검색" /></div></div>
      </div>

      {view === "테이블 보기" ? (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
                {["화면 ID", "화면명", "라우트", "도메인", "디자인", "프론트엔드", "API", "테스트", "작업"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {SCREENS.flatMap((g) => g.items).map((s) => (
                <tr key={s.id} onClick={() => navigate("screen-detail")} className="cursor-pointer border-b border-line text-[13px] last:border-0 hover:bg-hover">
                  <td className="px-4 py-4 font-mono font-bold text-text-secondary">{s.id}</td>
                  <td className="px-4 py-4 font-semibold text-text-primary">{s.name}</td>
                  <td className="px-4 py-4 font-mono text-text-tertiary">{s.route}</td>
                  <td className="px-4 py-4"><Badge tone="neutral">{s.domain}</Badge></td>
                  <td className="px-4 py-4"><Badge>{s.design}</Badge></td>
                  <td className="px-4 py-4"><Badge>{s.fe}</Badge></td>
                  <td className="px-4 py-4">{s.api === "—" ? "—" : <Badge>{s.api}</Badge>}</td>
                  <td className="px-4 py-4"><Badge>{s.test}</Badge></td>
                  <td className="px-4 py-4 text-text-tertiary">{s.tasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-4">
          {SCREENS.map((g) => (
            <Card key={g.group} className="p-5">
              <div className="text-[14px] font-bold text-text-primary">{g.group}</div>
              <div className="mt-3 space-y-1">
                {g.items.map((s) => (
                  <div key={s.id} onClick={() => navigate("screen-detail")} className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-hover">
                    <Icon name="doc" className="h-4 w-4 text-text-tertiary" />
                    <span className="font-mono text-[12px] font-bold text-text-secondary">{s.id}</span>
                    <span className="text-[14px] font-semibold text-text-primary">{s.name}</span>
                    <span className="ml-auto"><Badge>{s.fe}</Badge></span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ SCREEN DETAIL SPEC ============
export function ScreenDetail({ navigate }: { navigate: (r: string) => void }) {
  const [tab, setTab] = useState("화면 개요")
  const tabs = ["화면 개요", "UI 구성", "동작 시나리오", "상태", "개발 연결", "변경 이력"]
  const states = ["Loading", "Ready", "Validation Error", "Unauthorized", "Server Error", "Empty"]
  const ui = [
    { pos: "상단", comp: "BrandPanel", inc: "서비스명 · 소개 문구", src: "정적", state: "Ready" },
    { pos: "중앙", comp: "LoginForm", inc: "이메일 · 비밀번호 · 로그인 버튼", src: "입력", state: "Validation" },
    { pos: "하단", comp: "SecurityNote", inc: "보안 안내 문구", src: "정적", state: "Ready" },
  ]
  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <button onClick={() => navigate("screens")} className="flex items-center gap-1 text-[13px] font-semibold text-text-tertiary hover:text-text-secondary">
        <Icon name="chevron" className="h-4 w-4 rotate-180" /> 화면 목록
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-bold text-text-tertiary">SCR-101</span>
            <h1 className="text-[22px] font-bold tracking-tight">로그인</h1>
            <Badge tone="success">구현 완료</Badge>
          </div>
          <div className="mt-1.5 font-mono text-[13px] text-text-tertiary">/login</div>
        </div>
        <div className="flex gap-2">
          <Button icon={<Icon name="external" className="h-4 w-4" />}>GitHub에서 열기</Button>
          <Button variant="primary" icon={<Icon name="plus" className="h-4.5 w-4.5" />} onClick={() => navigate("tasks")}>관련 작업 생성</Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "화면 개요" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6"><div className="divide-y divide-line">
            <Row label="설명" value="사용자가 GitHub 계정으로 서비스에 진입하는 화면" />
            <Row label="라우트" value={<span className="font-mono text-[12px]">/login</span>} />
            <Row label="도메인" value={<Badge tone="neutral">auth</Badge>} />
            <Row label="접근 조건" value="비로그인 상태" />
            <Row label="핵심 액션" value="GitHub로 계속하기" />
          </div></Card>
          <Card className="p-6"><div className="divide-y divide-line">
            <Row label="진입 경로" value="랜딩 · 세션 만료" />
            <Row label="종료 경로" value="대시보드 · 오류 화면" />
            <Row label="관련 데이터" value="세션 토큰" />
            <Row label="관련 API" value={<span className="font-mono text-[12px]">POST /auth/login</span>} />
          </div></Card>
        </div>
      )}

      {tab === "UI 구성" && (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-text-tertiary">
              {["위치", "구성요소", "포함 내용", "데이터 출처", "상태"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}
            </tr></thead>
            <tbody>{ui.map((u) => (
              <tr key={u.comp} className="border-b border-line text-[13px] last:border-0 hover:bg-hover">
                <td className="px-5 py-4 text-text-secondary">{u.pos}</td>
                <td className="px-5 py-4 font-mono font-semibold text-text-primary">{u.comp}</td>
                <td className="px-5 py-4 text-text-secondary">{u.inc}</td>
                <td className="px-5 py-4 text-text-tertiary">{u.src}</td>
                <td className="px-5 py-4"><Badge tone="neutral">{u.state}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      {tab === "동작 시나리오" && (
        <div className="space-y-3">
          {[
            { g: "로그인 화면에 접근한 상태", w: "GitHub 계정으로 인증을 완료함", t: "대시보드로 이동", tone: "success" },
            { g: "로그인 화면에 접근한 상태", w: "인증이 거부됨 (401)", t: "오류 메시지 노출 후 재시도 안내", tone: "error" },
          ].map((s, i) => (
            <Card key={i} className="p-5">
              <div className="grid gap-3 md:grid-cols-3">
                {[["Given", s.g, "neutral"], ["When", s.w, "blue"], ["Then", s.t, s.tone]].map(([k, v, tn]) => (
                  <div key={k as string} className="rounded-[12px] bg-surface-2 p-4">
                    <Badge tone={tn as any}>{k}</Badge>
                    <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{v}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "상태" && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {states.map((s) => (
            <Card key={s} className="p-4">
              <div className="flex h-28 items-center justify-center rounded-[10px] bg-surface-2 text-[13px] font-semibold text-text-tertiary">{s}</div>
              <div className="mt-2 text-[13px] font-bold">{s}</div>
            </Card>
          ))}
        </div>
      )}

      {tab === "개발 연결" && (
        <Card className="p-6"><div className="divide-y divide-line">
          <Row label="관련 Task" value={<span className="font-mono">T-047, T-051</span>} />
          <Row label="GitHub Issue" value={<span className="font-mono text-blue">#74, #78</span>} />
          <Row label="Pull Request" value={<span className="font-mono text-blue">#83</span>} />
          <Row label="Actions Check" value={<Badge tone="success">agent-review 성공</Badge>} />
          <Row label="테스트 케이스" value={<span className="font-mono">TC-011, TC-012</span>} />
        </div></Card>
      )}

      {tab === "변경 이력" && (
        <Card className="p-6">
          <div className="space-y-4">
            {[["v1.2", "07/30", "인증 실패 흐름 명세 추가"], ["v1.1", "07/26", "상태 미리보기 6종 정의"], ["v1.0", "07/24", "초안 생성"]].map(([v, d, t]) => (
              <div key={v as string} className="flex items-start gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-light font-mono text-[10px] font-bold text-blue">{(v as string).replace("v", "")}</span>
                <div><div className="text-[13px] font-semibold text-text-primary">{t}</div><div className="text-[12px] text-text-tertiary">{v} · {d}</div></div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ============ FLOW ============
export function Flow() {
  const [flow, setFlow] = useState("정상 흐름")
  const flows = ["정상 흐름", "인증 실패", "권한 부족", "API 오류", "데이터 없음", "외부 인증"]
  return (
    <div className="space-y-4">
      <SectionTitle title="화면 흐름도" desc="사용자 흐름을 노드와 분기로 확인하세요." />
      <div className="flex flex-wrap gap-2">
        {flows.map((f) => <button key={f} onClick={() => setFlow(f)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${flow === f ? "bg-blue text-white" : "border border-line bg-surface text-text-secondary hover:bg-hover"}`}>{f}</button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="relative h-[520px] overflow-hidden bg-[radial-gradient(circle,#e5e8eb_1px,transparent_1px)] [background-size:20px_20px] p-6">
          <div className="flex items-center gap-3">
            <FlowNode label="로그인" tone="blue" />
            <Arrow />
            <FlowNode label="인증 요청" tone="neutral" />
            <Arrow />
            <FlowNode label="성공" tone="success" />
            <Arrow />
            <FlowNode label="대시보드" tone="blue" />
          </div>
          <div className="mt-10 ml-24 space-y-4 border-l-2 border-dashed border-line pl-6">
            <div className="flex items-center gap-3"><FlowNode label="비밀번호 오류" tone="warning" /><Arrow /><FlowNode label="오류 메시지" tone="neutral" /></div>
            <div className="flex items-center gap-3"><FlowNode label="계정 차단" tone="error" /><Arrow /><FlowNode label="접근 제한 안내" tone="neutral" /></div>
            <div className="flex items-center gap-3"><FlowNode label="서버 오류" tone="error" /><Arrow /><FlowNode label="재시도 화면" tone="neutral" /></div>
          </div>
        </Card>
        <Card className="h-fit p-5">
          <div className="text-[15px] font-bold">흐름 상세</div>
          <div className="mt-3 divide-y divide-line">
            <Row label="진입 조건" value="비로그인 상태" />
            <Row label="이동 조건" value="인증 토큰 발급" />
            <Row label="관련 API" value={<span className="font-mono text-[12px]">POST /auth/login</span>} />
            <Row label="오류 처리" value="401 / 403 / 500" />
            <Row label="예상 테스트" value="TC-011, TC-012" />
            <Row label="관련 화면" value="SCR-101, ADM-001" />
          </div>
        </Card>
      </div>
    </div>
  )
}
function FlowNode({ label, tone }: { label: string; tone: any }) {
  const t = toneFor(tone === "neutral" ? "" : tone)
  const bg = tone === "blue" ? "border-blue bg-blue-light text-blue" : tone === "success" ? "border-success bg-success-light text-success" : tone === "warning" ? "border-warning bg-warning-light text-[#b47908]" : tone === "error" ? "border-error bg-error-light text-error" : "border-line bg-surface text-text-primary"
  return <div className={`rounded-[12px] border px-4 py-2.5 text-[13px] font-bold shadow-sm ${bg}`}>{label}</div>
}
function Arrow() { return <Icon name="chevron" className="h-4 w-4 shrink-0 text-line-strong" /> }

// ============ DESIGN SYSTEM ============
export function DesignSystem() {
  const [section, setSection] = useState("Colors")
  const toc = ["Overview", "Colors", "Typography", "Spacing", "Elevation", "Motion", "Components"]
  return (
    <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
      <div>
        <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-disabled">목차</div>
        {toc.map((t) => <button key={t} onClick={() => setSection(t)} className={`block w-full rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold ${section === t ? "bg-selected text-blue" : "text-text-secondary hover:bg-hover"}`}>{t}</button>)}
      </div>
      <div className="space-y-6">
        <SectionTitle title="디자인 시스템" desc="v1.2 · 생성 완료"
          action={<div className="flex gap-2"><Button size="sm">Token 다운로드</Button><Button size="sm" variant="primary">PR 생성</Button></div>} />
        {section === "Colors" && (
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Primary Blue", "#3182f6"], ["Success", "#00a86b"], ["Warning", "#f59f00"], ["Error", "#f04452"], ["Purple", "#7c5cfc"], ["Text Primary", "#191f28"], ["App BG", "#f2f4f6"], ["Border", "#e5e8eb"]].map(([n, hex]) => (
                <div key={n} className="rounded-[12px] border border-line p-3">
                  <div className="h-14 w-full rounded-[8px]" style={{ background: hex }} />
                  <div className="mt-2 text-[13px] font-bold">{n}</div>
                  <div className="font-mono text-[12px] text-text-tertiary">{hex}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {section === "Typography" && (
          <Card className="space-y-4 p-6">
            {[["Display", "text-[32px] font-bold", "32 / 700"], ["Title", "text-[22px] font-bold", "22 / 700"], ["Body", "text-[15px]", "15 / 400"], ["Caption", "text-[12px] text-text-tertiary", "12 / 500"]].map(([n, cls, m]) => (
              <div key={n} className="flex items-baseline justify-between border-b border-line pb-3"><span className={cls as string}>가나다 Agent Flow</span><span className="font-mono text-[12px] text-text-tertiary">{m}</span></div>
            ))}
          </Card>
        )}
        {section === "Motion" && (
          <Card className="space-y-3 p-6">
            {[["duration.fast", "150ms"], ["duration.normal", "200ms"], ["duration.slow", "300ms"]].map(([n, v]) => (
              <div key={n} className="flex items-center justify-between rounded-[10px] bg-surface-2 px-4 py-3"><span className="font-mono text-[13px] font-semibold">{n}</span><span className="text-[13px] text-text-secondary">{v}</span></div>
            ))}
          </Card>
        )}
        {["Overview", "Spacing", "Elevation", "Components"].includes(section) && (
          <Card className="p-6"><Tabs tabs={["Preview", "States", "Usage", "Accessibility", "Tokens"]} active="Preview" onChange={() => {}} />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button><Button>Secondary</Button><Button variant="tertiary">Tertiary</Button><Button variant="danger">Danger</Button>
              <Badge tone="success">완료</Badge><Badge tone="warning">검토 중</Badge><Badge tone="error">실패</Badge>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
