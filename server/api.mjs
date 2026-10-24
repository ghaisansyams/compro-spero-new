// Admin JSON API. Every route except login/me requires a valid session; mutations are role-checked and logged.
import crypto from 'node:crypto'
import { loadStore, saveStore, toSlug, CATEGORIES, readEnv } from '../scripts/lib/updates.mjs'
import { flush, refresh } from '../scripts/lib/db.mjs'
import { loadContent, saveContent, dirty, buildSite, col, COLLECTIONS, PAGE_KEYS, saveVersion, listVersions, getVersion, diffSummary, previewPage, ensureBaselineVersions } from '../scripts/lib/site.mjs'
import { SECTIONS, PAGES, ILLUSTRATIONS, cleanPage, cleanHref, newSection } from '../scripts/lib/schema.mjs'
import { cleanTheme, presetTheme, PRESETS, LIGHT_KEYS, DARK_KEYS } from '../scripts/lib/theme.mjs'
import { syncInstagram } from '../scripts/lib/instagram.mjs'
import {
  loadUsers, saveUsers, publicUser, createUser, setPassword, checkPassword, validPassword, ROLES,
  login, makeToken, cookieHeader, clearCookie, userFromCookie,
} from './auth.mjs'
import { logActivity, readActivity, saveUpload, listMedia, deleteMedia } from './store.mjs'

const MAX_BODY = 8 * 1024 * 1024
const send = (res, status, body, headers = {}) => {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers })
  res.end(data)
}
const fail = (status, message) => Object.assign(new Error(message), { status })

async function readBody(req) {
  const chunks = []; let n = 0
  for await (const c of req) { n += c.length; if (n > MAX_BODY) throw fail(413, 'Permintaan terlalu besar.'); chunks.push(c) }
  if (!n) return {}
  if (!String(req.headers['content-type'] || '').includes('application/json')) throw fail(415, 'Content-Type harus application/json.')
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw fail(400, 'JSON tidak valid.') }
}

