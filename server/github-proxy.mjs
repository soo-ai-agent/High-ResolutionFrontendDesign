// 서버 측 GitHub 프록시.
//
// 프론트엔드는 이제 GitHub를 직접 호출하지 않고 이 서버 엔드포인트(/api/github/*)만 호출해요.
// Personal Access Token은 브라우저가 아니라 "서버 메모리"에 보관돼요(프로토타입 · 단일 사용자 기준).
// 개발/프리뷰(Vite 플러그인)와 프로덕션(Node 서버)이 이 모듈을 함께 사용해요.
//
// 참고: 제한된 네트워크에서는 서버의 outbound 가 프록시를 거쳐야 할 수 있어요.
// 그 경우 undici ProxyAgent(HTTPS_PROXY)를 fetch dispatcher 로 설정하면 돼요.
import { db } from "./db.mjs"

const API = "https://api.github.com"
const ghHeaders = (token) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
})

// 서버 메모리에만 보관 (프로세스 재시작 시 사라짐)
let token = null
let user = null

function messageFor(status) {
  if (status === 401) return "토큰이 유효하지 않아요. 다시 확인해 주세요."
  if (status === 403) return "요청 한도를 초과했거나 접근 권한이 없어요."
  if (status === 404) return "대상을 찾을 수 없어요."
  return `GitHub 요청에 실패했어요 (${status}).`
}

async function gh(path, init) {
  if (!token) {
    const e = new Error("GitHub에 연결되어 있지 않아요.")
    e.status = 401
    throw e
  }
  const res = await fetch(API + path, { ...init, headers: { ...ghHeaders(token), ...(init?.headers || {}) } })
  if (!res.ok) {
    if (res.status === 401) { token = null; user = null }
    const e = new Error(messageFor(res.status))
    e.status = res.status
    throw e
  }
  return res
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (c) => {
      body += c
      if (body.length > 100_000) reject(new Error("요청 본문이 너무 커요."))
    })
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on("error", reject)
  })
}

function send(res, code, obj) {
  res.statusCode = code
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.end(JSON.stringify(obj))
}

// GitHub 응답을 UI가 쓰는 형태로 정규화 (원래 프론트에서 하던 매핑을 서버로 이동)
const mapRepo = (r) => ({ id: r.id, full_name: r.full_name, name: r.name, owner: r.owner.login, default_branch: r.default_branch, private: r.private, updated_at: r.updated_at })
const mapIssue = (i) => ({ number: i.number, title: i.title, body: i.body ?? null, state: i.state, html_url: i.html_url, user: i.user?.login ?? "", labels: (i.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)) })
const mapDoc = (d) => ({ name: d.name, path: d.path, type: d.type, size: d.size ?? 0 })
const mapHook = (h) => ({ id: h.id, active: h.active, events: h.events ?? [], url: h.config?.url ?? "", insecure_ssl: h.config?.insecure_ssl ?? "0", last_status: h.last_response?.status ?? null, last_code: h.last_response?.code ?? null, updated_at: h.updated_at })

// 웹훅에 등록할 기본 이벤트 (이슈·PR·Actions·푸시). projects_v2_item 은 조직 레벨이라 여기서 못 걸어요.
const DEFAULT_HOOK_EVENTS = ["issues", "pull_request", "workflow_run", "push"]

// 백필 매핑 + 미러 반영 (순수 로직 — 네트워크와 분리해 테스트하기 쉬워요).
// 이미 가져온 GitHub REST 배열을 받아 미러 upsert 형태로 변환·저장하고 카운트를 돌려줘요.
export function applyBackfill(full, { include = ["issues", "pulls", "runs"], issuesData = [], pullsData = [], runsData = [] } = {}) {
  const result = { repo: full, issues: 0, pulls: 0, runs: 0, truncated: [] }

  if (include.includes("issues")) {
    const arr = Array.isArray(issuesData) ? issuesData : []
    const only = arr.filter((i) => !i.pull_request) // PR 은 issues 응답에도 섞여 나와요
    for (const i of only) {
      db.upsertIssue({ repo: full, number: i.number, title: i.title, state: i.state, labels: (i.labels || []).map((l) => (typeof l === "string" ? l : l.name)), user: i.user?.login ?? null, html_url: i.html_url, updated_at: i.updated_at, node_id: i.node_id })
    }
    result.issues = only.length
    if (arr.length === 100) result.truncated.push("issues") // 첫 페이지만
  }

  if (include.includes("pulls")) {
    const arr = Array.isArray(pullsData) ? pullsData : []
    for (const pr of arr) {
      db.upsertPull({ repo: full, number: pr.number, title: pr.title, state: pr.state, merged: !!pr.merged_at, draft: !!pr.draft, user: pr.user?.login ?? null, html_url: pr.html_url, updated_at: pr.updated_at, node_id: pr.node_id })
    }
    result.pulls = arr.length
    if (arr.length === 100) result.truncated.push("pulls")
  }

  if (include.includes("runs")) {
    const arr = Array.isArray(runsData) ? runsData : []
    for (const w of arr) {
      db.upsertRun({ repo: full, id: w.id, name: w.name, status: w.status, conclusion: w.conclusion, head_branch: w.head_branch, html_url: w.html_url, updated_at: w.updated_at })
    }
    result.runs = arr.length
    if (arr.length === 50) result.truncated.push("runs")
  }

  return result
}

