// 프로덕션용 정적 + API 서버 (의존성 없음, Node 내장 http만 사용).
// 사용법: pnpm build  →  pnpm serve  (dist/ 와 dist/bootstrap.json 을 서빙)
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, '..', 'dist')
const PORT = parseInt(process.env.PORT || '8443', 10)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function sendJson(res, obj, code = 200) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

const server = http.createServer(async (req, res) => {
  const url = String(req.url || '/').split('?')[0]

  if (url === '/api/health') return sendJson(res, { ok: true })
  if (url === '/api/bootstrap') {
    try {
      const buf = await readFile(path.join(dist, 'bootstrap.json'))
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(buf)
    } catch {
      return sendJson(res, { error: 'bootstrap.json 이 없어요. 먼저 pnpm build 를 실행하세요.' }, 500)
    }
  }

  // 정적 파일 (없으면 SPA 폴백)
  let file = path.join(dist, url === '/' ? 'index.html' : decodeURIComponent(url))
  if (!file.startsWith(dist)) file = path.join(dist, 'index.html') // 경로 탈출 방지
  try {
    const s = await stat(file)
    if (s.isDirectory()) file = path.join(file, 'index.html')
    const buf = await readFile(file)
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
    return res.end(buf)
  } catch {
    try {
      const html = await readFile(path.join(dist, 'index.html'))
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end(html)
    } catch {
      res.statusCode = 404
      return res.end('Not found')
    }
  }
})

server.listen(PORT, () => {
  console.log(`Agent Flow server → http://localhost:${PORT}  (API: /api/bootstrap)`)
})
