// GitHub → DB 미러 (단방향) + 미러 읽기 + 관리 확장 쓰기.
//
// - POST /api/webhook/github  : GitHub 웹훅 수신. x-hub-signature-256 (HMAC-SHA256) 서명 검증 후 DB 미러.
// - GET  /api/mirror[/summary]: 미러 요약(카운트)
// - GET  /api/mirror/{issues|pulls|runs|repos|events}[?repo=] : 미러 조회
// - PATCH /api/mirror/issues  : 관리 확장 필드(stage·priority·mapping)만 갱신 (GitHub 로는 안 나감)
// - POST /api/mirror/reset    : 미러 비우기 (원천에서 재구축 가능하므로 안전)
import crypto from "node:crypto"
import { db } from "./db.mjs"

let warnedNoSecret = false

function send(res, code, obj) {
  res.statusCode = code
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.end(JSON.stringify(obj))
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let len = 0
    req.on("data", (c) => {
      chunks.push(c)
      len += c.length
      if (len > 2_000_000) reject(new Error("payload too large"))
    })
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

// 서명 검증 결과: true(유효) / false(불일치) / null(시크릿 미설정)
function verifySignature(raw, signature, secret) {
  if (!secret) return null
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature || "")
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// 이벤트를 DB 미러로 반영해요.
function mirrorEvent(event, payload) {
  const repo = payload?.repository?.full_name || null
  if (payload?.repository) {
    db.upsertRepo({
      full_name: payload.repository.full_name,
      private: payload.repository.private,
      default_branch: payload.repository.default_branch,
      updated_at: payload.repository.updated_at,
    })
  }
  let summary = event
  if (event === "issues" && payload.issue) {
    const i = payload.issue
    db.upsertIssue({
      repo,
      number: i.number,
      title: i.title,
      state: i.state,
      labels: (i.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
      user: i.user?.login ?? null,
      html_url: i.html_url,
      updated_at: i.updated_at,
    })
    summary = `issue #${i.number} ${payload.action ?? ""}`.trim()
  } else if (event === "pull_request" && payload.pull_request) {
    const p = payload.pull_request
    db.upsertPull({
      repo,
      number: p.number,
      title: p.title,
      state: p.state,
      merged: !!p.merged,
      draft: !!p.draft,
      user: p.user?.login ?? null,
      html_url: p.html_url,
      updated_at: p.updated_at,
    })
    summary = `PR #${p.number} ${payload.action ?? ""}`.trim()
  } else if (event === "workflow_run" && payload.workflow_run) {
    const w = payload.workflow_run
    db.upsertRun({
      repo,
      id: w.id,
      name: w.name,
      status: w.status,
      conclusion: w.conclusion,
      head_branch: w.head_branch,
      html_url: w.html_url,
      updated_at: w.updated_at,
    })
    summary = `run ${w.name} ${w.status}${w.conclusion ? " · " + w.conclusion : ""}`
  } else if (event === "push") {
    summary = `push ${payload.ref || ""} (${(payload.commits || []).length} commits)`
  }
  return { repo, summary }
}

/** /api/webhook/* 와 /api/mirror/* 요청을 처리해요. 처리했으면 true. */
export async function handleMirror(req, res) {
  const u = new URL(req.url, "http://localhost")
  const p = u.pathname
  if (!p.startsWith("/api/webhook") && !p.startsWith("/api/mirror")) return false

  // ---- 웹훅 수신 (GitHub → DB, 단방향) ----
  if (p === "/api/webhook/github") {
    if (req.method !== "POST") {
      send(res, 405, { error: "POST only" })
      return true
    }
    let raw
    try {
      raw = await readRaw(req)
    } catch (e) {
      send(res, 413, { error: String(e?.message || e) })
      return true
    }
    const event = String(req.headers["x-github-event"] || "unknown")
    const delivery = req.headers["x-github-delivery"] || null
    const sig = req.headers["x-hub-signature-256"]
    const secret = process.env.GITHUB_WEBHOOK_SECRET
    const verified = verifySignature(raw, sig, secret)
    if (verified === false) {
      send(res, 401, { error: "서명 검증 실패" })
      return true
    }
    if (verified === null && !warnedNoSecret) {
      console.warn("[webhook] GITHUB_WEBHOOK_SECRET 미설정 — 서명 검증을 생략해요(개발용). 운영에선 반드시 설정하세요.")
      warnedNoSecret = true
    }
    let payload
    try {
      payload = JSON.parse(raw.toString("utf-8") || "{}")
    } catch {
      send(res, 400, { error: "invalid JSON" })
      return true
    }
    if (event === "ping") {
      send(res, 200, { ok: true, pong: true, zen: payload.zen ?? null })
      return true
    }
    const { repo, summary } = mirrorEvent(event, payload)
    db.logEvent({ id: delivery, event, action: payload.action ?? null, repo, at: new Date().toISOString(), verified: verified === true, summary })
    send(res, 200, { ok: true, mirrored: true, event, verified: verified === true })
    return true
  }

  // ---- 관리 확장 쓰기 / 미러 읽기 (issues 는 method 로 구분) ----
  if (p === "/api/mirror/issues") {
    if (req.method === "PATCH") {
      let body
      try {
        body = JSON.parse((await readRaw(req)).toString("utf-8") || "{}")
      } catch {
        send(res, 400, { error: "invalid JSON" })
        return true
      }
      const { repo, number, stage, priority, mapping } = body
      if (!repo || number == null) {
        send(res, 400, { error: "repo·number 가 필요해요." })
        return true
      }
      const updated = db.setIssueAdmin(repo, number, { stage, priority, mapping })
      if (!updated) {
        send(res, 404, { error: "미러에 없는 이슈예요. 먼저 웹훅으로 동기화되어야 해요." })
        return true
      }
      send(res, 200, updated)
      return true
    }
    send(res, 200, db.list("issues", u.searchParams.get("repo")))
    return true
  }

  if (p === "/api/mirror/reset" && req.method === "POST") {
    db.reset()
    send(res, 200, { ok: true, reset: true })
    return true
  }

  if (p === "/api/mirror" || p === "/api/mirror/summary") {
    send(res, 200, db.summary())
    return true
  }
  if (p === "/api/mirror/pulls") {
    send(res, 200, db.list("pulls", u.searchParams.get("repo")))
    return true
  }
  if (p === "/api/mirror/runs") {
    send(res, 200, db.list("runs", u.searchParams.get("repo")))
    return true
  }
  if (p === "/api/mirror/repos") {
    send(res, 200, db.list("repos"))
    return true
  }
  if (p === "/api/mirror/events") {
    send(res, 200, db.events(u.searchParams.get("repo")))
    return true
  }

  send(res, 404, { error: "not found" })
  return true
}
