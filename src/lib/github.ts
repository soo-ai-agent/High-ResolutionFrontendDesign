// GitHub 연동 클라이언트 (프론트엔드).
//
// 이제 GitHub를 직접 호출하지 않아요. 모든 요청은 서버 프록시(/api/github/*)를 거치고,
// Personal Access Token은 브라우저가 아니라 서버 메모리에 보관돼요.
// UI(자료·설정 화면)는 이 모듈 인터페이스에만 의존하므로 그대로 둘 수 있어요.
import { useSyncExternalStore } from "react"

const BASE = "/api/github"

export type GHUser = { login: string; name: string | null; avatar_url: string }
export type GHRepo = { id: number; full_name: string; name: string; owner: string; default_branch: string; private: boolean; updated_at: string }
export type GHIssue = { number: number; title: string; body: string | null; state: string; html_url: string; user: string; labels: string[] }
export type GHDoc = { name: string; path: string; type: "file" | "dir"; size: number }

export class GitHubError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// ---- 구독 가능한 연결 상태 (토큰은 서버에만 있고 여기선 존재 여부/사용자 정보만 알아요) ----
const listeners = new Set<() => void>()
function emit() {
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

let connectedSnapshot = false
let userSnapshot: GHUser | null = null

function messageFor(status: number): string {
  if (status === 401) return "토큰이 유효하지 않아요. 다시 확인해 주세요."
  if (status === 403) return "요청 한도를 초과했거나 접근 권한이 없어요."
  if (status === 404) return "대상을 찾을 수 없어요."
  return `GitHub 요청에 실패했어요 (${status}).`
}

// 서버 프록시 호출. 실패 시 GitHubError 로 변환해요.
async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    let msg = messageFor(res.status)
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {
      // JSON 이 아니어도 기본 메시지를 써요.
    }
    if (res.status === 401) {
      connectedSnapshot = false
      userSnapshot = null
      emit()
    }
    throw new GitHubError(msg, res.status)
  }
  return res
}

export function isConnected(): boolean {
  return connectedSnapshot
}

// ---- 연결 / 해제 ----
export async function connect(token: string): Promise<GHUser> {
  const trimmed = token.trim()
  if (!trimmed) throw new GitHubError("토큰을 입력해 주세요.", 400)
  const res = await call("/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: trimmed }),
  })
  const j = (await res.json()) as { user: GHUser }
  connectedSnapshot = true
  userSnapshot = j.user
  emit()
  return userSnapshot
}

export async function disconnect(): Promise<void> {
  try {
    await fetch(BASE + "/disconnect", { method: "POST" })
  } catch {
    // 네트워크 오류는 무시 — 로컬 상태만 정리해요.
  }
  connectedSnapshot = false
  userSnapshot = null
  emit()
}

// 저장된 서버 연결 상태를 다시 읽어와요(새로고침 대응).
async function refreshStatus() {
  try {
    const res = await fetch(BASE + "/status", { headers: { Accept: "application/json" } })
    if (!res.ok) return
    const j = (await res.json()) as { connected: boolean; user: GHUser | null }
    connectedSnapshot = !!j.connected
    userSnapshot = j.user ?? null
    emit()
  } catch {
    // 조용히 무시 — 연결 상태는 다음 요청에서 갱신돼요.
  }
}

// ---- 데이터 조회 (모두 서버 프록시 경유) ----
export async function listRepos(): Promise<GHRepo[]> {
  const res = await call("/repos")
  return (await res.json()) as GHRepo[]
}

export async function listIssues(owner: string, repo: string): Promise<GHIssue[]> {
  const res = await call(`/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
  return (await res.json()) as GHIssue[]
}

export async function listDocs(owner: string, repo: string, path = ""): Promise<GHDoc[]> {
  const res = await call(`/contents?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`)
  return (await res.json()) as GHDoc[]
}

export async function getFileContent(owner: string, repo: string, path: string): Promise<string> {
  const res = await call(`/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`)
  const j = (await res.json()) as { content: string }
  return j.content ?? ""
}

// ---- React 훅 ----
export function useGitHub() {
  const connected = useSyncExternalStore(subscribe, isConnected, () => false)
  const user = useSyncExternalStore(subscribe, () => userSnapshot, () => null)
  return { connected, user, connect, disconnect }
}

// 모듈 로드 시 서버 연결 상태 조회
if (typeof window !== "undefined") {
  void refreshStatus()
}
