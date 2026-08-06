import { useEffect, useState } from "react"
import { Icon, Badge, Button, Card, SectionTitle } from "../components/ui"
import { listOrgAssets, createOrgAsset, updateOrgAsset, deleteOrgAsset, syncOrgToRepos, type OrgAsset } from "../lib/org"

// 조직 규칙·스킬 — 프로젝트 밖에서 관리하는 공통 자산이에요.
// 동기화하면 모든 프로젝트 저장소의 CLAUDE.md(조직+프로젝트 병합)와 .claude/skills/ 로 푸시돼요.
export default function OrgScreen() {
  const [assets, setAssets] = useState<OrgAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  // 규칙 편집
  const [rulesDraft, setRulesDraft] = useState<string | null>(null)
  // 스킬 추가·편집
  const [skillName, setSkillName] = useState("")
  const [skillContent, setSkillContent] = useState("")
  const [editId, setEditId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState("")

  const rules = assets.find((a) => a.kind === "rules") ?? null
  const skills = assets.filter((a) => a.kind === "skill")

  const load = () => listOrgAssets().then(setAssets)
  useEffect(() => {
    load().catch((e) => setError((e as Error).message)).finally(() => setLoading(false))
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("")
    try { await fn() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const createRules = () => run(async () => { await createOrgAsset("rules", "조직 공통 코드 규칙"); await load() })
  const saveRules = () => run(async () => {
    if (!rules || rulesDraft == null) return
    await updateOrgAsset(rules.id, { contentMd: rulesDraft })
    setRulesDraft(null)
    await load()
    setNotice("✅ 조직 공통 규칙을 저장했어요 — '전체 동기화'를 눌러 저장소에 반영하세요.")
  })
  const addSkill = () => run(async () => {
    if (!skillName.trim()) return
    await createOrgAsset("skill", skillName, skillContent)
    setSkillName(""); setSkillContent("")
    await load()
  })
  const saveSkill = () => run(async () => {
    if (editId == null) return
    await updateOrgAsset(editId, { contentMd: editContent })
    setEditId(null)
    await load()
  })
  const removeSkill = (id: number) => run(async () => { await deleteOrgAsset(id); await load() })
  const syncAll = () => run(async () => {
    const r = await syncOrgToRepos()
    const ok = r.results.filter((x) => x.ok).length
    const fail = r.results.filter((x) => !x.ok)
    setNotice(`✅ ${ok}개 저장소 동기화 완료 (스킬 ${r.skills}개 포함)` +
      (fail.length ? ` · ⚠️ 실패 ${fail.length}: ${fail.map((f) => `${f.repo} — ${f.message ?? "오류"}`).join(", ")}` : ""))
  })

  return (
    <div className="space-y-6">
      <SectionTitle title="조직 규칙·스킬" desc="여러 프로젝트가 공유하는 코드 작성 규칙과 에이전트 스킬을 프로젝트 밖에서 관리해요. 동기화하면 모든 프로젝트 저장소의 CLAUDE.md(조직+프로젝트 병합)와 .claude/skills/ 로 푸시돼요."
        action={<Button variant="primary" size="sm" onClick={syncAll} disabled={busy || (!rules && skills.length === 0)} icon={<Icon name="github" className="h-4 w-4" />}>{busy ? "동기화 중…" : "모든 프로젝트 저장소에 동기화"}</Button>} />

      {error && <div className="rounded-[12px] bg-error-light px-4 py-3 text-[13px] font-semibold text-error">{error}</div>}
      {notice && <div className="rounded-[12px] bg-success-light px-4 py-3 text-[13px] font-semibold text-success">{notice}</div>}

      {loading ? (
        <Card className="p-10 text-center text-[13px] text-text-tertiary">불러오는 중…</Card>
      ) : (
        <>
          {/* 공통 코드 규칙 */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-light text-blue"><Icon name="critic" className="h-4.5 w-4.5" /></span>
              <div>
                <div className="flex items-center gap-2"><span className="text-[15px] font-bold text-text-primary">조직 공통 코드 규칙</span>{rules && <Badge tone="blue">{rules.docVersion}</Badge>}</div>
                <div className="text-[12px] text-text-tertiary">모든 프로젝트의 CLAUDE.md 맨 앞에 병합돼요 — 프로젝트 규칙은 그 뒤에 붙어요.</div>
              </div>
              <div className="ml-auto flex gap-1.5">
                {rules && rulesDraft == null && <Button variant="secondary" size="sm" onClick={() => setRulesDraft(rules.contentMd)}>수정</Button>}
                {rules && rulesDraft != null && (
                  <>
                    <Button variant="tertiary" size="sm" onClick={() => setRulesDraft(null)} disabled={busy}>취소</Button>
                    <Button variant="primary" size="sm" onClick={saveRules} disabled={busy}>{busy ? "저장 중…" : "저장 (버전 올림)"}</Button>
                  </>
                )}
              </div>
            </div>
            {!rules ? (
              <div className="mt-4 flex items-center justify-between rounded-[12px] border border-dashed border-line px-4 py-3">
                <span className="text-[13px] text-text-secondary">아직 조직 공통 규칙이 없어요 — 기본 템플릿으로 시작해 수정하세요.</span>
                <Button variant="primary" size="sm" onClick={createRules} disabled={busy} icon={<Icon name="plus" className="h-4 w-4" />}>기본 템플릿으로 만들기</Button>
              </div>
            ) : rulesDraft != null ? (
              <textarea value={rulesDraft} onChange={(e) => setRulesDraft(e.target.value)} spellCheck={false}
                className="mt-4 h-[40vh] w-full resize-y rounded-[12px] border border-line p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-blue" />
            ) : (
              <pre className="mt-4 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-text-secondary">{rules.contentMd}</pre>
            )}
          </Card>

          {/* 에이전트 스킬 */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-purple-light text-purple"><Icon name="sparkle" className="h-4.5 w-4.5" /></span>
              <div>
                <div className="text-[15px] font-bold text-text-primary">에이전트 스킬 <span className="text-[12px] font-semibold text-text-tertiary">{skills.length}개</span></div>
                <div className="text-[12px] text-text-tertiary">재사용 지시 모음 — 각 저장소의 <code className="font-mono">.claude/skills/&lt;이름&gt;/SKILL.md</code> 로 푸시돼 코딩 에이전트가 쓸 수 있어요.</div>
              </div>
            </div>

            {skills.length > 0 && (
              <div className="mt-3 divide-y divide-line">
                {skills.map((s) => (
                  <div key={s.id} className="py-2">
                    <div className="group flex items-center gap-2">
                      <Badge tone="purple">{s.docVersion}</Badge>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{s.name}</span>
                      {editId === s.id ? (
                        <>
                          <Button variant="tertiary" size="sm" onClick={() => setEditId(null)} disabled={busy}>취소</Button>
                          <Button variant="primary" size="sm" onClick={saveSkill} disabled={busy}>저장</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="tertiary" size="sm" onClick={() => { setEditId(s.id); setEditContent(s.contentMd) }}>수정</Button>
                          <button onClick={() => removeSkill(s.id)} className="rounded-[6px] p-1 text-text-disabled opacity-0 hover:bg-error-light hover:text-error group-hover:opacity-100" aria-label="삭제">
                            <Icon name="close" className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    {editId === s.id && (
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} spellCheck={false}
                        className="mt-2 h-40 w-full resize-y rounded-[10px] border border-line p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-blue" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 스킬 추가 */}
            <div className="mt-3 space-y-2 rounded-[12px] border border-dashed border-line p-3">
              <input value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="스킬 이름 (예: PR 설명 작성법)"
                className="h-9 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] outline-none focus:border-blue" />
              <textarea value={skillContent} onChange={(e) => setSkillContent(e.target.value)} spellCheck={false}
                placeholder="스킬 내용 (마크다운) — 에이전트에게 줄 재사용 지시를 적어요"
                className="h-24 w-full resize-y rounded-[10px] border border-line bg-surface p-3 font-mono text-[12px] outline-none focus:border-blue" />
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={addSkill} disabled={busy || !skillName.trim()} icon={<Icon name="plus" className="h-3.5 w-3.5" />}>스킬 추가</Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
