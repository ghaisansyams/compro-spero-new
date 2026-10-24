// Instagram -> store sync (Apify apify/instagram-post-scraper). Used by the CLI and by the admin API.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readEnv, loadStore, saveStore, detectCategory, toTitle, toExcerpt, toSlug } from './updates.mjs'

const ACTOR = 'https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items'
const TIMEOUT_MS = 120_000

async function fetchApify(username, limit) {
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
    throw new Error(err && err.name === 'AbortError' ? `Apify tidak menjawab dalam ${TIMEOUT_MS / 1000} detik.` : err.message)
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

/** @param {{username?:string, limit?:number, publish?:boolean, from?:any[]}} o  `from` = already-fetched dataset (tests/exports) */
export async function syncInstagram(o = {}) {
  const username = (o.username || readEnv('INSTAGRAM_USERNAME') || 'spero_id').replace(/^@/, '')
  const limit = Number(o.limit || readEnv('INSTAGRAM_LIMIT') || 12)
  const skipVideo = readEnv('INSTAGRAM_SKIP_VIDEO') === 'true'
  const raw = o.from ?? await fetchApify(username, limit)
  const posts = (Array.isArray(raw) ? raw : []).filter((p) => p && !p.error)
  // Nol postingan = kegagalan, bukan sukses yang kosong: data yang sudah tersimpan tetap utuh.
  if (!posts.length) throw new Error('Apify tidak mengembalikan satu postingan pun.')

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
    const fresh = {
      key, source: 'instagram', slug: toSlug(caption, code), title: toTitle(caption), excerpt: toExcerpt(caption), caption,
      imageUrl: `/${img.rel}`, postUrl: p.url || `https://www.instagram.com/p/${code}/`,
      publishedAt: (p.timestamp || new Date().toISOString()).slice(0, 10), category: detectCategory(caption),
      username: p.ownerUsername || username, type: p.type || 'Image',
    }
    if (old) {
      // isi yang sudah diedit admin tidak ditimpa sinkron; status terbit/sembunyi juga tidak disentuh
      if (old.edited) Object.assign(old, { imageUrl: fresh.imageUrl, postUrl: fresh.postUrl, type: fresh.type })
      else Object.assign(old, fresh)
    } else {
      const item = { ...fresh, published: !!o.publish, visible: true }
      store.items.push(item); byKey.set(key, item); if (!item.published) report.drafts++
    }
    report.saved++; img.uploaded ? report.uploaded++ : report.reused++; report.titles.push(fresh.title)
  }
  store.account = username; store.updatedAt = new Date().toISOString()
  saveStore(store)
  return report
}
