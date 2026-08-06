// 조직 공통 자산 클라이언트 — 코드 규칙(1개)·에이전트 스킬(여러 개)을 프로젝트 밖에서 관리해요.
export type OrgAsset = {
  id: number
  kind: "rules" | "skill"
  name: string
  contentMd: string
  docVersion: string
  updatedAt: string
}

export type OrgSyncResult = {
  results: { repo: string; ok: boolean; url: string | null; message: string | null }[]
  skills: number
}

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

export const listOrgAssets = () => j<OrgAsset[]>("/api/org/assets")

export const createOrgAsset = (kind: "rules" | "skill", name: string, contentMd = "") =>
  j<OrgAsset>("/api/org/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, name, contentMd }),
  })

export const updateOrgAsset = (id: number, patch: { name?: string; contentMd?: string }) =>
  j<OrgAsset>(`/api/org/assets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })

export const deleteOrgAsset = (id: number) =>
  j<{ ok: boolean }>(`/api/org/assets/${id}`, { method: "DELETE" })

export const syncOrgToRepos = () =>
  j<OrgSyncResult>("/api/org/sync-repos", { method: "POST" })
