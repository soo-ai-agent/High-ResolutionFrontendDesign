import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Icon, IconButton, Button, Badge, Card, SectionTitle, EmptyState } from "../components/ui"
import type { ProjectItem } from "../data"
import { getDoc, generateDoc, saveDoc, splitDoc, joinDoc, listDocRevisions, getDocRevision, restoreDocRevision, syncRulesToRepos, type ProjectDoc, type DocType, type DocRevision } from "../lib/projectDocs"
import { diffLines, type DiffOp } from "../lib/diff"

const SOURCE_BADGE: Record<ProjectDoc["source"], { label: string; tone: "purple" | "neutral" | "blue" }> = {
  agent: { label: "에이전트 초안", tone: "purple" },
  template: { label: "템플릿 초안", tone: "neutral" },
  human: { label: "사람 수정됨", tone: "blue" },
}

// 문서 타입별 라벨 — 화면 동작은 동일하고 이름만 달라요.
const DOC_META: Record<DocType, { name: string; genDesc: string }> = {
  prd: { name: "PRD", genDesc: "프로젝트 정보(이름·설명·저장소 구성)를 바탕으로 에이전트가 요구사항 문서 초안을 만들어요." },
  ia: { name: "IA·화면설계", genDesc: "프로젝트 정보(이름·설명·저장소 구성)를 바탕으로 에이전트가 화면 구조(IA)·SCR 목록·화면별 상세 명세 초안을 만들어요." },
  rules: { name: "코드 규칙", genDesc: "저장소 코드를 분석해 에이전트가 이 프로젝트 전용 규칙 초안을 만들어요. 동기화하면 조직 공통 규칙(조직 규칙·스킬 메뉴)과 병합되어 저장소 CLAUDE.md 로 푸시돼요." },
}

