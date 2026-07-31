// GitHub 연동 클라이언트.
//
// 지금은 프론트엔드에서 Personal Access Token으로 GitHub REST API를 직접 호출해요.
// 추후 백엔드가 생기면 이 파일의 함수 구현만 서버 호출로 교체하면 되고,
// UI(자료·설정 화면)는 이 모듈 인터페이스에만 의존하므로 그대로 둘 수 있어요.
import { useSyncExternalStore } from "react"

const API = "https://api.github.com"
const TOKEN_KEY = "af.gh.token"

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

// ---- 구독 가능한 연결 상태 (토큰 값 자체는 절대 노출하지 않아요) ----
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

let userSnapshot: GHUser | null = null

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function isConnected(): boolean {
  return !!getToken()
}

function messageFor(status: number): string {
  if (status === 401) return "토큰이 유효하지 않아요. 다시 확인해 주세요."
  if (status === 403) return "요청 한도를 초과했거나 접근 권한이 없어요."
  if (status === 404) return "대상을 찾을 수 없어요."
  return `GitHub 요청에 실패했어요 (${status}).`
}

async function ghFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken()
  if (!token) throw new GitHubError("GitHub에 연결되어 있지 않아요.", 401)
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    if (res.status === 401) disconnect()
    throw new GitHubError(messageFor(res.status), res.status)
  }
  return res
}

// ---- 연결 / 해제 ----
export async function connect(token: string): Promise<GHUser> {
  const trimmed = token.trim()
  if (!trimmed) throw new GitHubError("토큰을 입력해 주세요.", 400)
  const res = await fetch(API + "/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${trimmed}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!res.ok) throw new GitHubError(messageFor(res.status), res.status)
  const u = await res.json()
  try {
    localStorage.setItem(TOKEN_KEY, trimmed)
  } catch {
    // ignore storage failures — 세션 동안만 유지돼요.
  }
  userSnapshot = { login: u.login, name: u.name ?? null, avatar_url: u.avatar_url }
  emit()
  return userSnapshot
}

export function disconnect() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
  userSnapshot = null
  emit()
}

// 저장된 토큰이 있으면 사용자 정보를 다시 채워요(새로고침 대응).
async function refreshUser() {
  const token = getToken()
  if (!token || userSnapshot) return
  try {
    const res = await fetch(API + "/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })
    if (!res.ok) {
      if (res.status === 401) disconnect()
      return
    }
    const u = await res.json()
    userSnapshot = { login: u.login, name: u.name ?? null, avatar_url: u.avatar_url }
    emit()
  } catch {
    // 네트워크 오류는 조용히 무시 — 연결 상태는 토큰 존재 여부로 판단해요.
  }
}

// ---- 데이터 조회 ----
export async function listRepos(): Promise<GHRepo[]> {
  const res = await ghFetch("/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member")
  const data = await res.json()
  return (data as any[]).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    name: r.name,
    owner: r.owner.login,
    default_branch: r.default_branch,
    private: r.private,
    updated_at: r.updated_at,
  }))
}

export async function listIssues(owner: string, repo: string): Promise<GHIssue[]> {
  const res = await ghFetch(`/repos/${owner}/${repo}/issues?state=all&per_page=50`)
  const data = await res.json()
  return (data as any[])
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body ?? null,
      state: i.state,
      html_url: i.html_url,
      user: i.user?.login ?? "",
      labels: (i.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name)),
    }))
}

export async function listDocs(owner: string, repo: string, path = ""): Promise<GHDoc[]> {
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`)
  const data = await res.json()
  const arr = Array.isArray(data) ? data : [data]
  return (arr as any[])
    .map((d) => ({ name: d.name, path: d.path, type: d.type as "file" | "dir", size: d.size ?? 0 }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1))
}

export async function getFileContent(owner: string, repo: string, path: string): Promise<string> {
  const res = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`)
  const d = await res.json()
  if (d.encoding === "base64" && typeof d.content === "string") {
    const binary = atob(d.content.replace(/\n/g, ""))
    try {
      // UTF-8 디코딩 (한글 문서 대응)
      return decodeURIComponent(
        Array.prototype.map.call(binary, (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""),
      )
    } catch {
      return binary
    }
  }
  return d.content ?? ""
}

// ---- React 훅 ----
export function useGitHub() {
  const connected = useSyncExternalStore(subscribe, isConnected, () => false)
  const user = useSyncExternalStore(subscribe, () => userSnapshot, () => null)
  return { connected, user, connect, disconnect }
}

// 모듈 로드 시 저장된 토큰 검증
if (typeof window !== "undefined") {
  void refreshUser()
}
