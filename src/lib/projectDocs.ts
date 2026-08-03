// 프로젝트 문서(PRD·IA) 클라이언트 — 서버 DB의 문서를 조회/생성/수정해요(영속).
export type DocType = "prd" | "ia"

export type ProjectDoc = {
  projectId: string
  docType: DocType
  title: string
  client: string
  author: string
  docVersion: string
  createdDate: string
  updatedDate: string
  source: "agent" | "template" | "human"
  contentMd: string
  updatedAt: string
}

export type DocPatch = Partial<Pick<ProjectDoc, "title" | "client" | "author" | "contentMd">>

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } })
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`
    try {
      const b = await res.json()
      if (b?.message) msg = b.message
      else if (b?.error) msg = b.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export async function getDoc(projectId: string, type: DocType): Promise<ProjectDoc | null> {
  const res = await fetch(`/api/mirror/projects/${projectId}/docs/${type}`, { headers: { Accept: "application/json" } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
  return (await res.json()) as ProjectDoc
}

export const generateDoc = (projectId: string, type: DocType) =>
  j<ProjectDoc>(`/api/mirror/projects/${projectId}/docs/${type}/generate`, { method: "POST" })

export const saveDoc = (projectId: string, type: DocType, patch: DocPatch) =>
  j<ProjectDoc>(`/api/mirror/projects/${projectId}/docs/${type}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })

// ---- 버전 이력 — 생성·수정 때마다 전문이 남아, 에이전트 초안과 현재 문서를 비교(diff)해요 ----
export type DocRevision = {
  seq: number
  docVersion: string
  source: ProjectDoc["source"]
  author: string
  note: string
  at: string
  length: number
  contentMd: string | null // 목록에서는 null, 단건 조회에서만 전문
}

export const listDocRevisions = (projectId: string, type: DocType) =>
  j<DocRevision[]>(`/api/mirror/projects/${projectId}/docs/${type}/revisions`)

export const getDocRevision = (projectId: string, type: DocType, seq: number) =>
  j<DocRevision>(`/api/mirror/projects/${projectId}/docs/${type}/revisions/${seq}`)

export const restoreDocRevision = (projectId: string, type: DocType, seq: number) =>
  j<ProjectDoc>(`/api/mirror/projects/${projectId}/docs/${type}/revisions/${seq}/restore`, { method: "POST" })

// ===== 섹션 분리/결합 =====
// 문서 원천은 하나의 마크다운. 화면에서는 `## ` 큰 주제 단위로 쪼개 각각 수정하고,
// 저장할 때 다시 하나로 합쳐요. 코드 펜스(```) 안의 ## 은 경계로 치지 않아요.

export type DocBlock = {
  title: string // 목차에 보일 제목 (## 뒤 텍스트, 머리 블록은 "개요")
  md: string // 블록 원문 (## 제목 줄 포함)
  isHeader: boolean // 첫 ## 이전의 머리 블록(# 제목·도입부) 여부
}

export function splitDoc(md: string): DocBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const blocks: DocBlock[] = []
  let cur: string[] = []
  let curTitle = "개요"
  let curHeader = true
  let inFence = false
  const flush = () => {
    if (cur.some((l) => l.trim() !== "")) blocks.push({ title: curTitle, md: cur.join("\n").trimEnd(), isHeader: curHeader })
    cur = []
  }
  for (const line of lines) {
    if (line.startsWith("```")) inFence = !inFence
    const m = inFence ? null : /^##(?!#)\s+(.+)$/.exec(line)
    if (m) {
      flush()
      curTitle = m[1].trim()
      curHeader = false
    }
    cur.push(line)
  }
  flush()
  return blocks
}

export const joinDoc = (blocks: DocBlock[]): string => blocks.map((b) => b.md.trimEnd()).join("\n\n") + "\n"
