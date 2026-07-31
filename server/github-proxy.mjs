// 서버 측 GitHub 프록시.
//
// 프론트엔드는 이제 GitHub를 직접 호출하지 않고 이 서버 엔드포인트(/api/github/*)만 호출해요.
// Personal Access Token은 브라우저가 아니라 "서버 메모리"에 보관돼요(프로토타입 · 단일 사용자 기준).
// 개발/프리뷰(Vite 플러그인)와 프로덕션(Node 서버)이 이 모듈을 함께 사용해요.
//
// 참고: 제한된 네트워크에서는 서버의 outbound 가 프록시를 거쳐야 할 수 있어요.
// 그 경우 undici ProxyAgent(HTTPS_PROXY)를 fetch dispatcher 로 설정하면 돼요.

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

    send(res, 404, { error: "not found" })
    return true
  } catch (e) {
    send(res, e?.status || 502, { error: e?.message || String(e) })
    return true
  }
}