/* ---------- validators ---------- */
const str = (v, min, max, label) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < min || s.length > max) throw fail(400, `${label} harus ${min}-${max} karakter.`)
  return s
}
const PHOTO = /^\/images\/(team|uploads|instagram)\/[\w.-]+\.(jpg|png|webp)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
function cleanTeam(v) {
  if (!Array.isArray(v) || v.length > 40) throw fail(400, 'Daftar tim tidak valid (maks. 40 orang).')
  return v.map((m, i) => {
    if (!PHOTO.test(m?.photo || '')) throw fail(400, `Foto anggota #${i + 1} tidak valid. Unggah lewat Media.`)
    return { id: /^[\w-]{1,40}$/.test(m.id || '') ? m.id : crypto.randomBytes(4).toString('hex'), name: str(m.name, 1, 80, `Nama #${i + 1}`), role: str(m.role ?? '', 0, 60, `Jabatan #${i + 1}`), photo: m.photo }
  })
}
function cleanClients(v) {
  if (!Array.isArray(v) || v.length > 300) throw fail(400, 'Daftar klien tidak valid (maks. 300).')
  const seen = new Set(), out = []
  for (const n of v) { const s = str(n, 1, 80, 'Nama klien'); if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s) } }
  return out
}
function cleanContact(v) {
  const email = str(v?.email, 5, 120, 'Email')
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) throw fail(400, 'Format email tidak valid.')
  const phones = (Array.isArray(v.phones) ? v.phones : []).map((p) => String(p).trim()).filter(Boolean)
  if (phones.length > 4 || phones.some((p) => !/^[+\d\s()-]{6,24}$/.test(p))) throw fail(400, 'Nomor telepon tidak valid (maks. 4).')
  const address = String(v.address ?? '').replace(/\r/g, '').trim()
  if (address.length > 300 || address.split('\n').length > 6) throw fail(400, 'Alamat terlalu panjang.')
  const instagram = String(v.instagram ?? '').trim().replace(/^@/, '')
  if (!/^[A-Za-z0-9_.]{1,30}$/.test(instagram)) throw fail(400, 'Username Instagram tidak valid.')
  return { email, phones, address, instagram }
}
const IMG = /^\/images\/(work|uploads|instagram|team)\/[\w./-]+\.(jpg|jpeg|png|webp)$/
const SITE_IMG = /^\/[\w./-]+\.(png|jpg|jpeg|webp|ico)$/
const i18n = (v, max, label, min = 0) => ({ en: str(v?.en ?? '', min, max, label), id: str(v?.id ?? '', 0, max, label) })
function cleanSite(v) {
  const img = (x, label, req) => { const t = String(x ?? '').trim(); if (!t && !req) return ''; if (!SITE_IMG.test(t) || t.includes('..')) throw fail(400, `${label}: pilih gambar dari Media.`); return t }
  const siteUrl = String(v?.siteUrl ?? '').trim().replace(/\/$/, '')
  if (siteUrl && !/^https:\/\/[\w.-]+(:\d+)?$/.test(siteUrl)) throw fail(400, 'Alamat situs harus berformat https://domain.com (tanpa path).')
  return {
    name: str(v?.name, 1, 80, 'Nama situs'), copyrightName: str(v?.copyrightName || v?.name, 1, 80, 'Nama hak cipta'),
    tagline: i18n(v?.tagline, 200, 'Tagline footer'), footerRight: i18n(v?.footerRight, 200, 'Teks kanan footer'),
    cta: { label: i18n(v?.cta?.label, 40, 'Tombol header'), href: cleanHref(v?.cta?.href, 'Tautan tombol header') },
    logoLight: img(v?.logoLight, 'Logo terang', true), logoDark: img(v?.logoDark, 'Logo gelap', true), favicon: img(v?.favicon, 'Favicon PNG'), faviconIco: img(v?.faviconIco, 'Favicon ICO'),
    siteUrl, ogImage: img(v?.ogImage, 'Gambar berbagi (OG)'),
  }
}
function cleanNav(v) {
  const items = Array.isArray(v?.items) ? v.items : null
  if (!items || items.length > 12) throw fail(400, 'Menu maksimal 12 butir.')
  const seen = new Set()
  return { items: items.map((it, i) => {
    let id = /^[\w-]{1,30}$/.test(it?.id || '') ? it.id : `n${i + 1}`; while (seen.has(id)) id += 'x'; seen.add(id)
    const href = cleanHref(it?.href, `Menu #${i + 1}`); if (!href) throw fail(400, `Menu #${i + 1}: tautan wajib diisi.`)
    return { id, label: i18n(it?.label, 40, `Label menu #${i + 1}`, 1), href, visible: it?.visible !== false }
  }) }
}
function cleanPortfolio(v) {
  if (!Array.isArray(v) || v.length > 80) throw fail(400, 'Daftar karya tidak valid (maks. 80).')
  const ids = new Set()
  return v.map((p, i) => {
    const L = `Karya #${i + 1}`
    const id = String(p?.id ?? '').trim(); if (!/^[a-z0-9-]{2,50}$/.test(id)) throw fail(400, `${L}: ID hanya huruf kecil, angka, strip (2-50).`); if (ids.has(id)) throw fail(400, `${L}: ID “${id}” dobel.`); ids.add(id)
    const kind = p.kind === 'flagship' ? 'flagship' : 'more'
    const cat = kind === 'flagship' ? 'products' : (['3d', 'games'].includes(p.cat) ? p.cat : '3d')
    const url = (x, l) => { const t = String(x ?? '').trim(); if (t && !/^https:\/\/[^\s"<>]+$/.test(t)) throw fail(400, `${L}: ${l} harus berupa https://…`); return t }
    const tech = (Array.isArray(p.tech) ? p.tech : []).map((t) => str(t, 1, 40, `${L}: teknologi`)); if (tech.length > 12) throw fail(400, `${L}: maksimal 12 teknologi.`)
    const stats = (Array.isArray(p.stats) ? p.stats : []).map((s) => ({ label: str(s?.label, 1, 24, `${L}: label metrik`), value: str(s?.value, 1, 12, `${L}: nilai metrik`) })); if (stats.length > 4) throw fail(400, `${L}: maksimal 4 metrik.`)
    const images = (Array.isArray(p.images) ? p.images : []).map((im) => { if (!IMG.test(im?.src || '') || im.src.includes('..')) throw fail(400, `${L}: gambar tidak valid.`); return { src: im.src, label: str(im.label || p.name, 1, 60, `${L}: label gambar`) } })
    if (!images.length || images.length > 12) throw fail(400, `${L}: 1-12 gambar.`)
    const color = /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : '#006ce5'
    return { id, kind, name: str(p.name, 1, 80, `${L}: nama`), subtitle: str(p.subtitle ?? '', 0, 120, `${L}: subjudul`), year: str(p.year ?? '', 0, 10, `${L}: tahun`), role: str(p.role ?? '', 0, 60, `${L}: peran`), color,
      live: url(p.live, 'Link demo'), github: url(p.github, 'Link GitHub'), private: !!p.private, desc: str(p.desc, 1, 2500, `${L}: deskripsi`), tech, stats, images, cat }
  })
}
const cleaners = { team: cleanTeam, clients: cleanClients, contact: cleanContact, site: cleanSite, nav: cleanNav, theme: cleanTheme, portfolio: cleanPortfolio }
const cleanFor = (key) => (key.startsWith('page:') ? cleanPage : cleaners[key])

async function rebuild(user, why) {
  await flush()   // simpan ke Postgres dulu; halaman baru dibangun dari data yang sudah tersimpan
  try { return buildSite() } catch (err) { console.error('[build]', err); await logActivity(user, 'build.gagal', why, err.message); throw fail(500, 'Konten tersimpan, tetapi halaman gagal dibangun ulang.') }
}
const itemView = (i) => ({ key: i.key, source: i.source || 'instagram', slug: i.slug, title: i.title, excerpt: i.excerpt, caption: i.caption, category: i.category, publishedAt: i.publishedAt, imageUrl: i.imageUrl, postUrl: i.postUrl, type: i.type, published: !!i.published, visible: i.visible !== false, edited: !!i.edited })
let syncing = false

/* ---------- router ---------- */
let chain = Promise.resolve()
/** Requests run one at a time: refresh the cache from Postgres, handle, then write changed rows back. */
export function handleApi(req, res, url) {
  const run = chain.then(async () => {
    try { await refresh() } catch (e) { console.error('[db]', e.message); return send(res, 503, { error: 'Database tidak dapat dijangkau.' }) }
    await handle(req, res, url)
    if (req.method !== 'GET' && req.method !== 'HEAD') { try { await flush() } catch (e) { console.error('[db] flush gagal:', e.message) } }
  })
  chain = run.catch(() => {})
  return run
}
async function handle(req, res, url) {
  const ip = req.socket.remoteAddress || '?', method = req.method, p = url.pathname.replace(/^\/api\/admin/, '') || '/'
  try {
    if (method !== 'GET' && method !== 'HEAD') {
      const o = req.headers.origin
      if (o) { let host; try { host = new URL(o).host } catch { host = '' } if (host !== req.headers.host) throw fail(403, 'Origin tidak diizinkan.') }
    }
    if (p === '/login' && method === 'POST') {
      const b = await readBody(req), u = await login(ip, b.username, b.password)
      await logActivity(u, 'login'); return send(res, 200, { user: publicUser(u) }, { 'Set-Cookie': cookieHeader(makeToken(u)) })
    }
    const user = userFromCookie(req.headers.cookie)
    if (p === '/me' && method === 'GET') return user ? send(res, 200, { user: publicUser(user) }) : send(res, 401, { error: 'Belum masuk.' })
    if (!user) throw fail(401, 'Sesi berakhir. Silakan masuk lagi.')
    const admin = user.role === 'admin', need = () => { if (!admin) throw fail(403, 'Hanya admin yang boleh melakukan ini.') }
    const body = method === 'GET' || method === 'DELETE' ? {} : await readBody(req)
    let m

    if (p === '/logout' && method === 'POST') { await logActivity(user, 'logout'); return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() }) }
    if (p === '/me/password' && method === 'POST') {
      if (!(await checkPassword(user, body.current))) throw fail(400, 'Kata sandi saat ini salah.')
      if (!validPassword(body.next)) throw fail(400, 'Kata sandi baru minimal 10 karakter.')
      await setPassword(user.id, body.next); await logActivity(user, 'password.ganti')
      const fresh = loadUsers().users.find((x) => x.id === user.id)
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(makeToken(fresh)) })
    }

    /* summary */
    if (p === '/summary' && method === 'GET') {
      const s = loadStore(), c = loadContent()
      return send(res, 200, {
        updates: { total: s.items.length, published: s.items.filter((i) => i.published && i.visible !== false).length, drafts: s.items.filter((i) => !i.published).length, hidden: s.items.filter((i) => i.published && i.visible === false).length, lastSync: s.updatedAt, account: s.account },
        team: { count: c.team.published.length, dirty: dirty(c, 'team') }, clients: { count: c.clients.published.length, dirty: dirty(c, 'clients') }, contact: { dirty: dirty(c, 'contact') }, projects: c.portfolio.published.length, pending: COLLECTIONS.filter((k) => dirty(c, k)),
        media: listMedia().length, apify: !!readEnv('APIFY_TOKEN'),
      })
    }

    /* updates */
    if (p === '/updates' && method === 'GET') {
      const s = loadStore()
      return send(res, 200, { account: s.account, updatedAt: s.updatedAt, categories: CATEGORIES, items: [...s.items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(itemView) })
    }
    if (p === '/updates/sync' && method === 'POST') {
      if (syncing) throw fail(409, 'Sinkron sedang berjalan.')
      syncing = true
      try {
        const c = loadContent()
        const report = await syncInstagram({ username: c.contact.published.instagram, publish: false })
        const built = await rebuild(user, 'sync'); await logActivity(user, 'instagram.sinkron', `${report.saved} tersimpan`, `${report.drafts} draf baru`)
        return send(res, 200, { report, built })
      } catch (err) { throw err.status ? err : fail(502, err.message) } finally { syncing = false }
    }
    if (p === '/updates' && method === 'POST') {
      const s = loadStore(), title = str(body.title, 1, 120, 'Judul'), caption = str(body.caption, 1, 5000, 'Isi')
      if (!CATEGORIES.includes(body.category)) throw fail(400, 'Kategori tidak valid.')
      if (!PHOTO.test(body.imageUrl || '')) throw fail(400, 'Pilih atau unggah gambar.')
      const date = body.publishedAt && DATE.test(body.publishedAt) ? body.publishedAt : new Date().toISOString().slice(0, 10)
      const id = crypto.randomBytes(3).toString('hex'), clean = caption.replace(/\s+/g, ' ')
      const item = { key: `manual-${id}`, source: 'manual', slug: toSlug(title, `m${id}x`), title, excerpt: str(body.excerpt || (clean.length > 180 ? `${clean.slice(0, 180).trimEnd()}…` : clean), 1, 240, 'Ringkasan'), caption, imageUrl: body.imageUrl, postUrl: '', publishedAt: date, category: body.category, username: s.account || 'spero_id', type: 'Image', published: false, visible: true, edited: true }
      s.items.push(item); saveStore(s); await logActivity(user, 'update.buat', item.slug); await rebuild(user, 'update.buat')
      return send(res, 201, { item: itemView(item) })
    }
    if ((m = p.match(/^\/updates\/([\w-]+)$/))) {
      const s = loadStore(), it = s.items.find((i) => i.key === m[1])
      if (!it) throw fail(404, 'Update tidak ditemukan.')
      if (method === 'DELETE') {
        if (it.source !== 'manual') throw fail(400, 'Postingan Instagram tidak dihapus; sembunyikan saja agar tidak muncul lagi saat sinkron.')
        s.items = s.items.filter((i) => i !== it); saveStore(s); await logActivity(user, 'update.hapus', it.slug); await rebuild(user, 'update.hapus')
        return send(res, 200, { ok: true })
      }
      if (method === 'PATCH') {
        const set = {}
        if ('title' in body) set.title = str(body.title, 1, 120, 'Judul')
        if ('excerpt' in body) set.excerpt = str(body.excerpt, 1, 240, 'Ringkasan')
        if ('caption' in body) set.caption = str(body.caption, 1, 5000, 'Isi')
        if ('category' in body) { if (!CATEGORIES.includes(body.category)) throw fail(400, 'Kategori tidak valid.'); set.category = body.category }
        if ('publishedAt' in body) { if (!DATE.test(body.publishedAt)) throw fail(400, 'Tanggal tidak valid.'); set.publishedAt = body.publishedAt }
        if ('imageUrl' in body) { if (!PHOTO.test(body.imageUrl)) throw fail(400, 'Gambar tidak valid.'); set.imageUrl = body.imageUrl }
        if ('postUrl' in body) { if (body.postUrl && !/^https:\/\/(www\.)?instagram\.com\/[\w./?=&-]*$/.test(body.postUrl)) throw fail(400, 'Link harus berupa URL Instagram.'); set.postUrl = body.postUrl || '' }
        const content = Object.keys(set).length > 0
        if ('published' in body) set.published = !!body.published
        if ('visible' in body) set.visible = !!body.visible
        Object.assign(it, set); if (content) it.edited = true
        saveStore(s); await logActivity(user, 'update.ubah', it.slug, Object.keys(set).join(',')); await rebuild(user, 'update.ubah')
        return send(res, 200, { item: itemView(it) })
      }
    }

    /* schema + generic collections (draft -> publish, versions, preview) */
    if (p === '/schema' && method === 'GET') {
      return send(res, 200, { sections: Object.fromEntries(Object.entries(SECTIONS).map(([k, d]) => [k, { label: d.label, unique: !!d.unique, generated: d.generated || null, fields: d.fields }])),
        illustrations: ILLUSTRATIONS, pages: PAGES, collections: COLLECTIONS, lightKeys: LIGHT_KEYS, darkKeys: DARK_KEYS,
        presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, { label: v.label, theme: presetTheme(k) }])) })
    }
    if (p === '/schema/new-section' && method === 'POST') return send(res, 200, { section: newSection(String(body.type || '')) })
    const keyOf = (raw) => { const k = String(raw).replace(/^page\./, 'page:'); if (!COLLECTIONS.includes(k)) throw fail(404, 'Koleksi tidak ditemukan.'); return k }
    if (p === '/preview' && method === 'GET') {
      const page = url.searchParams.get('page'), lang = url.searchParams.get('lang') === 'id' ? 'id' : 'en'
      const html = previewPage(page, lang); if (!html) throw fail(404, 'Halaman tidak ditemukan.')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "frame-ancestors 'self'" }); return res.end(html)
    }
    if (p === '/content' && method === 'GET') {   // overview: which collections have unpublished changes
      const c = loadContent(); return send(res, 200, { items: COLLECTIONS.map((k) => ({ key: k, dirty: dirty(c, k) })) })
    }
    if ((m = p.match(/^\/content\/([\w.]+)$/)) && method === 'GET') {
      const key = keyOf(m[1]), c = loadContent(), cl = col(c, key), d = dirty(c, key)
      return send(res, 200, { key, draft: cl.draft, published: cl.published, dirty: d, changes: d ? diffSummary(cl.published, cl.draft) : [] })
    }
    if ((m = p.match(/^\/content\/([\w.]+)$/)) && method === 'PUT') {
      const key = keyOf(m[1]), c = loadContent(), cl = col(c, key)
      cl.draft = cleanFor(key)(body.data); saveContent(c); await logActivity(user, `${key}.simpan-draf`)
      return send(res, 200, { draft: cl.draft, dirty: dirty(c, key), changes: dirty(c, key) ? diffSummary(cl.published, cl.draft) : [] })
    }
    if ((m = p.match(/^\/content\/([\w.]+)\/(publish|discard)$/)) && method === 'POST') {
      const key = keyOf(m[1]), c = loadContent(), cl = col(c, key)
      if (m[2] === 'publish') {
        cl.published = JSON.parse(JSON.stringify(cl.draft)); saveContent(c)
        await saveVersion(key, cl.published, user, String(body.note || '').slice(0, 120)); await rebuild(user, `${key}.terbit`)
      } else { cl.draft = JSON.parse(JSON.stringify(cl.published)); saveContent(c) }
      await logActivity(user, `${key}.${m[2] === 'publish' ? 'terbitkan' : 'buang-draf'}`)
      return send(res, 200, { draft: cl.draft, published: cl.published, dirty: dirty(c, key) })
    }
    if ((m = p.match(/^\/versions\/([\w.]+)$/)) && method === 'GET') { await ensureBaselineVersions(); return send(res, 200, { items: await listVersions(keyOf(m[1])) }) }
    if ((m = p.match(/^\/versions\/([\w.]+)\/([\w-]+)$/)) && method === 'GET') {
      const key = keyOf(m[1]), v = await getVersion(key, m[2]); if (!v) throw fail(404, 'Versi tidak ditemukan.')
      return send(res, 200, { id: v.id, ts: v.ts, user: v.user, note: v.note, changes: diffSummary(col(loadContent(), key).published, v.data) })
    }
    if ((m = p.match(/^\/versions\/([\w.]+)\/([\w-]+)\/restore$/)) && method === 'POST') {
      const key = keyOf(m[1]), v = await getVersion(key, m[2]); if (!v) throw fail(404, 'Versi tidak ditemukan.')
      const c = loadContent(), cl = col(c, key); cl.draft = cleanFor(key)(v.data)   // masuk sebagai draf; terbitkan setelah ditinjau
      saveContent(c); await logActivity(user, `${key}.pulihkan`, v.id); return send(res, 200, { draft: cl.draft, dirty: dirty(c, key) })
    }
    if ((m = p.match(/^\/(team|clients|contact)$/))) throw fail(410, 'Rute lama; gunakan /content/:key.')

    /* media */
    if (p === '/media' && method === 'GET') return send(res, 200, { items: listMedia() })
    if (p === '/media' && method === 'POST') {
      let f; try { f = saveUpload(body.data) } catch (err) { throw fail(400, err.message) }
      await logActivity(user, 'media.unggah', f.name); return send(res, 201, f)
    }
    if ((m = p.match(/^\/media\/([\w.-]+)$/)) && method === 'DELETE') {
      const c = loadContent(), s = loadStore(), url = `/images/uploads/${m[1]}`
      const used = JSON.stringify(c).includes(url) || JSON.stringify(s).includes(url)
      if (used) throw fail(409, 'Gambar ini masih dipakai (tim, update, portofolio, atau pengaturan situs).')
      try { deleteMedia(m[1]) } catch (err) { throw fail(400, err.message) }
      await logActivity(user, 'media.hapus', m[1]); return send(res, 200, { ok: true })
    }

    /* admin only */
    if (p === '/rebuild' && method === 'POST') { need(); const r = await rebuild(user, 'manual'); await logActivity(user, 'situs.bangun-ulang'); return send(res, 200, r) }
    if (p === '/activity' && method === 'GET') { need(); return send(res, 200, { items: await readActivity(200) }) }
    if (p === '/users' && method === 'GET') { need(); return send(res, 200, { users: loadUsers().users.map(publicUser) }) }
    if (p === '/users' && method === 'POST') {
      need()
      const u = await createUser({ username: String(body.username || '').toLowerCase(), name: body.name, role: body.role, password: body.password }).catch((err) => { throw fail(400, err.message) })
      await logActivity(user, 'pengguna.buat', u.username, u.role); return send(res, 201, { user: publicUser(u) })
    }
    if ((m = p.match(/^\/users\/([\w-]+)$/))) {
      need()
      const d = loadUsers(), u = d.users.find((x) => x.id === m[1])
      if (!u) throw fail(404, 'Pengguna tidak ditemukan.')
      const otherAdmins = d.users.filter((x) => x.role === 'admin' && !x.disabled && x.id !== u.id).length
      if (method === 'DELETE') {
        if (u.id === user.id) throw fail(400, 'Anda tidak bisa menghapus akun sendiri.')
        if (u.role === 'admin' && !otherAdmins) throw fail(400, 'Harus tersisa minimal satu admin aktif.')
        d.users = d.users.filter((x) => x !== u); saveUsers(d); await logActivity(user, 'pengguna.hapus', u.username); return send(res, 200, { ok: true })
      }
      if (method === 'PATCH') {
        if ('role' in body) { if (!ROLES.includes(body.role)) throw fail(400, 'Peran tidak valid.'); if (u.role === 'admin' && body.role !== 'admin' && !otherAdmins) throw fail(400, 'Harus tersisa minimal satu admin aktif.'); u.role = body.role }
        if ('disabled' in body) { if (body.disabled && u.id === user.id) throw fail(400, 'Anda tidak bisa menonaktifkan akun sendiri.'); if (body.disabled && u.role === 'admin' && !otherAdmins) throw fail(400, 'Harus tersisa minimal satu admin aktif.'); u.disabled = !!body.disabled }
        if ('name' in body) u.name = str(body.name, 1, 80, 'Nama')
        saveUsers(d)
        if (body.password) await setPassword(u.id, body.password).catch((err) => { throw fail(400, err.message) })
        await logActivity(user, 'pengguna.ubah', u.username, Object.keys(body).filter((k) => k !== 'password').join(',') + (body.password ? ',password' : ''))
        return send(res, 200, { user: publicUser(loadUsers().users.find((x) => x.id === u.id)) })
      }
    }
    throw fail(404, 'Rute tidak ditemukan.')
  } catch (err) {
    if (err.status) return send(res, err.status, { error: err.message })
    console.error('[api]', err)
    return send(res, 500, { error: 'Terjadi kesalahan server.' })
  }
}
