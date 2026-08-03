// 프로젝트 저장소 클라이언트 — 서버 DB에 프로젝트를 저장/조회해요(영속).
// 번들 시드(데모)와 합쳐 화면에 보여줘요. 새로 만든 프로젝트는 서버에 남아요.
import type { ProjectItem } from "../data"

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

export const listProjects = () => j<ProjectItem[]>("/api/mirror/projects")
export const createProject = (p: ProjectItem) =>
  j<ProjectItem>("/api/mirror/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })
