// CMS content store (draft -> publish, version history) and the static-site builder.
//   data/content.json   every editable collection as { draft, published }
//   data/versions/…     snapshot of a collection each time it is published (restorable as a draft)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ROOT, loadStore, saveStore, readEnv } from './updates.mjs'
import { PAGE_PATH } from './schema.mjs'
import { themeCss } from './theme.mjs'
import { renderPage, shell, renderMain, esc } from './render.mjs'
import { renderUpdateDetail, publishedUpdates, T_UPDATES } from './updates.mjs'

const CONTENT = path.join(ROOT, 'data/content.json')
const VERSIONS = path.join(ROOT, 'data/versions')
export const PAGE_KEYS = Object.keys(PAGE_PATH)
export const COLLECTIONS = ['site', 'nav', 'theme', 'team', 'clients', 'contact', 'portfolio', ...PAGE_KEYS.map((k) => `page:${k}`)]

export function loadContent() { return JSON.parse(fs.readFileSync(CONTENT, 'utf8')) }
export function saveContent(c) { fs.writeFileSync(CONTENT + '.tmp', JSON.stringify(c, null, 1) + '\n'); fs.renameSync(CONTENT + '.tmp', CONTENT) }
export const col = (c, key) => (key.startsWith('page:') ? c.pages[key.slice(5)] : c[key])
export const dirty = (c, key) => JSON.stringify(col(c, key).draft) !== JSON.stringify(col(c, key).published)
const view = (c, which) => ({ site: c.site[which], nav: c.nav[which], theme: c.theme[which], portfolio: c.portfolio[which], team: c.team[which], clients: c.clients[which], contact: c.contact[which], pages: Object.fromEntries(PAGE_KEYS.map((k) => [k, c.pages[k][which]])) })

/* ---------- versions ---------- */
const vdir = (key) => path.join(VERSIONS, key.replace(/[^\w-]/g, '_'))
export function saveVersion(key, data, user, note = '') {
  const d = vdir(key); fs.mkdirSync(d, { recursive: true })
  const id = `${Date.now()}-${crypto.randomBytes(2).toString('hex')}`
  fs.writeFileSync(path.join(d, id + '.json'), JSON.stringify({ id, ts: new Date().toISOString(), user: user?.username || 'system', key, note, data }))
  const all = fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort()
  for (const f of all.slice(0, Math.max(0, all.length - 40))) fs.unlinkSync(path.join(d, f))   // keep latest 40
  return id
}
export function listVersions(key) {
  const d = vdir(key); if (!fs.existsSync(d)) return []
  return fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => { const v = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); return { id: v.id, ts: v.ts, user: v.user, note: v.note } })
}
export function getVersion(key, id) {
  if (!/^[\w-]+$/.test(id)) return null
  const f = path.join(vdir(key), id + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
}
export function ensureBaselineVersions() {
  const c = loadContent()
  for (const key of COLLECTIONS) if (!listVersions(key).length) saveVersion(key, col(c, key).published, null, 'Versi awal')
}
/** Short readable list of what differs between two JSON values. */
export function diffSummary(a, b, max = 40) {
  const out = []
  const short = (v) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s == null ? '—' : s.length > 90 ? s.slice(0, 90) + '…' : s }
  const walk = (x, y, p) => {
    if (out.length >= max) return
    if (JSON.stringify(x) === JSON.stringify(y)) return
    const ox = x && typeof x === 'object', oy = y && typeof y === 'object'
    if (ox && oy && Array.isArray(x) === Array.isArray(y)) {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)])
      for (const k of keys) walk(x[k], y[k], p ? `${p} › ${k}` : k)
    } else out.push({ path: p || '(isi)', before: short(x), after: short(y) })
  }
  walk(a, b, ''); return out
}

/* ---------- build ---------- */
const mkCtx = (c, store, lang, v, extra = {}) => ({ lang, v, c, store, ...extra })
const writeFile = (rel, html) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html) }
const relFor = (urlPath) => path.posix.join(urlPath.replace(/^\//, ''), 'index.html')

export function buildSite() {
  const raw = loadContent(), c = view(raw, 'published'), store = loadStore()
  const ig = c.contact.instagram
  if (ig && store.account !== ig) { store.account = ig; saveStore(store) }
  const css = themeCss(c.theme), themeV = crypto.createHash('md5').update(css).digest('hex').slice(0, 8), v = String(Date.now())
  fs.writeFileSync(path.join(ROOT, 'theme.css'), css)
  const items = publishedUpdates(store), out = { published: items.length, detail: 0, removed: 0, pages: 0 }
  const keepDetail = { en: new Set(), id: new Set() }
  for (const lang of ['en', 'id']) {
    const ctx = mkCtx(c, store, lang, v, { themeV })
    for (const k of PAGE_KEYS) { const p = renderPage(ctx, k); writeFile(relFor(p.path), p.html); out.pages++ }
    // update detail pages share the Update page's contact band
    const bandSec = c.pages.update.sections.find((s) => s.type === 'contact-band' && s.visible !== false)
    const band = bandSec ? renderMain(ctx, { sections: [bandSec] }).html : ''
    const t = T_UPDATES[lang]
    for (const u of items) {
      const main = renderUpdateDetail(lang, u, band)
      const html = shell(ctx, { pageKey: 'update', enPath: `/update/${u.slug}`, title: `${u.title} | ${c.site.name}`, description: u.excerpt, ogImage: u.imageUrl, main })
      writeFile(`${lang === 'id' ? 'id/' : ''}update/${u.slug}/index.html`, html); keepDetail[lang].add(u.slug); out.detail++
    }
    // remove detail folders of posts that are no longer published (only folders this builder generated)
    const dir = path.join(ROOT, lang === 'id' ? 'id/update' : 'update')
    if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, d.name, 'index.html')
      if (d.isDirectory() && !keepDetail[lang].has(d.name) && fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('data-update-detail')) { fs.rmSync(path.join(dir, d.name), { recursive: true }); out.removed++ }
    }
    void t
  }
  return out
}

/** Preview of the DRAFT state (nothing is written). */
export function previewPage(pageKey, lang) {
  const raw = loadContent(), c = view(raw, 'draft'), store = loadStore()
  if (!PAGE_KEYS.includes(pageKey)) return null
  const ctx = mkCtx(c, store, lang === 'id' ? 'id' : 'en', String(Date.now()), { previewCss: themeCss(c.theme) })
  return renderPage(ctx, pageKey).html.replace('</head>', `<style>${themeCss(c.theme)}</style><base target="_blank"></head>`)
}
void esc; void readEnv
