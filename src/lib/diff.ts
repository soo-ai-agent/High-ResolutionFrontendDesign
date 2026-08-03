// 줄 단위 diff (LCS) — 문서 리비전 비교용. 앞뒤 공통 구간을 먼저 잘라내고 가운데만 DP 해요.
export type DiffOp = { type: "same" | "add" | "del"; text: string }

export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = oldText.replace(/\r\n/g, "\n").split("\n")
  const b = newText.replace(/\r\n/g, "\n").split("\n")
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }
  const ops: DiffOp[] = a.slice(0, start).map((t): DiffOp => ({ type: "same", text: t }))
  ops.push(...lcsDiff(a.slice(start, endA), b.slice(start, endB)))
  ops.push(...a.slice(endA).map((t): DiffOp => ({ type: "same", text: t })))
  return ops
}

function lcsDiff(a: string[], b: string[]): DiffOp[] {
  if (a.length === 0) return b.map((t): DiffOp => ({ type: "add", text: t }))
  if (b.length === 0) return a.map((t): DiffOp => ({ type: "del", text: t }))
  // 문서가 비정상적으로 크면 DP 를 포기하고 통짜 교체로 표시 (평가 용도에는 충분).
  if (a.length * b.length > 4_000_000) {
    return [...a.map((t): DiffOp => ({ type: "del", text: t })), ...b.map((t): DiffOp => ({ type: "add", text: t }))]
  }
  const n = a.length
  const m = b.length
  const w = m + 1
  const dp = new Int32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
  const out: DiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++ }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) { out.push({ type: "del", text: a[i] }); i++ }
    else { out.push({ type: "add", text: b[j] }); j++ }
  }
  while (i < n) { out.push({ type: "del", text: a[i] }); i++ }
  while (j < m) { out.push({ type: "add", text: b[j] }); j++ }
  return out
}
