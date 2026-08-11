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

// ---- 대시보드에서 E2E 실행 — 서버의 E2E_COMMAND 명령을 스폰해요(러너가 결과를 업로드) ----
export type E2eExecStatus = { running: boolean; configured: boolean; startedAt: string | null; exit: number | null; output: string }
export const executeE2e = () => j<E2eExecStatus>("/api/e2e/execute", { method: "POST" })
export const e2eExecStatus = () => j<E2eExecStatus>("/api/e2e/execute/status")

// ---- 테스트케이스 레지스트리 — 화면별 케이스 정의(사람이 등록·관리) ----
export type TestCase = { id: number; screen: string; name: string; note: string; createdAt: string }

// 화면 목록 — 사이드바 메뉴와 동일한 순서
export const TEST_SCREENS = ["프로젝트", "진행 흐름", "PRD", "IA·화면설계", "코드 규칙", "작업 계획", "GitHub 미러", "Projects 보드", "휴먼태스크", "테스트 리포트", "조직 규칙·스킬", "설정"]

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

export const listTestCases = () => j<TestCase[]>("/api/e2e/cases")

export const createTestCase = (screen: string, name: string, note = "") =>
  j<TestCase>("/api/e2e/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ screen, name, note }),
  })

export const deleteTestCase = (id: number) =>
  j<{ ok: boolean }>(`/api/e2e/cases/${id}`, { method: "DELETE" })
