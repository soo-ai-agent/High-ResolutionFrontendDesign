// 에이전트 실행 모드(github|local) + 로컬 브리지 큐 상태 — 설정 화면이 써요.
async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`
    try {
      const body = (await res.json()) as { message?: string; error?: string }
      msg = body.message || body.error || msg
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export type BridgeJob = {
  at: string
  repo: string
  number: number
  taskCode: string | null
  status: "대기" | "실행 중" | "완료" | "실패"
  note: string
  branch: string | null
  prUrl: string | null
}
export type BridgeStatus = { mode: "github" | "local"; queued: number; running: boolean; jobs: BridgeJob[] }

export const getBridgeStatus = () => j<BridgeStatus>("/api/bridge/status")

export const setBridgeMode = (mode: "github" | "local") =>
  j<BridgeStatus>("/api/bridge/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  })
