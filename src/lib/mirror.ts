// DB 미러 읽기/관리 확장 클라이언트.
// GitHub → 웹훅 → 서버 DB 미러를 UI가 읽어와요. stage·priority 는 어드민 확장 필드로,
// GitHub 로는 반영되지 않아요(서버 PATCH 만).

export type MirrorSummary = { repos: number; issues: number; pulls: number; runs: number; events: number; updatedAt: string | null }
export type MirrorIssue = { repo: string; number: number; title: string; state: string; labels: string[]; user: string | null; html_url: string; updated_at: string; stage: string | null; priority: string | null; mapping: unknown; boardStatus?: string | null }
export type MirrorPull = { repo: string; number: number; title: string; state: string; merged: boolean; draft: boolean; user: string | null; html_url: string; updated_at: string; boardStatus?: string | null }
export type MirrorRun = { repo: string; id: number; name: string; status: string; conclusion: string | null; head_branch: string; html_url: string; updated_at: string }
export type MirrorEvent = { id: string | null; event: string; action: string | null; repo: string | null; at: string; verified: boolean; summary: string }

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

export const getSummary = () => j<MirrorSummary>("/api/mirror/summary")
export const listIssues = (repo?: string) => j<MirrorIssue[]>("/api/mirror/issues" + (repo ? `?repo=${encodeURIComponent(repo)}` : ""))
export const listPulls = (repo?: string) => j<MirrorPull[]>("/api/mirror/pulls" + (repo ? `?repo=${encodeURIComponent(repo)}` : ""))
export const listRuns = (repo?: string) => j<MirrorRun[]>("/api/mirror/runs" + (repo ? `?repo=${encodeURIComponent(repo)}` : ""))
export const listEvents = (repo?: string) => j<MirrorEvent[]>("/api/mirror/events" + (repo ? `?repo=${encodeURIComponent(repo)}` : ""))

export const setIssueAdmin = (repo: string, number: number, fields: { stage?: string | null; priority?: string | null }) =>
  j<MirrorIssue>("/api/mirror/issues", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo, number, ...fields }) })
