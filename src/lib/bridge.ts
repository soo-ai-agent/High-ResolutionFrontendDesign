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
  id: number
  at: string
  repo: string
  number: number
  taskCode: string | null
  status: "대기" | "실행 중" | "완료" | "실패" | "취소"
  note: string
  branch: string | null
  prUrl: string | null
}
export type BridgeStatus = { mode: "github" | "local"; queued: number; running: boolean; cliAvailable: boolean; command: string; jobs: BridgeJob[] }

export const getBridgeStatus = () => j<BridgeStatus>("/api/bridge/status")

export const setBridgeMode = (mode: "github" | "local") =>
  j<BridgeStatus>("/api/bridge/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  })

export const cancelBridgeJob = (id: number) => j<BridgeStatus>(`/api/bridge/jobs/${id}/cancel`, { method: "POST" })
export const retryBridgeJob = (id: number) => j<BridgeStatus>(`/api/bridge/jobs/${id}/retry`, { method: "POST" })
export const bridgeJobLog = async (id: number): Promise<string> => {
  const r = await fetch(`/api/bridge/jobs/${id}/log`)
  if (!r.ok) throw new Error(`로그 조회 실패 (${r.status})`)
  return r.text()
}

// ---- 서버 구성 상태 — 루프가 실제로 돌 수 있는 설정인지 ----
export type Capabilities = {
  llm: "anthropic" | "openai" | "none"
  webhookSecretSet: boolean
  githubConnected: boolean
  agentMode: "github" | "local"
  bridgeCliAvailable: boolean
  gitAvailable: boolean
  e2eCommandSet: boolean
}
export const getCapabilities = () => j<Capabilities>("/api/system/capabilities")
