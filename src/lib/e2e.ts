// E2E 테스트 리포트 클라이언트 — 실행별 케이스 결과와 캡처 스크린샷을 조회해요.
export type E2eCase = { name: string; ok: boolean }
export type E2eRun = {
  id: number
  at: string
  name: string
  total: number
  passed: number
  cases: E2eCase[]
  shots: string[]
}

export async function listE2eRuns(): Promise<E2eRun[]> {
  const res = await fetch("/api/e2e/runs", { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`)
  return (await res.json()) as E2eRun[]
}

export const e2eShotUrl = (runId: number, file: string) => `/api/e2e/runs/${runId}/shots/${file}`