export default function ProjectDocScreen({ project, docType }: { project: ProjectItem | null; docType: DocType }) {
  const meta_ = DOC_META[docType]
  const [doc, setDoc] = useState<ProjectDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // 섹션 단위 수정 — 한 번에 한 섹션만
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [active, setActive] = useState(0)
  // 문서 정보(의뢰사·작성자·제목) 수정
  const [metaEditing, setMetaEditing] = useState(false)
  const [meta, setMeta] = useState({ title: "", client: "", author: "" })
  // 버전 이력 — 에이전트 초안과 현재 문서를 비교(diff)해 평가해요.
  const [historyOpen, setHistoryOpen] = useState(false)
  // 코드 규칙 전용 — 저장소 CLAUDE.md 동기화 결과 배너
  const [syncNotice, setSyncNotice] = useState("")

  const blocks = useMemo(() => (doc ? splitDoc(doc.contentMd) : []), [doc])

  useEffect(() => {
    if (!project) return
    let alive = true
    setLoading(true)
    setDoc(null)
    setEditingIdx(null)
    getDoc(project.id, docType)
      .then((p) => { if (alive) setDoc(p) })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [project, docType])

  // 스크롤 위치에 따라 목차 활성 항목 갱신
  useEffect(() => {
    if (!doc || editingIdx !== null) return
    const els = blocks.map((_, i) => document.getElementById(`doc-sec-${i}`)).filter((el): el is HTMLElement => !!el)
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(Number((vis[0].target as HTMLElement).dataset.idx))
      },
      { rootMargin: "-10% 0px -70% 0px" },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [blocks, editingIdx, doc])

  if (!project) {
    return (
      <div className="space-y-6">
        <SectionTitle title={meta_.name} desc="프로젝트 생성 시 에이전트가 초안을 만들고, 관리자가 주제별로 수정해 확정해요." />
        <EmptyState title="선택된 프로젝트가 없어요." desc={`프로젝트 목록에서 프로젝트를 열면 그 프로젝트의 ${meta_.name} 를 볼 수 있어요.`} />
      </div>
    )
  }

  const regenerate = async () => {
    if (doc && !window.confirm("현재 내용을 새 초안으로 덮어쓰고 버전을 올려요. 계속할까요?")) return
    setBusy(true); setError("")
    try { setDoc(await generateDoc(project.id, docType)); setEditingIdx(null) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const downloadMd = () => {
    if (!doc) return
    const blob = new Blob([doc.contentMd], { type: "text/markdown;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${meta_.name}-${doc.title}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const syncRules = async () => {
    setBusy(true); setError(""); setSyncNotice("")
    try {
      const r = await syncRulesToRepos(project.id)
      const ok = r.results.filter((x) => x.ok)
      const fail = r.results.filter((x) => !x.ok)
      setSyncNotice(
        `✅ ${ok.length}개 저장소에 CLAUDE.md 동기화 완료 (${r.docVersion})` +
        (fail.length ? ` · ⚠️ 실패 ${fail.length}: ${fail.map((f) => `${f.repo} — ${f.message ?? "오류"}`).join(", ")}` : ""),
      )
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const jumpTo = (i: number) => {
    setActive(i)
    document.getElementById(`doc-sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const startEdit = (i: number) => {
    setEditingIdx(i)
    setEditText(blocks[i].md)
  }

  const saveSection = async () => {
    if (!doc || editingIdx === null) return
    setBusy(true); setError("")
    try {
      const next = blocks.map((b, i) => (i === editingIdx ? { ...b, md: editText } : b))
      setDoc(await saveDoc(project.id, docType, { contentMd: joinDoc(next) }))
      setEditingIdx(null)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const saveMeta = async () => {
    setBusy(true); setError("")
    try {
      setDoc(await saveDoc(project.id, docType, meta))
      setMetaEditing(false)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`${meta_.name}: ${doc?.title ?? project.name}`}
        desc={docType === "rules"
          ? "이 프로젝트 전용 규칙이에요. 저장소로 동기화하면 조직 공통 규칙(조직 규칙·스킬 메뉴)과 병합되어 CLAUDE.md 로 푸시돼요."
          : "주제별로 각각 수정할 수 있어요. 저장할 때마다 문서 버전이 올라가고, 전체는 하나의 마크다운으로 내보낼 수 있어요."}
        action={doc ? (
          <div className="flex items-center gap-2">
            <Badge tone={SOURCE_BADGE[doc.source].tone}>{SOURCE_BADGE[doc.source].label}</Badge>
            {docType === "rules" && (
              <Button variant="primary" size="sm" onClick={syncRules} disabled={busy} icon={<Icon name="github" className="h-4 w-4" />}>{busy ? "동기화 중…" : "저장소로 동기화 (CLAUDE.md)"}</Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setHistoryOpen(true)} icon={<Icon name="list" className="h-4 w-4" />}>버전 이력</Button>
            <Button variant="secondary" size="sm" onClick={downloadMd} icon={<Icon name="download" className="h-4 w-4" />}>MD 다운로드</Button>
            <Button variant="secondary" size="sm" onClick={regenerate} disabled={busy} icon={<Icon name="sparkle" className="h-4 w-4" />}>{busy ? "생성 중…" : "다시 생성"}</Button>
          </div>
        ) : undefined}
      />

      {error && <div className="rounded-[12px] bg-error-light px-4 py-3 text-[13px] font-semibold text-error">{error}</div>}
      {syncNotice && <div className="rounded-[12px] bg-success-light px-4 py-3 text-[13px] font-semibold text-success">{syncNotice}</div>}

      {loading ? (
        <Card className="p-10 text-center text-[13px] text-text-tertiary">문서를 불러오는 중…</Card>
      ) : !doc ? (
        <EmptyState
          title={`${meta_.name} 문서가 아직 없어요.`}
          desc={`${meta_.genDesc} 서버에 ANTHROPIC_API_KEY(또는 OPENAI_API_KEY)가 있으면 에이전트가, 없으면 구조화된 템플릿이 초안을 작성해요.`}
          action={<Button variant="primary" onClick={regenerate} disabled={busy} icon={<Icon name="sparkle" className="h-4.5 w-4.5" />}>{busy ? "생성 중…" : `에이전트로 ${meta_.name} 생성`}</Button>}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[240px_1fr]">
          {/* 좌측 세부 메뉴 — 큰 주제(##) 목차, 클릭 시 해당 섹션으로 이동 */}
          <Card className="top-0 h-fit p-2 lg:sticky">
            <div className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-text-disabled">문서 목차</div>
            {blocks.map((b, i) => (
              <button key={i} onClick={() => jumpTo(i)}
                className={`block w-full truncate rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold ${active === i ? "bg-selected text-blue" : "text-text-secondary hover:bg-hover"}`}>
                {b.title}
              </button>
            ))}
            <div className="mt-2 border-t border-line px-3 py-2 text-[11px] leading-relaxed text-text-tertiary">
              섹션마다 <b>수정</b> 버튼으로 그 주제만 고칠 수 있어요.
            </div>
          </Card>

          <div className="min-w-0 space-y-4">
            {/* 문서 개요 표 + 정보 수정 */}
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="text-[12px] font-bold uppercase tracking-wide text-text-disabled">문서 정보</span>
                {metaEditing ? (
                  <div className="flex gap-1.5">
                    <Button variant="tertiary" size="sm" onClick={() => setMetaEditing(false)} disabled={busy}>취소</Button>
                    <Button variant="primary" size="sm" onClick={saveMeta} disabled={busy}>{busy ? "저장 중…" : "정보 저장"}</Button>
                  </div>
                ) : (
                  <Button variant="tertiary" size="sm" onClick={() => { setMeta({ title: doc.title, client: doc.client, author: doc.author }); setMetaEditing(true) }}>정보 수정</Button>
                )}
              </div>
              {metaEditing ? (
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  <MetaField label="문서 제목" value={meta.title} onChange={(v) => setMeta({ ...meta, title: v })} />
                  <MetaField label="의뢰사" value={meta.client} onChange={(v) => setMeta({ ...meta, client: v })} />
                  <MetaField label="작성자" value={meta.author} onChange={(v) => setMeta({ ...meta, author: v })} />
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <tbody>
                    {[
                      ["의뢰사", doc.client],
                      ["작성자", doc.author],
                      ["최초 작성일", doc.createdDate],
                      ["최종 수정일", doc.updatedDate],
                      ["문서 버전", doc.docVersion],
                    ].map(([k, v]) => (
                      <tr key={k} className="border-b border-line last:border-0">
                        <td className="w-40 bg-surface-2 px-4 py-2.5 font-bold text-text-secondary">{k}</td>
                        <td className="px-4 py-2.5 text-text-primary">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* 섹션 카드 — 주제별 개별 수정 */}
            {blocks.map((b, i) => (
              <div key={`${i}-${b.title}`} id={`doc-sec-${i}`} data-idx={i} className="scroll-mt-4">
              <Card className="relative p-6">
                {editingIdx === i ? (
                  <div className="space-y-3">
                    <div className="text-[12px] font-bold text-text-secondary">"{b.title}" 수정 중 — 마크다운으로 편집해요.</div>
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)}
                      className="h-[45vh] w-full resize-y rounded-[10px] border border-line p-4 font-mono text-[13px] leading-relaxed" spellCheck={false} autoFocus />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditingIdx(null)} disabled={busy}>취소</Button>
                      <Button variant="primary" size="sm" onClick={saveSection} disabled={busy}>{busy ? "저장 중…" : "섹션 저장 (버전 올림)"}</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute right-4 top-4">
                      <Button variant="tertiary" size="sm" onClick={() => startEdit(i)} icon={<Icon name="doc" className="h-3.5 w-3.5" />}>수정</Button>
                    </div>
                    <div className="pr-20"><Markdown text={b.md} /></div>
                  </>
                )}
              </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {historyOpen && doc && (
        <DocHistoryModal
          project={project}
          docType={docType}
          current={doc}
          onClose={() => setHistoryOpen(false)}
          onRestored={(d) => { setDoc(d); setEditingIdx(null); setHistoryOpen(false) }}
        />
      )}
    </div>
  )
}

// ===== 버전 이력 모달 — 리비전 목록 + 선택 리비전 → 현재 문서 diff =====

const REV_NOTE_TONE: Record<ProjectDoc["source"], "purple" | "neutral" | "blue"> = { agent: "purple", template: "neutral", human: "blue" }

function DocHistoryModal({ project, docType, current, onClose, onRestored }: {
  project: ProjectItem
  docType: DocType
  current: ProjectDoc
  onClose: () => void
  onRestored: (d: ProjectDoc) => void
}) {
  const [revs, setRevs] = useState<DocRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [selSeq, setSelSeq] = useState<number | null>(null)
  const [selContent, setSelContent] = useState<string | null>(null)
  const [mode, setMode] = useState<"diff" | "raw">("diff")

  useEffect(() => {
    let alive = true
    listDocRevisions(project.id, docType)
      .then((rs) => {
        if (!alive) return
        setRevs(rs)
        // 평가 기본값: 가장 오래된 초안(에이전트/템플릿) — 초안 대비 무엇이 바뀌었는지 바로 보여요.
        const base = [...rs].reverse().find((r) => r.source !== "human") ?? rs[rs.length - 1]
        if (base) setSelSeq(base.seq)
      })
      .catch((e) => { if (alive) setError((e as Error).message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [project.id, docType])

  useEffect(() => {
    if (selSeq == null) return
    let alive = true
    setSelContent(null)
    getDocRevision(project.id, docType, selSeq)
      .then((r) => { if (alive) setSelContent(r.contentMd ?? "") })
      .catch((e) => { if (alive) setError((e as Error).message) })
    return () => { alive = false }
  }, [project.id, docType, selSeq])

  const sel = revs.find((r) => r.seq === selSeq) ?? null
  const ops = useMemo(() => (selContent != null ? diffLines(selContent, current.contentMd) : null), [selContent, current.contentMd])
  const added = ops?.filter((o) => o.type === "add").length ?? 0
  const removed = ops?.filter((o) => o.type === "del").length ?? 0
  const identical = ops != null && added === 0 && removed === 0

  const restore = async () => {
    if (!sel || !window.confirm(`${sel.docVersion} (${sel.note}) 내용으로 되돌릴까요? 새 버전으로 저장되고 이 행동도 이력에 남아요.`)) return
    setBusy(true); setError("")
    try { onRestored(await restoreDocRevision(project.id, docType, sel.seq)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="af-overlay absolute inset-0 bg-[#191f28]/30" onClick={onClose} />
      <div className="af-fade relative flex h-[86vh] w-full max-w-[1100px] flex-col rounded-[20px] bg-surface shadow-[var(--shadow-modal)]">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-[17px] font-bold text-text-primary">버전 이력 · {current.title}</h2>
            <p className="text-[12px] text-text-tertiary">리비전을 고르면 그 시점과 현재 문서({current.docVersion})의 차이를 보여줘요 — 에이전트 초안 대비 무엇이 바뀌었는지로 산출물을 평가할 수 있어요.</p>
          </div>
          <IconButton label="닫기" onClick={onClose}><Icon name="close" /></IconButton>
        </div>

        {error && <div className="border-b border-line bg-error-light px-6 py-2 text-[12px] font-semibold text-error">{error}</div>}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_1fr]">
          {/* 리비전 목록 */}
          <div className="overflow-y-auto border-r border-line p-3">
            {loading ? (
              <div className="p-4 text-[13px] text-text-tertiary">이력을 불러오는 중…</div>
            ) : (
              revs.map((r) => (
                <button key={r.seq} onClick={() => setSelSeq(r.seq)}
                  className={`mb-1 block w-full rounded-[12px] px-3 py-2.5 text-left ${selSeq === r.seq ? "bg-selected" : "hover:bg-hover"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-[12px] font-bold ${selSeq === r.seq ? "text-blue" : "text-text-primary"}`}>{r.docVersion}</span>
                    <Badge tone={REV_NOTE_TONE[r.source]}>{SOURCE_BADGE[r.source].label}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-text-secondary">{r.note}</div>
                  <div className="mt-0.5 text-[11px] text-text-tertiary">{new Date(r.at).toLocaleString("ko-KR")} · {r.length.toLocaleString()}자</div>
                </button>
              ))
            )}
          </div>

          {/* 비교 뷰 */}
          <div className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <span className="text-[12px] font-bold text-text-secondary">{sel ? `${sel.docVersion} → 현재(${current.docVersion})` : "리비전을 선택하세요"}</span>
              {ops && (identical
                ? <Badge tone="neutral">현재 문서와 동일</Badge>
                : <span className="flex items-center gap-1.5 font-mono text-[12px] font-bold"><span className="text-success">+{added}줄</span><span className="text-error">−{removed}줄</span></span>)}
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant={mode === "diff" ? "primary" : "secondary"} size="sm" onClick={() => setMode("diff")}>변경 비교</Button>
                <Button variant={mode === "raw" ? "primary" : "secondary"} size="sm" onClick={() => setMode("raw")}>이 버전 전문</Button>
                {sel && !identical && <Button variant="secondary" size="sm" onClick={restore} disabled={busy}>{busy ? "되돌리는 중…" : "이 버전으로 되돌리기"}</Button>}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {selContent == null ? (
                <div className="text-[13px] text-text-tertiary">내용을 불러오는 중…</div>
              ) : mode === "raw" ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-text-primary">{selContent}</pre>
              ) : ops && (
                identical
                  ? <div className="text-[13px] text-text-tertiary">이 리비전은 현재 문서와 내용이 같아요.</div>
                  : <DiffView ops={ops} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// diff 렌더 — 동일 구간이 길면 접어서 변경 부분에 집중해요.
function DiffView({ ops }: { ops: DiffOp[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const rows: ReactNode[] = []
  const line = (o: DiffOp, key: number) => (
    <div key={key} className={`flex ${o.type === "add" ? "bg-success-light" : o.type === "del" ? "bg-error-light" : ""}`}>
      <span className={`w-6 shrink-0 select-none text-center font-bold ${o.type === "add" ? "text-success" : o.type === "del" ? "text-error" : "text-text-disabled"}`}>
        {o.type === "add" ? "+" : o.type === "del" ? "−" : ""}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{o.text || " "}</span>
    </div>
  )
  let i = 0
  let key = 0
  while (i < ops.length) {
    if (ops[i].type === "same") {
      let j = i
      while (j < ops.length && ops[j].type === "same") j++
      const run = ops.slice(i, j)
      const runStart = i
      if (run.length > 8 && !expanded.has(runStart)) {
        run.slice(0, 3).forEach((o) => rows.push(line(o, key++)))
        rows.push(
          <button key={key++} onClick={() => setExpanded((s) => new Set(s).add(runStart))}
            className="my-1 block w-full rounded-[8px] bg-surface-2 py-1 text-center text-[11px] font-semibold text-text-tertiary hover:bg-hover">
            ⋯ 동일한 {run.length - 6}줄 펼치기
          </button>,
        )
        run.slice(-3).forEach((o) => rows.push(line(o, key++)))
      } else {
        run.forEach((o) => rows.push(line(o, key++)))
      }
      i = j
    } else {
      rows.push(line(ops[i], key++))
      i++
    }
  }
  return <div className="font-mono text-[12px] leading-relaxed text-text-primary">{rows}</div>
}

function MetaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-text-secondary">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-[10px] border border-line px-3 py-2 text-[14px]" />
    </label>
  )
}

// ===== 마크다운 렌더러 (생성기가 내는 부분집합: 제목·표·목록·코드펜스·문단) =====

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong>
        : p.startsWith("`") ? <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px]">{p.slice(1, -1)}</code>
        : <span key={i}>{p}</span>,
      )}
    </>
  )
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const out: ReactNode[] = []
  let i = 0, key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith("```")) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++ }
      i++
      out.push(<pre key={key++} className="my-3 overflow-x-auto rounded-[12px] bg-surface-2 p-4 font-mono text-[12px] leading-relaxed">{buf.join("\n")}</pre>)
      continue
    }

    if (line.startsWith("|")) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith("|")) {
        const cells = lines[i].slice(1, lines[i].endsWith("|") ? -1 : undefined).split("|").map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      out.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr>{head?.map((c, j) => <th key={j} className="border border-line bg-surface-2 px-3 py-2 text-left font-bold text-text-secondary"><Inline text={c} /></th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border border-line px-3 py-2 text-text-primary"><Inline text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const cls = level === 1 ? "mt-1 text-[22px] font-bold" : level === 2 ? "text-[17px] font-bold" : "mt-4 text-[14px] font-bold"
      out.push(<div key={key++} className={`${cls} text-text-primary`}><Inline text={heading[2]} /></div>)
      i++
      continue
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line)
      const items: string[] = []
      while (i < lines.length && (ordered ? /^\d+\.\s+/.test(lines[i]) : /^[-*]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^([-*]|\d+\.)\s+/, ""))
        i++
      }
      const cls = "my-2 space-y-1 pl-5 text-[13px] leading-relaxed text-text-primary"
      out.push(ordered
        ? <ol key={key++} className={`${cls} list-decimal`}>{items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ol>
        : <ul key={key++} className={`${cls} list-disc`}>{items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>)
      continue
    }

    if (line.trim() !== "") {
      out.push(<p key={key++} className="my-2 text-[13px] leading-relaxed text-text-primary"><Inline text={line} /></p>)
    }
    i++
  }

  return <div>{out}</div>
}
