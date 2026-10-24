#!/usr/bin/env node
/**
 * Instagram -> halaman Update (cara kerja sama dengan Kelas Bermain).
 *
 *   node scripts/instagram-sync.mjs                 # ambil lewat Apify, simpan, bangun halaman
 *   node scripts/instagram-sync.mjs --from dump.json   # pakai hasil export Apify (tanpa API)
 *   node scripts/instagram-sync.mjs --publish       # postingan baru langsung tayang (bawaan: DRAF)
 *
 * Dua keputusan yang sama dengan Kelas Bermain:
 *  1. Postingan baru masuk sebagai DRAF. Tayang setelah Anda menjalankan
 *       node scripts/instagram-publish.mjs publish <slug|all>
 *     Postingan yang sudah diterbitkan/disembunyikan tidak diubah statusnya oleh sinkron berikutnya.
 *  2. Gambar disalin ke images/instagram/ (URL CDN Instagram kedaluwarsa dan kena 403 bila ditautkan).
 *
 * Actor: apify/instagram-post-scraper. Tidak ada login Instagram; hanya postingan publik.
 * Env (.env.local atau environment): APIFY_TOKEN, INSTAGRAM_USERNAME, INSTAGRAM_LIMIT, INSTAGRAM_SKIP_VIDEO.
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readEnv, loadStore, saveStore, detectCategory, toTitle, toExcerpt, toSlug, buildUpdates } from './lib/updates.mjs'

const ACTOR = 'https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items'
const TIMEOUT_MS = 120_000
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d }
const flag = (n) => process.argv.includes(`--${n}`)

const username = (readEnv('INSTAGRAM_USERNAME') || 'spero_id').replace(/^@/, '')
const limit = Number(readEnv('INSTAGRAM_LIMIT') || 12)
const skipVideo = readEnv('INSTAGRAM_SKIP_VIDEO') === 'true'

async function fetchApify() {
  const token = readEnv('APIFY_TOKEN')
  if (!token) throw new Error('APIFY_TOKEN belum diatur (taruh di .env.local).')
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(ACTOR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: [username], resultsLimit: limit, skipPinnedPosts: false, dataDetailLevel: 'basicData' }),
      signal: ctl.signal,
    })
    if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200) || 'tanpa detail'}`)
    const data = await res.json()
    if (!Array.isArray(data)) throw new Error('Format balasan Apify tidak dikenali.')
    return data
  } catch (err) {
    throw new Error(String(err.name) === 'AbortError' ? `Apify tidak menjawab dalam ${TIMEOUT_MS / 1000} detik.` : err.message)
  } finally { clearTimeout(timer) }
}

async function saveImage(url, code) {
  const rel = `images/instagram/${code}.jpg`, file = path.join(ROOT, rel)
  if (fs.existsSync(file)) return { rel, uploaded: false }       // gambar lama tidak berubah; jangan unduh ulang
  const res = await fetch(url).catch(() => null)
  if (!res?.ok) return null
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return { rel, uploaded: true }
}

let posts
try {
  posts = arg('from') ? JSON.parse(fs.readFileSync(path.resolve(arg('from')), 'utf8')) : await fetchApify()
} catch (err) { console.error(`[instagram] sinkron gagal: ${err.message}`); process.exit(1) }
posts = (Array.isArray(posts) ? posts : []).filter((p) => p && !p.error)
// Nol postingan = kegagalan, bukan sukses yang kosong: data yang sudah tersimpan tetap utuh.
if (!posts.length) { console.error('[instagram] sinkron gagal: Apify tidak mengembalikan satu postingan pun.'); process.exit(1) }

const store = loadStore()
const byKey = new Map(store.items.map((i) => [i.key, i]))
const report = { scanned: posts.length, saved: 0, skipped: 0, uploaded: 0, reused: 0, drafts: 0, titles: [] }

for (const p of posts) {
  const code = (p.shortCode || '').trim(), caption = (p.caption || '').trim()
  if (!code || !/^[\w-]+$/.test(code) || !caption || !p.displayUrl) { report.skipped++; continue }
  if (skipVideo && p.type && p.type !== 'Image') { report.skipped++; continue }
  const img = await saveImage(p.displayUrl, code)
  if (!img) { report.skipped++; continue }
  const key = `ig-${code}`, old = byKey.get(key)
  const item = {
    key, slug: toSlug(caption, code), title: toTitle(caption), excerpt: toExcerpt(caption), caption,
    imageUrl: `/${img.rel}`, postUrl: p.url || `https://www.instagram.com/p/${code}/`,
    publishedAt: (p.timestamp || new Date().toISOString()).slice(0, 10), category: detectCategory(caption),
    username: p.ownerUsername || username, type: p.type || 'Image',
    // status admin tidak disentuh oleh sinkron berikutnya
    published: old ? old.published : flag('publish'), visible: old ? old.visible : true,
  }
  if (old) Object.assign(old, item); else { store.items.push(item); byKey.set(key, item); if (!item.published) report.drafts++ }
  report.saved++; img.uploaded ? report.uploaded++ : report.reused++; report.titles.push(item.title)
}
store.account = username; store.updatedAt = new Date().toISOString()
saveStore(store)
console.log(`[instagram] ${report.saved} tersimpan, ${report.skipped} dilewati, ${report.uploaded} gambar baru, ${report.reused} dipakai ulang`)
const built = buildUpdates()
console.log(`[update] ${built.published} postingan tayang, ${built.detail} halaman detail dibuat`)
if (report.drafts) console.log(`\n${report.drafts} postingan baru masuk sebagai DRAF. Terbitkan dengan:\n  node scripts/instagram-publish.mjs list\n  node scripts/instagram-publish.mjs publish all`)
