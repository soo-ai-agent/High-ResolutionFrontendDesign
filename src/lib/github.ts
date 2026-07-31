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
// 첫 상태 조회가 끝나기 전엔 true — "연결 필요"가 잠깐 깜빡이는 걸 막아요.
let checkingSnapshot = true

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

export function isChecking(): boolean {
  return checkingSnapshot
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
    if (res.ok) {
      const j = (await res.json()) as { connected: boolean; user: GHUser | null }
      connectedSnapshot = !!j.connected
      userSnapshot = j.user ?? null
    }
  } catch {
    // 조용히 무시 — 연결 상태는 다음 요청에서 갱신돼요.
  } finally {
    checkingSnapshot = false
    emit()
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

// ---- 쓰기 (어드민 → GitHub 프록시 쓰기) ----
export type CreatedIssue = { number: number; html_url: string; title: string }
export type CommentResult = { id: number; html_url: string; body?: string }

export async function createIssue(owner: string, repo: string, input: { title: string; body?: string; labels?: string[] }): Promise<CreatedIssue> {
  const res = await call("/issues", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, ...input }) })
  return (await res.json()) as CreatedIssue
}

export async function addComment(owner: string, repo: string, number: number, body: string): Promise<CommentResult> {
  const res = await call("/comment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, number, body }) })
  return (await res.json()) as CommentResult
}

// 이슈/PR에 @claude 코멘트를 남겨 Claude GitHub Action을 트리거해요.
export async function mentionClaude(owner: string, repo: string, number: number, prompt: string): Promise<CommentResult> {
  const res = await call("/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, number, prompt }) })
  return (await res.json()) as CommentResult
}

// ---- 백필(초기 동기화) — 현재 이슈·PR·Actions 상태를 GitHub 에서 당겨 미러에 채워요 ----
export type BackfillResult = { repo: string; issues: number; pulls: number; runs: number; truncated: string[] }

export async function backfill(owner: string, repo: string, include?: string[]): Promise<BackfillResult> {
  const res = await call("/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, include }) })
  return (await res.json()) as BackfillResult
}

// ---- 저장소 웹훅(수신) 관리 — 실제 GitHub 저장소에 서버 수신 웹훅을 등록/조회/핑 ----
export type GHHook = { id: number; active: boolean; events: string[]; url: string; insecure_ssl: string; last_status: string | null; last_code: number | null; updated_at: string }

export async function listHooks(owner: string, repo: string): Promise<GHHook[]> {
  const res = await call(`/hooks?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
  return (await res.json()) as GHHook[]
}

export async function createHook(owner: string, repo: string, input: { url: string; secret?: string; events?: string[] }): Promise<GHHook> {
  const res = await call("/hooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, ...input }) })
  return (await res.json()) as GHHook
}

export async function pingHook(owner: string, repo: string, id: number): Promise<void> {
  await call("/hooks/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, repo, id }) })
}

// ---- React 훅 ----
export function useGitHub() {
  const connected = useSyncExternalStore(subscribe, isConnected, () => false)
  const checking = useSyncExternalStore(subscribe, isChecking, () => false)
  const user = useSyncExternalStore(subscribe, () => userSnapshot, () => null)
  return { connected, checking, user, connect, disconnect }
}

// 모듈 로드 시 서버 연결 상태 조회
if (typeof window !== "undefined") {
  void refreshStatus()
}
