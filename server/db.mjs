// 어드민 DB — GitHub 미러 저장소.
//
// 지금은 파일 백엔드(JSON) 저장소예요. GitHub 필드는 미러(RO)이고, 관리 확장 필드
// (stage·priority·mapping)만 어드민이 소유해요. 미러는 언제든 원천(GitHub)에서
// 재구축 가능하므로 파일 저장으로 충분하고, 아래 DAO 인터페이스만 유지하면
// 나중에 SQLite / Postgres 로 교체할 수 있어요.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".data")
const FILE = path.join(DIR, "mirror.json")

const empty = () => ({ repos: {}, issues: {}, pulls: {}, runs: {}, board: {}, events: [], meta: { updatedAt: null } })

let state = load()

function load() {
  try {
    return { ...empty(), ...JSON.parse(readFileSync(FILE, "utf-8")) }
  } catch {
    return empty()
  }
}
function persist() {
  try {
    mkdirSync(DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(state, null, 2))
  } catch (e) {
    console.warn("[db] persist 실패:", e?.message || e)
  }
}
function touch() {
  state.meta.updatedAt = new Date().toISOString()
}
const keyN = (repo, n) => `${repo}#${n}`

export const db = {
  snapshot: () => state,

  summary: () => ({
    repos: Object.keys(state.repos).length,
    issues: Object.keys(state.issues).length,
    pulls: Object.keys(state.pulls).length,
    runs: Object.keys(state.runs).length,
    // 진행 중(완료 아님) Actions 실행 수 — 상단바의 라이브 표시용.
    activeRuns: Object.values(state.runs).filter((r) => r.status && r.status !== "completed").length,
    events: state.events.length,
    updatedAt: state.meta.updatedAt,
  }),

  list: (kind, repo) => {
    const all = Object.values(state[kind] || {})
    return repo ? all.filter((x) => x.repo === repo || x.full_name === repo) : all
  },

  events: (repo) => (repo ? state.events.filter((e) => e.repo === repo) : state.events),

  upsertRepo(r) {
    if (!r?.full_name) return
    state.repos[r.full_name] = { ...(state.repos[r.full_name] || {}), ...r }
    touch()
    persist()
  },

  // GitHub 필드는 payload 로 덮되, 관리 확장(stage·priority·mapping)과
  // 보드 상태(boardStatus)는 보존해요 (재-미러링 시 사라지지 않도록).
  upsertIssue(i) {
    if (!i?.repo || i.number == null) return
    const k = keyN(i.repo, i.number)
    const prev = state.issues[k] || {}
    const keep = { stage: prev.stage ?? null, priority: prev.priority ?? null, mapping: prev.mapping ?? null, boardStatus: prev.boardStatus ?? null, boardUpdatedAt: prev.boardUpdatedAt ?? null }
    state.issues[k] = { ...i, ...keep }
    touch()
    persist()
  },

  upsertPull(pr) {
    if (!pr?.repo || pr.number == null) return
    const k = keyN(pr.repo, pr.number)
    const prev = state.pulls[k] || {}
    const keep = { stage: prev.stage ?? null, priority: prev.priority ?? null, mapping: prev.mapping ?? null, boardStatus: prev.boardStatus ?? null, boardUpdatedAt: prev.boardUpdatedAt ?? null }
    state.pulls[k] = { ...pr, ...keep }
    touch()
    persist()
  },

  // ---- GitHub Projects 보드 미러 (projects_v2_item) ----
  // 보드 아이템(원시 이벤트)을 content_node_id 로 보관해요.
  upsertBoardItem(b) {
    if (!b?.contentNodeId) return
    state.board[b.contentNodeId] = { ...(state.board[b.contentNodeId] || {}), ...b }
    touch()
    persist()
  },

  // 실제 보드 이동 반영: node_id 로 이슈/PR을 찾아 boardStatus 를 갱신해요.
  setBoardStatusByNode(nodeId, status) {
    if (!nodeId) return null
    for (const kind of ["issues", "pulls"]) {
      for (const k of Object.keys(state[kind])) {
        if (state[kind][k].node_id === nodeId) {
          state[kind][k] = { ...state[kind][k], boardStatus: status ?? null, boardUpdatedAt: new Date().toISOString() }
          touch()
          persist()
          return state[kind][k]
        }
      }
    }
    return null
  },

  upsertRun(run) {
    if (!run?.repo || run.id == null) return
    const k = keyN(run.repo, run.id)
    state.runs[k] = { ...(state.runs[k] || {}), ...run }
    touch()
    persist()
  },

  // 관리 확장 필드만 갱신 — GitHub 로는 절대 나가지 않아요.
  setIssueAdmin(repo, number, fields) {
    const k = keyN(repo, number)
    const prev = state.issues[k]
    if (!prev) return null
    const patch = {}
    if (fields.stage !== undefined) patch.stage = fields.stage
    if (fields.priority !== undefined) patch.priority = fields.priority
    if (fields.mapping !== undefined) patch.mapping = fields.mapping
    state.issues[k] = { ...prev, ...patch }
    touch()
    persist()
    return state.issues[k]
  },

  logEvent(e) {
    state.events.unshift(e)
    if (state.events.length > 200) state.events.length = 200
    touch()
    persist()
  },

  // 원천(GitHub)에서 재구축할 수 있으므로 미러는 언제든 비울 수 있어요.
  reset() {
    state = empty()
    persist()
  },
}
