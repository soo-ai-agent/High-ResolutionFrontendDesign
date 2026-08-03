import { useEffect, useState, type ReactNode } from "react"
import { Icon, Button, Badge, Card, SectionTitle, EmptyState } from "../components/ui"
import type { ProjectItem } from "../data"
import { getPrd, generatePrd, savePrd, type Prd } from "../lib/prd"

const SOURCE_BADGE: Record<Prd["source"], { label: string; tone: "purple" | "neutral" | "blue" }> = {
  agent: { label: "에이전트 초안", tone: "purple" },
  template: { label: "템플릿 초안", tone: "neutral" },
  human: { label: "사람 수정됨", tone: "blue" },
}

export default function PrdScreen({ project }: { project: ProjectItem | null }) {
  const [prd, setPrd] = useState<Prd | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState({ title: "", client: "", author: "", contentMd: "" })

  useEffect(() => {
    if (!project) return
    let alive = true
    setLoading(true)
    getPrd(project.id)
      .then((p) => { if (alive) setPrd(p) })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [project])

  if (!project) {
    return (
      <div className="space-y-6">
        <SectionTitle title="PRD" desc="프로젝트 생성 시 에이전트가 초안을 만들고, 관리자가 수정해 확정해요." />
        <EmptyState title="선택된 프로젝트가 없어요." desc="프로젝트 목록에서 프로젝트를 열면 그 프로젝트의 PRD 를 볼 수 있어요." />
      </div>
    )
  }

  const regenerate = async () => {
    if (prd && !window.confirm("현재 내용을 새 초안으로 덮어쓰고 버전을 올려요. 계속할까요?")) return
    setBusy(true); setError("")
    try { setPrd(await generatePrd(project.id)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const startEdit = () => {
    if (!prd) return
    setDraft({ title: prd.title, client: prd.client, author: prd.author, contentMd: prd.contentMd })
    setEditing(true)
  }

  const save = async () => {
    setBusy(true); setError("")
    try {
      setPrd(await savePrd(project.id, draft))
      setEditing(false)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title={`PRD: ${prd?.title ?? project.name}`}
        desc="프로젝트 생성 시 에이전트가 초안을 만들고, 관리자가 수정해 확정해요. 모든 변경은 서버 DB에 저장돼요."
        action={prd && !editing ? (
          <div className="flex items-center gap-2">
            <Badge tone={SOURCE_BADGE[prd.source].tone}>{SOURCE_BADGE[prd.source].label}</Badge>
            <Button variant="secondary" onClick={regenerate} disabled={busy} icon={<Icon name="sparkle" className="h-4 w-4" />}>{busy ? "생성 중…" : "다시 생성"}</Button>
            <Button variant="primary" onClick={startEdit} icon={<Icon name="doc" className="h-4 w-4" />}>수정</Button>
          </div>
        ) : undefined}
      />

      {error && <div className="rounded-[12px] bg-error-light px-4 py-3 text-[13px] font-semibold text-error">{error}</div>}

      {loading ? (
        <Card className="p-10 text-center text-[13px] text-text-tertiary">PRD 를 불러오는 중…</Card>
      ) : !prd ? (
        <EmptyState
          title="PRD 가 아직 없어요."
          desc="프로젝트 정보(이름·설명·저장소 구성)를 바탕으로 에이전트가 초안을 만들어요. 서버에 ANTHROPIC_API_KEY 가 있으면 Claude 가, 없으면 구조화된 템플릿이 초안을 작성해요."
          action={<Button variant="primary" onClick={regenerate} disabled={busy} icon={<Icon name="sparkle" className="h-4.5 w-4.5" />}>{busy ? "생성 중…" : "에이전트로 PRD 생성"}</Button>}
        />
      ) : editing ? (
        <Card className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="문서 제목"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full rounded-[10px] border border-line px-3 py-2 text-[14px]" /></Field>
            <Field label="의뢰사"><input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} className="w-full rounded-[10px] border border-line px-3 py-2 text-[14px]" /></Field>
            <Field label="작성자"><input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className="w-full rounded-[10px] border border-line px-3 py-2 text-[14px]" /></Field>
          </div>
          <Field label="본문 (마크다운)">
            <textarea value={draft.contentMd} onChange={(e) => setDraft({ ...draft, contentMd: e.target.value })}
              className="h-[60vh] w-full resize-y rounded-[10px] border border-line p-4 font-mono text-[13px] leading-relaxed" spellCheck={false} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>취소</Button>
            <Button variant="primary" onClick={save} disabled={busy}>{busy ? "저장 중…" : `저장 (버전 올림)`}</Button>
          </div>
        </Card>
      ) : (
        <>
          {/* 문서 개요 — 항목/내용 표 */}
          <Card className="overflow-hidden">
            <table className="w-full text-[13px]">
              <tbody>
                {[
                  ["의뢰사", prd.client],
                  ["작성자", prd.author],
                  ["최초 작성일", prd.createdDate],
                  ["최종 수정일", prd.updatedDate],
                  ["문서 버전", prd.docVersion],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="w-40 bg-surface-2 px-4 py-2.5 font-bold text-text-secondary">{k}</td>
                    <td className="px-4 py-2.5 text-text-primary">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-8">
            <Markdown text={prd.contentMd} />
          </Card>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-text-secondary">{label}</span>
      {children}
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
      const cls = level === 1 ? "mt-2 text-[22px] font-bold" : level === 2 ? "mt-6 text-[17px] font-bold" : "mt-4 text-[14px] font-bold"
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