/** /api/github/* 요청을 처리해요. 처리했으면 true, 아니면 false 를 반환해요. */
export async function handleGithub(req, res) {
  const u = new URL(req.url, "http://localhost")
  const p = u.pathname
  if (!p.startsWith("/api/github")) return false

  try {
    if (p === "/api/github/status") {
      send(res, 200, { connected: !!token, user })
      return true
    }

    if (p === "/api/github/connect" && req.method === "POST") {
      const body = await readJson(req)
      const t = String(body.token || "").trim()
      if (!t) {
        send(res, 400, { error: "토큰을 입력해 주세요." })
        return true
      }
      const r = await fetch(API + "/user", { headers: ghHeaders(t) })
      if (!r.ok) {
        send(res, r.status, { error: messageFor(r.status) })
        return true
      }
      const j = await r.json()
      token = t
      user = { login: j.login, name: j.name ?? null, avatar_url: j.avatar_url }
      send(res, 200, { connected: true, user })
      return true
    }

    if (p === "/api/github/disconnect" && req.method === "POST") {
      token = null
      user = null
      send(res, 200, { connected: false })
      return true
    }

    if (p === "/api/github/repos") {
      const r = await gh("/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member")
      const data = await r.json()
      send(res, 200, data.map(mapRepo))
      return true
    }

    if (p === "/api/github/issues") {
      // 쓰기: 이슈 생성 (어드민 → GitHub 프록시 쓰기)
      if (req.method === "POST") {
        const body = await readJson(req)
        const owner = body.owner
        const repo = body.repo
        const title = String(body.title || "").trim()
        if (!owner || !repo || !title) {
          send(res, 400, { error: "owner·repo·title 이 필요해요." })
          return true
        }
        const payload = { title, body: body.body ?? "" }
        if (Array.isArray(body.labels) && body.labels.length) payload.labels = body.labels
        const r = await gh(`/repos/${owner}/${repo}/issues`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const j = await r.json()
        send(res, 201, { number: j.number, html_url: j.html_url, title: j.title })
        return true
      }
      // 읽기: 이슈 목록
      const owner = u.searchParams.get("owner")
      const repo = u.searchParams.get("repo")
      if (!owner || !repo) {
        send(res, 400, { error: "owner·repo가 필요해요." })
        return true
      }
      const r = await gh(`/repos/${owner}/${repo}/issues?state=all&per_page=50`)
      const data = await r.json()
      send(res, 200, data.filter((i) => !i.pull_request).map(mapIssue))
      return true
    }

    // 쓰기: 이슈/PR 코멘트 생성
    if (p === "/api/github/comment" && req.method === "POST") {
      const body = await readJson(req)
      const { owner, repo, number } = body
      const text = String(body.body || "").trim()
      if (!owner || !repo || number == null || !text) {
        send(res, 400, { error: "owner·repo·number·body 가 필요해요." })
        return true
      }
      const r = await gh(`/repos/${owner}/${repo}/issues/${number}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) })
      const j = await r.json()
      send(res, 201, { id: j.id, html_url: j.html_url })
      return true
    }

    // 쓰기: @claude 코멘트 (Claude GitHub Action 트리거)
    if (p === "/api/github/claude" && req.method === "POST") {
      const body = await readJson(req)
      const { owner, repo, number } = body
      const prompt = String(body.prompt || "").trim()
      if (!owner || !repo || number == null || !prompt) {
        send(res, 400, { error: "owner·repo·number·prompt 가 필요해요." })
        return true
      }
      const text = prompt.startsWith("@claude") ? prompt : `@claude ${prompt}`
      const r = await gh(`/repos/${owner}/${repo}/issues/${number}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) })
      const j = await r.json()
      send(res, 201, { id: j.id, html_url: j.html_url, body: text })
      return true
    }

    if (p === "/api/github/contents") {
      const owner = u.searchParams.get("owner")
      const repo = u.searchParams.get("repo")
      const path = u.searchParams.get("path") || ""
      if (!owner || !repo) {
        send(res, 400, { error: "owner·repo가 필요해요." })
        return true
      }
      const r = await gh(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`)
      const data = await r.json()
      const arr = Array.isArray(data) ? data : [data]
      const docs = arr.map(mapDoc).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1))
      send(res, 200, docs)
      return true
    }

    if (p === "/api/github/file") {
      const owner = u.searchParams.get("owner")
      const repo = u.searchParams.get("repo")
      const path = u.searchParams.get("path") || ""
      if (!owner || !repo || !path) {
        send(res, 400, { error: "owner·repo·path가 필요해요." })
        return true
      }
      const r = await gh(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`)
      const d = await r.json()
      const content = d.encoding === "base64" && typeof d.content === "string" ? Buffer.from(d.content, "base64").toString("utf-8") : d.content ?? ""
      send(res, 200, { content })
      return true
    }

    // ---- 백필: 현재 이슈·PR·Actions 상태를 GitHub 에서 당겨 미러에 채워요 ----
    // 웹훅은 앞으로의 이벤트만 주므로, 연결 직후 한 번 실행해 미러를 현재 상태로 맞춰요.
    if (p === "/api/github/backfill" && req.method === "POST") {
      const body = await readJson(req)
      const owner = body.owner
      const repo = body.repo
      if (!owner || !repo) {
        send(res, 400, { error: "owner·repo 가 필요해요." })
        return true
      }
      const full = `${owner}/${repo}`
      const include = Array.isArray(body.include) && body.include.length ? body.include : ["issues", "pulls", "runs"]

      // 저장소 메타(실패해도 백필은 계속)
      try {
        const r = await (await gh(`/repos/${owner}/${repo}`)).json()
        db.upsertRepo({ full_name: r.full_name, private: r.private, default_branch: r.default_branch, updated_at: r.updated_at })
      } catch {
        // 무시
      }

      // GitHub 에서 현재 상태를 당겨와요 (선택 항목만).
      const issuesData = include.includes("issues") ? await (await gh(`/repos/${owner}/${repo}/issues?state=all&per_page=100`)).json() : []
      const pullsData = include.includes("pulls") ? await (await gh(`/repos/${owner}/${repo}/pulls?state=all&per_page=100`)).json() : []
      const runsData = include.includes("runs") ? (await (await gh(`/repos/${owner}/${repo}/actions/runs?per_page=50`)).json()).workflow_runs : []

      const result = applyBackfill(full, { include, issuesData, pullsData, runsData })
      db.logEvent({ id: null, event: "backfill", action: "sync", repo: full, at: new Date().toISOString(), verified: true, summary: `backfill: ${result.issues} issues · ${result.pulls} PRs · ${result.runs} runs` })
      send(res, 200, result)
      return true
    }

    // ---- 웹훅(레포지토리 훅) 관리: 실제 GitHub 저장소에 수신 웹훅을 등록/조회/핑 ----
    if (p === "/api/github/hooks/ping" && req.method === "POST") {
      const body = await readJson(req)
      const { owner, repo, id } = body
      if (!owner || !repo || id == null) {
        send(res, 400, { error: "owner·repo·id 가 필요해요." })
        return true
      }
      await gh(`/repos/${owner}/${repo}/hooks/${id}/pings`, { method: "POST" })
      send(res, 200, { ok: true, pinged: id })
      return true
    }

    if (p === "/api/github/hooks") {
      // 등록: 저장소에 수신 웹훅 생성 (전달 URL·시크릿·이벤트)
      if (req.method === "POST") {
        const body = await readJson(req)
        const owner = body.owner
        const repo = body.repo
        const url = String(body.url || "").trim()
        if (!owner || !repo || !url) {
          send(res, 400, { error: "owner·repo·url 이 필요해요." })
          return true
        }
        const events = Array.isArray(body.events) && body.events.length ? body.events : DEFAULT_HOOK_EVENTS
        const config = { url, content_type: "json", insecure_ssl: "0" }
        const secret = String(body.secret || "").trim()
        if (secret) config.secret = secret // GitHub 로만 전송, 응답에는 노출 안 됨
        const r = await gh(`/repos/${owner}/${repo}/hooks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "web", active: true, events, config }),
        })
        const j = await r.json()
        send(res, 201, mapHook(j))
        return true
      }
      // 조회: 저장소의 웹훅 목록
      const owner = u.searchParams.get("owner")
      const repo = u.searchParams.get("repo")
      if (!owner || !repo) {
        send(res, 400, { error: "owner·repo가 필요해요." })
        return true
      }
      const r = await gh(`/repos/${owner}/${repo}/hooks?per_page=100`)
      const data = await r.json()
      send(res, 200, (Array.isArray(data) ? data : []).map(mapHook))
      return true
    }

    send(res, 404, { error: "not found" })
    return true
  } catch (e) {
    send(res, e?.status || 502, { error: e?.message || String(e) })
    return true
  }
}
