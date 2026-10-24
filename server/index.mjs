#!/usr/bin/env node
// Spero website server: serves the static site, the admin UI (/admin/) and the admin API (/api/admin/*).
//   node server/index.mjs            -> http://127.0.0.1:8078
// Env: PORT, HOST (default 127.0.0.1; set 0.0.0.0 only behind HTTPS), COOKIE_SECURE=true when served over HTTPS.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readEnv } from '../scripts/lib/env.mjs'
import { init, close } from '../scripts/lib/db.mjs'
import { handleApi } from './api.mjs'

const PORT = Number(readEnv('PORT') || 8078), HOST = readEnv('HOST') || '127.0.0.1'
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}
// never served: source, secrets, data store
const BLOCKED = /^\/(server|scripts|docs|data|\.git|node_modules)(\/|$)|^\/\.env|^\/package(-lock)?\.json$|^\/README\.md$/i

function serveFile(req, res, file, extra = {}) {
  const ext = path.extname(file).toLowerCase(), type = MIME[ext]
  if (!type) return notFound(res)
  const st = fs.statSync(file)
  const cache = ext === '.html' ? 'no-cache' : /\/(images|_next)\//.test(file) ? 'public, max-age=3600' : 'no-cache'
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...extra })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}
function notFound(res) {
  const f = path.join(ROOT, '404.html')
  const body = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.from('<!doctype html><meta charset="utf-8"><title>404</title><p style="font:16px system-ui;padding:3rem">404 — Halaman tidak ditemukan. <a href="/">Beranda</a></p>')
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body)
}
const ADMIN_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"

try { await init() } catch (e) { console.error(`\n[db] ${e.message}\n`); process.exit(1) }
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (url.pathname.startsWith('/api/admin')) return handleApi(req, res, url)
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end() }

    let pathname
    try { pathname = decodeURIComponent(url.pathname) } catch { return notFound(res) }
    if (pathname.includes('\0') || BLOCKED.test(pathname)) return notFound(res)
    let file = path.normalize(path.join(ROOT, pathname))
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return notFound(res)   // path traversal
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' + url.search }); return res.end() }
      file = path.join(file, 'index.html')
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound(res)
    const isAdmin = pathname.startsWith('/admin')
    return serveFile(req, res, file, isAdmin ? { 'Content-Security-Policy': ADMIN_CSP, 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' } : {})
  } catch (err) {
    console.error('[server]', err)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Server error')
  }
})
server.listen(PORT, HOST, () => console.log(`Spero site  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}   admin: /admin/   (database: PostgreSQL)`))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(async () => { await close(); process.exit(0) }))
