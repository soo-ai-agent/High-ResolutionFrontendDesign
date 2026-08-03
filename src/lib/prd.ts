// PRD 클라이언트 — 서버 DB의 프로젝트별 PRD 를 조회/생성/수정해요(영속).
export type Prd = {
  projectId: string
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

export type PrdPatch = Partial<Pick<Prd, "title" | "client" | "author" | "contentMd">>

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } })
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`
    try {
      const b = await res.json()
      if (b?.error) msg = b.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export async function getPrd(projectId: string): Promise<Prd | null> {
  const res = await fetch(`/api/mirror/projects/${projectId}/prd`, { headers: { Accept: "application/json" } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
  return (await res.json()) as Prd
}

export const generatePrd = (projectId: string) =>
  j<Prd>(`/api/mirror/projects/${projectId}/prd/generate`, { method: "POST" })

export const savePrd = (projectId: string, patch: PrdPatch) =>
  j<Prd>(`/api/mirror/projects/${projectId}/prd`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
