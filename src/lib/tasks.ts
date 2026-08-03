// 작업(태스크) 클라이언트 — 서버 DB의 프로젝트별 작업을 조회/생성/수정/이슈 동기화해요(영속).
export type Task = {
  id: string
  projectId: string
  seq: number
  code: string
  title: string
  detail: string
  domain: string
  phase: string
  repo: string
  owner: "ai" | "human" | "auto"
  priority: string
  estimate: string
  status: string
  issueNumber: number | null
  issueUrl: string | null
  source: "agent" | "template" | "human"
  updatedAt: string
}

export type TaskPatch = Partial<Pick<Task, "title" | "detail" | "domain" | "phase" | "repo" | "owner" | "priority" | "estimate" | "status">>

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

export const listTasks = (projectId: string) => j<Task[]>(`/api/mirror/projects/${projectId}/tasks`)

export const generateTasks = (projectId: string) =>
  j<Task[]>(`/api/mirror/projects/${projectId}/tasks/generate`, { method: "POST" })

export const patchTask = (projectId: string, taskId: string, patch: TaskPatch) =>
  j<Task>(`/api/mirror/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })

export const deleteTask = (projectId: string, taskId: string) =>
  j<{ ok: boolean }>(`/api/mirror/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" })

export const syncTaskIssue = (projectId: string, taskId: string) =>
  j<Task>(`/api/mirror/projects/${projectId}/tasks/${taskId}/sync-issue`, { method: "POST" })
