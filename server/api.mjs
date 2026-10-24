// Admin JSON API. Every route except login/me requires a valid session; mutations are role-checked and logged.
import crypto from 'node:crypto'
import { loadStore, saveStore, toSlug, CATEGORIES, readEnv } from '../scripts/lib/updates.mjs'
import { loadContent, saveContent, dirty, buildSite } from '../scripts/lib/site.mjs'
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
const cleaners = { team: cleanTeam, clients: cleanClients, contact: cleanContact }

function rebuild(user, why) {
  try { return buildSite() } catch (err) { console.error('[build]', err); logActivity(user, 'build.gagal', why, err.message); throw fail(500, 'Konten tersimpan, tetapi halaman gagal dibangun ulang.') }
}
const itemView = (i) => ({ key: i.key, source: i.source || 'instagram', slug: i.slug, title: i.title, excerpt: i.excerpt, caption: i.caption, category: i.category, publishedAt: i.publishedAt, imageUrl: i.imageUrl, postUrl: i.postUrl, type: i.type, published: !!i.published, visible: i.visible !== false, edited: !!i.edited })
let syncing = false

/* ---------- router ---------- */
export async function handleApi(req, res, url) {
  const ip = req.socket.remoteAddress || '?', method = req.method, p = url.pathname.replace(/^\/api\/admin/, '') || '/'
  try {
    if (method !== 'GET' && method !== 'HEAD') {
      const o = req.headers.origin
      if (o) { let host; try { host = new URL(o).host } catch { host = '' } if (host !== req.headers.host) throw fail(403, 'Origin tidak diizinkan.') }
    }
    if (p === '/login' && method === 'POST') {
      const b = await readBody(req), u = await login(ip, b.username, b.password)
      logActivity(u, 'login'); return send(res, 200, { user: publicUser(u) }, { 'Set-Cookie': cookieHeader(makeToken(u)) })
    }
    const user = userFromCookie(req.headers.cookie)
    if (p === '/me' && method === 'GET') return user ? send(res, 200, { user: publicUser(user) }) : send(res, 401, { error: 'Belum masuk.' })
    if (!user) throw fail(401, 'Sesi berakhir. Silakan masuk lagi.')
    const admin = user.role === 'admin', need = () => { if (!admin) throw fail(403, 'Hanya admin yang boleh melakukan ini.') }
    const body = method === 'GET' || method === 'DELETE' ? {} : await readBody(req)
    let m

    if (p === '/logout' && method === 'POST') { logActivity(user, 'logout'); return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() }) }
    if (p === '/me/password' && method === 'POST') {
      if (!(await checkPassword(user, body.current))) throw fail(400, 'Kata sandi saat ini salah.')
      if (!validPassword(body.next)) throw fail(400, 'Kata sandi baru minimal 10 karakter.')
      await setPassword(user.id, body.next); logActivity(user, 'password.ganti')
      const fresh = loadUsers().users.find((x) => x.id === user.id)
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(makeToken(fresh)) })
    }

    /* summary */
    if (p === '/summary' && method === 'GET') {
      const s = loadStore(), c = loadContent()
      return send(res, 200, {
        updates: { total: s.items.length, published: s.items.filter((i) => i.published && i.visible !== false).length, drafts: s.items.filter((i) => !i.published).length, hidden: s.items.filter((i) => i.published && i.visible === false).length, lastSync: s.updatedAt, account: s.account },
        team: { count: c.team.published.length, dirty: dirty(c, 'team') }, clients: { count: c.clients.published.length, dirty: dirty(c, 'clients') }, contact: { dirty: dirty(c, 'contact') },
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
        const built = rebuild(user, 'sync'); logActivity(user, 'instagram.sinkron', `${report.saved} tersimpan`, `${report.drafts} draf baru`)
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
      s.items.push(item); saveStore(s); logActivity(user, 'update.buat', item.slug); rebuild(user, 'update.buat')
      return send(res, 201, { item: itemView(item) })
    }
    if ((m = p.match(/^\/updates\/([\w-]+)$/))) {
      const s = loadStore(), it = s.items.find((i) => i.key === m[1])
      if (!it) throw fail(404, 'Update tidak ditemukan.')
      if (method === 'DELETE') {
        if (it.source !== 'manual') throw fail(400, 'Postingan Instagram tidak dihapus; sembunyikan saja agar tidak muncul lagi saat sinkron.')
        s.items = s.items.filter((i) => i !== it); saveStore(s); logActivity(user, 'update.hapus', it.slug); rebuild(user, 'update.hapus')
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
        saveStore(s); logActivity(user, 'update.ubah', it.slug, Object.keys(set).join(',')); rebuild(user, 'update.ubah')
        return send(res, 200, { item: itemView(it) })
      }
    }

    /* team / clients / contact: draft -> publish */
    if ((m = p.match(/^\/(team|clients|contact)$/)) && method === 'GET') {
      const c = loadContent(); return send(res, 200, { draft: c[m[1]].draft, published: c[m[1]].published, dirty: dirty(c, m[1]) })
    }
    if ((m = p.match(/^\/(team|clients|contact)$/)) && method === 'PUT') {
      const c = loadContent(); c[m[1]].draft = cleaners[m[1]](m[1] === 'contact' ? body : body.items)
      saveContent(c); logActivity(user, `${m[1]}.simpan-draf`); return send(res, 200, { draft: c[m[1]].draft, dirty: dirty(c, m[1]) })
    }
    if ((m = p.match(/^\/(team|clients|contact)\/(publish|discard)$/)) && method === 'POST') {
      const c = loadContent(), k = m[1]
      if (m[2] === 'publish') { c[k].published = JSON.parse(JSON.stringify(c[k].draft)); saveContent(c); rebuild(user, `${k}.terbit`) }
      else { c[k].draft = JSON.parse(JSON.stringify(c[k].published)); saveContent(c) }
      logActivity(user, `${k}.${m[2] === 'publish' ? 'terbitkan' : 'buang-draf'}`); return send(res, 200, { draft: c[k].draft, published: c[k].published, dirty: dirty(c, k) })
    }

    /* media */
    if (p === '/media' && method === 'GET') return send(res, 200, { items: listMedia() })
    if (p === '/media' && method === 'POST') {
      let f; try { f = saveUpload(body.data) } catch (err) { throw fail(400, err.message) }
      logActivity(user, 'media.unggah', f.name); return send(res, 201, f)
    }
    if ((m = p.match(/^\/media\/([\w.-]+)$/)) && method === 'DELETE') {
      const c = loadContent(), s = loadStore(), url = `/images/uploads/${m[1]}`
      const used = [...c.team.draft, ...c.team.published].some((t) => t.photo === url) || s.items.some((i) => i.imageUrl === url)
      if (used) throw fail(409, 'Gambar ini masih dipakai (tim atau update).')
      try { deleteMedia(m[1]) } catch (err) { throw fail(400, err.message) }
      logActivity(user, 'media.hapus', m[1]); return send(res, 200, { ok: true })
    }

    /* admin only */
    if (p === '/rebuild' && method === 'POST') { need(); const r = rebuild(user, 'manual'); logActivity(user, 'situs.bangun-ulang'); return send(res, 200, r) }
    if (p === '/activity' && method === 'GET') { need(); return send(res, 200, { items: readActivity(200) }) }
    if (p === '/users' && method === 'GET') { need(); return send(res, 200, { users: loadUsers().users.map(publicUser) }) }
    if (p === '/users' && method === 'POST') {
      need()
      const u = await createUser({ username: String(body.username || '').toLowerCase(), name: body.name, role: body.role, password: body.password }).catch((err) => { throw fail(400, err.message) })
      logActivity(user, 'pengguna.buat', u.username, u.role); return send(res, 201, { user: publicUser(u) })
    }
    if ((m = p.match(/^\/users\/([\w-]+)$/))) {
      need()
      const d = loadUsers(), u = d.users.find((x) => x.id === m[1])
      if (!u) throw fail(404, 'Pengguna tidak ditemukan.')
      const otherAdmins = d.users.filter((x) => x.role === 'admin' && !x.disabled && x.id !== u.id).length
      if (method === 'DELETE') {
        if (u.id === user.id) throw fail(400, 'Anda tidak bisa menghapus akun sendiri.')
        if (u.role === 'admin' && !otherAdmins) throw fail(400, 'Harus tersisa minimal satu admin aktif.')
        d.users = d.users.filter((x) => x !== u); saveUsers(d); logActivity(user, 'pengguna.hapus', u.username); return send(res, 200, { ok: true })
      }
      if (method === 'PATCH') {
        if ('role' in body) { if (!ROLES.includes(body.role)) throw fail(400, 'Peran tidak valid.'); if (u.role === 'admin' && body.role !== 'admin' && !otherAdmins) throw fail(400, 'Harus tersisa minimal satu admin aktif.'); u.role = body.role }
        if ('disabled' in body) { if (body.disabled && u.id === user.id) throw fail(400, 'Anda tidak bisa menonaktifkan akun sendiri.'); if (body.disabled && u.role === 'admin' && !otherAdmins) throw fail(400, 'Harus tersisa minimal satu admin aktif.'); u.disabled = !!body.disabled }
        if ('name' in body) u.name = str(body.name, 1, 80, 'Nama')
        saveUsers(d)
        if (body.password) await setPassword(u.id, body.password).catch((err) => { throw fail(400, err.message) })
        logActivity(user, 'pengguna.ubah', u.username, Object.keys(body).filter((k) => k !== 'password').join(',') + (body.password ? ',password' : ''))
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
