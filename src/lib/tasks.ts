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

// 원클릭 에이전트 착수 — 이슈 생성(없으면) + @claude 착수 코멘트 + 진행 중 전환
export const kickoffTask = (projectId: string, taskId: string) =>
  j<Task>(`/api/mirror/projects/${projectId}/tasks/${taskId}/kickoff`, { method: "POST" })

// ---- 자동 디스패치 — 단계 순서·우선순위 기반, 동시 실행 제한 안에서 ai 작업 자동 착수 ----
export type DispatchStatus = {
  enabled: boolean
  limit: number
  activePhase: string | null
  active: number
  waiting: number
  started: Task[]
  message: string | null
  boardAutoStart: boolean
  reviewLoop: boolean
  reviewRoundLimit: number
  ciRecovery: boolean
}

export const getDispatch = (projectId: string) =>
  j<DispatchStatus>(`/api/mirror/projects/${projectId}/dispatch`)

export const setDispatch = (projectId: string, cfg: { enabled?: boolean; limit?: number; boardAutoStart?: boolean; reviewLoop?: boolean; reviewRoundLimit?: number; ciRecovery?: boolean }) =>
  j<DispatchStatus>(`/api/mirror/projects/${projectId}/dispatch`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  })

export const runDispatchNow = (projectId: string) =>
  j<DispatchStatus>(`/api/mirror/projects/${projectId}/dispatch/run`, { method: "POST" })

// ---- CI 실패 자동 회복 — 상태(마지막 스윕) 조회 + 수동 스윕 ----
export type CiRecoveryStatus = { enabled: boolean; lastAt: string | null; notified: number; pending: number; message: string | null }
export const getCiRecoveryStatus = (projectId: string) =>
  j<CiRecoveryStatus>(`/api/mirror/projects/${projectId}/ci-recovery/status`)
export const runCiRecovery = (projectId: string) =>
  j<{ notified: { taskCode: string; prNumber: number | null }[]; pending: number; message: string | null }>(
    `/api/mirror/projects/${projectId}/ci-recovery/run`, { method: "POST" },
  )

// ---- 검토 대기 큐 — 사람 승인을 기다리는 작업 (헤더 배지) ----
export type ReviewQueue = { count: number; items: { projectId: string; projectName: string; taskId: string; code: string; title: string; updatedAt: string }[] }
export const getReviewQueue = () => j<ReviewQueue>("/api/mirror/review-queue")

// ---- 에이전트 활동 피드 — 작업 활동 + Actions 실행 + 웹훅 이벤트 통합 타임라인 ----
export type ProjectActivity = {
  at: string
  type: "task" | "run" | "event"
  kind: string
  title: string
  note: string
  url: string | null
}

export const getProjectActivity = (projectId: string, limit = 50) =>
  j<ProjectActivity[]>(`/api/mirror/projects/${projectId}/activity?limit=${limit}`)

// ---- 진행 간트 — 활동 이력 기반 실적 타임라인 (생성·착수·완료 실제 시각) ----
export type GanttRow = {
  code: string
  title: string
  phase: string
  owner: "ai" | "human" | "auto"
  status: string
  createdAt: string | null
  startedAt: string | null
  endedAt: string | null
}

export const getProjectGantt = (projectId: string) =>
  j<GanttRow[]>(`/api/mirror/projects/${projectId}/gantt`)

// ---- Actions 실행 내역 — 실행이 있을 때마다 웹훅으로 미러에 잡혀 여기로 내려와요 ----
export type ActionRun = {
  repo: string
  id: number
  name: string | null
  status: string | null
  conclusion: string | null
  head_branch: string | null
  html_url: string | null
  updated_at: string | null
}

export const getProjectRuns = (projectId: string, limit = 10) =>
  j<ActionRun[]>(`/api/mirror/projects/${projectId}/runs?limit=${limit}`)

// ---- 외부 워크플로 실행 (workflow_dispatch) — 결과는 웹훅으로 미러·피드에 돌아와요 ----
export type RepoWorkflows = {
  repo: string
  repoName: string
  workflows: { id: number; name: string; path: string; state: string }[]
}

export const listProjectWorkflows = (projectId: string) =>
  j<RepoWorkflows[]>(`/api/mirror/projects/${projectId}/workflows`)

export const dispatchProjectWorkflow = (projectId: string, repo: string, workflowId: number, ref?: string) =>
  j<{ ok: boolean; ref: string; message: string }>(`/api/mirror/projects/${projectId}/workflows/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo, workflowId, ref }),
  })

// ---- 진행·결과 (활동 이력 + 연결 이슈·PR) ----
export type TaskActivity = { at: string; kind: string; note: string }
export type TaskPull = { number: number; title: string; state: string | null; merged: boolean; url: string | null }
export type TaskComment = { number: number; kind: "issue" | "review"; user: string | null; body: string; url: string | null; at: string | null }
export type TaskInsight = { activity: TaskActivity[]; issueState: string | null; pulls: TaskPull[]; comments: TaskComment[] }

export const getTaskInsight = (projectId: string, taskId: string) =>
  j<TaskInsight>(`/api/mirror/projects/${projectId}/tasks/${taskId}/insight`)

// 검토 처리: approve = 사람이 완료 승인, feedback = 피드백 남기고 진행 중으로 재개
export const reviewTask = (projectId: string, taskId: string, action: "approve" | "feedback", comment?: string) =>
  j<Task>(`/api/mirror/projects/${projectId}/tasks/${taskId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, comment }),
  })
