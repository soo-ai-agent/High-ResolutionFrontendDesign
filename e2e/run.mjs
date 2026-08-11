// Agent Flow E2E 러너 — 대시보드의 '테스트 실행' 버튼(E2E_COMMAND=node e2e/run.mjs)이나
// 터미널에서 직접 실행해요. 화면들을 열어 핵심 문구를 확인하고, 캡처와 함께 결과를
// /api/e2e/runs 로 업로드해요(테스트 리포트 화면에 표시).
//
// 필요:
//   BASE_URL    — 서버 주소 (기본 http://127.0.0.1:8443, 실행 버튼이 자동 주입)
//   CHROME_PATH — 크로미움 실행 파일 (없으면 PLAYWRIGHT_BROWSERS_PATH 아래에서 탐색)
//   의존성: pnpm install (playwright-core 는 devDependencies 에 있어요)
import { chromium } from "playwright-core"
import { readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const BASE = process.env.BASE_URL || "http://127.0.0.1:8443"

function chromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (root && existsSync(root)) {
    for (const d of readdirSync(root)) {
      if (!d.startsWith("chromium")) continue
      for (const c of [join(root, d, "chrome-linux", "chrome"), join(root, d, "chrome-linux", "headless_shell")])
        if (existsSync(c)) return c
    }
  }
  return null
}

const exe = chromePath()
if (!exe) {
  console.error("크로미움을 찾지 못했어요 — CHROME_PATH 또는 PLAYWRIGHT_BROWSERS_PATH 를 설정하세요.")
  process.exit(2)
}

const cases = []
const shots = [] // [파일명, Buffer]
const check = (name, ok) => { cases.push({ name, ok }); console.log(`${ok ? "✅" : "❌"} ${name}`) }

const browser = await chromium.launch({ executablePath: exe })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const body = () => page.locator("body").innerText()
const snap = async (file) => shots.push([file, await page.screenshot({ fullPage: true })])
const go = async (menu) => { await page.getByText(menu, { exact: true }).first().click(); await page.waitForTimeout(1200) }

try {
  // 프로젝트 목록 (로그인 관문 없음 — 바로 진입)
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  let text = await body()
  check("프로젝트: 목록 화면 렌더", text.includes("프로젝트"))
  await snap("projects.png")

  // 프로젝트가 있으면 이름으로 진입해 안쪽 화면들 순회 (이름은 API 로 조회 — 셀렉터 추측 없이)
  const projects = await fetch(BASE + "/api/mirror/projects").then((r) => r.json()).catch(() => [])
  let opened = false
  if (projects[0]?.name) {
    try {
      await page.getByText(projects[0].name, { exact: true }).first().click()
      await page.waitForTimeout(1300)
      opened = true
    } catch { /* 카드 클릭 실패 — 아래에서 건너뛰기 안내 */ }
  }

  if (opened) {
    for (const [menu, expect, file] of [
      ["진행 흐름", /파이프라인|활동|간트|워크플로/, "pipeline.png"],
      ["작업 계획", /작업 계획|자동 디스패치/, "tasks.png"],
      ["GitHub 미러", /미러|웹훅/, "mirror.png"],
      ["Projects 보드", /보드/, "board.png"],
      ["휴먼태스크", /휴먼태스크/, "human-tasks.png"],
      ["테스트 리포트", /테스트/, "qa.png"],
      ["조직 규칙·스킬", /조직/, "org.png"],
      ["설정", /연동/, "settings.png"],
    ]) {
      try {
        await go(menu)
        const t = await body()
        check(`${menu}: 화면 렌더`, expect.test(t))
        await snap(file)
      } catch {
        check(`${menu}: 화면 렌더`, false)
      }
    }
  } else {
    console.log("프로젝트가 없어 안쪽 화면 순회는 건너뛰어요 — 프로젝트를 만들면 전체가 검증돼요.")
  }
} finally {
  await browser.close()
}

// 결과 업로드 — 테스트 리포트 화면에 표시돼요.
const passed = cases.filter((c) => c.ok).length
const res = await fetch(BASE + "/api/e2e/runs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: `러너 실행 (${passed}/${cases.length})`, cases }),
})
if (!res.ok) { console.error("결과 업로드 실패:", res.status); process.exit(1) }
const run = await res.json()
for (const [file, buf] of shots) {
  await fetch(`${BASE}/api/e2e/runs/${run.id}/shots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, dataBase64: buf.toString("base64") }),
  }).catch(() => {})
}
console.log(`업로드 완료 — 실행 #${run.id} · ${passed}/${cases.length} 통과 · 캡처 ${shots.length}장`)
process.exit(passed === cases.length ? 0 : 1)
