// Shared pieces for the Update feature (mirrors Kelas Bermain's Instagram -> Update flow).
//   data/updates.json   the store: posts land as DRAFTS, an admin step publishes them
//   buildUpdates()      renders /update, /update/<slug> and the home teaser (EN + ID) from the store
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const STORE = path.join(ROOT, 'data/updates.json')
const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/* ------------------------------------------------------------------ */
/* env + store                                                          */
/* ------------------------------------------------------------------ */
export function readEnv(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, 'm'))
    if (m && m[1]) return m[1].replace(/^['"]|['"]$/g, '')
  }
  return undefined
}
export function loadStore() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')) } catch { return { account: 'spero_id', updatedAt: null, items: [] } }
}
export function saveStore(s) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true })
  fs.writeFileSync(STORE, JSON.stringify(s, null, 2) + '\n')
}

/* ------------------------------------------------------------------ */
/* caption -> card content (same rules as Kelas Bermain)                */
/* ------------------------------------------------------------------ */
const CATEGORY_RULES = [
  ['Pengumuman', /\b(pengumuman|info penting|perhatian|mohon|dibuka|ditutup)\b/i],
  ['Event', /\b(event|kelas|workshop|open house|pendaftaran|daftar|kuota)\b/i],
  ['Dokumentasi', /\b(dokumentasi|keseruan|momen|recap|galeri|terima kasih)\b/i],
]
export const CATEGORIES = ['Kegiatan', 'Event', 'Pengumuman', 'Dokumentasi']
export const detectCategory = (c) => (CATEGORY_RULES.find(([, re]) => re.test(c)) || ['Kegiatan'])[0]
export function toTitle(caption) {
  const first = caption.split('\n').map((l) => l.trim()).find((l) => l) ?? ''
  const cleaned = first.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim()
  const src = cleaned || caption.replace(/\s+/g, ' ').trim()
  if (!src) return 'Update Spero'
  return src.length > 90 ? `${src.slice(0, 90).trimEnd()}…` : src
}
export function toExcerpt(caption) {
  const t = caption.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim()
  return t.length > 180 ? `${t.slice(0, 180).trimEnd()}…` : t
}
export function toSlug(caption, shortcode) {
  const base = toTitle(caption).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').filter(Boolean).slice(0, 8).join('-')
  const suffix = shortcode.slice(-6).toLowerCase()
  return base ? `${base}-${suffix}` : `post-${suffix}`
}

/* ------------------------------------------------------------------ */
/* page rendering                                                       */
/* ------------------------------------------------------------------ */
const T = {
  en: {
    base: '', loc: 'en-GB', tz: 'Asia/Jakarta', read: 'Read more', view: 'View on Instagram', viewPost: 'View the post on Instagram', back: 'Back to all updates',
    emptyT: 'No updates yet', emptyD: 'The latest Instagram posts will appear here after the next sync.', read_aria: 'Read update',
    hEyebrow: 'Latest updates', hTitle: 'Follow what we are up to at Spero', hDesc: 'News, events and documentation from our team.', all: 'See all updates',
    homeEmpty: 'Spero updates will appear here soon.', siteName: 'PT. Spero Mahakarya',
  },
  id: {
    base: '/id', loc: 'id-ID', tz: 'Asia/Jakarta', read: 'Baca selengkapnya', view: 'Lihat di Instagram', viewPost: 'Lihat postingan di Instagram', back: 'Kembali ke semua update',
    emptyT: 'Belum ada update', emptyD: 'Postingan Instagram terbaru akan muncul di sini setelah sinkronisasi berikutnya.', read_aria: 'Baca update',
    hEyebrow: 'Update terbaru', hTitle: 'Ikuti kabar terbaru Spero', hDesc: 'Kabar kegiatan, pengumuman, dan dokumentasi dari tim kami.', all: 'Lihat Semua Update',
    homeEmpty: 'Update terbaru Spero akan muncul di sini.', siteName: 'PT. Spero Mahakarya',
  },
}
const IG = '<svg class="up-igicon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/></svg>'
const safeIg = (u) => (/^https:\/\/(www\.)?instagram\.com\//.test(u) ? u : 'https://www.instagram.com/')
const fmt = (l, iso, style) => new Intl.DateTimeFormat(T[l].loc, { day: 'numeric', month: style, year: 'numeric', timeZone: T[l].tz }).format(new Date(iso))

function published(store) {
  return store.items.filter((i) => i.published && i.visible).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug))
}
function card(l, u) {
  const t = T[l], href = `${t.base}/update/${u.slug}`
  return `<article class="up-card"><a class="up-media" href="${href}" aria-label="${t.read_aria}: ${e(u.title)}"><img src="${e(u.imageUrl)}" alt="${e(u.title)}" loading="lazy" width="800" height="600"/></a>`
    + `<div class="up-body"><div class="up-meta"><span class="up-user">${IG}${e(u.username)}</span><time datetime="${e(u.publishedAt)}">${fmt(l, u.publishedAt, 'short')}</time></div>`
    + `<span class="up-badge tone-${e(u.category.toLowerCase())}">${e(u.category)}</span><h3><a href="${href}">${e(u.title)}</a></h3><p class="up-excerpt">${e(u.excerpt)}</p>`
    + `<div class="up-foot"><a class="up-read" href="${href}">${t.read} <span aria-hidden="true">→</span></a><a class="up-ig" href="${safeIg(u.postUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${t.view}: ${e(u.title)}">${t.view} <span aria-hidden="true">↗</span></a></div></div></article>`
}
function listSection(l, items) {
  const t = T[l]
  const body = items.length
    ? `<div class="up-grid">${items.map((u) => card(l, u)).join('')}</div>`
    : `<div class="update-empty"><h3>${t.emptyT}</h3><p>${t.emptyD}</p></div>`
  return `<!--updates-start--><section class="container update-section">${body}</section><!--updates-end-->`
}
function homeSection(l, items, account) {
  const t = T[l]
  const tiles = items.length
    ? `<div class="up-tiles">${items.slice(0, 6).map((u) => `<a class="up-tile" href="${t.base}/update/${u.slug}"><img src="${e(u.imageUrl)}" alt="${e(u.title)}" loading="lazy" width="400" height="400"/><span class="up-tile-text"><time datetime="${e(u.publishedAt)}">${fmt(l, u.publishedAt, 'short')}</time><strong>${e(u.title)}</strong></span></a>`).join('')}</div>`
    : `<p class="update-empty-home">${t.homeEmpty}</p>`
  return `<!--updates-home-start--><section class="section updates-home"><div class="container"><div class="section-heading"><div><p class="eyebrow">${t.hEyebrow}</p><h2>${t.hTitle}</h2><p class="updates-sub">${t.hDesc}</p></div>`
    + `<div class="up-actions"><a class="button" href="${t.base}/update"><span>${t.all}</span> <span aria-hidden="true">→</span></a><a class="up-ig" href="https://www.instagram.com/${e(account)}/" target="_blank" rel="noopener noreferrer">${IG} ${t.view} <span aria-hidden="true">↗</span></a></div></div>${tiles}</div></section><!--updates-home-end-->`
}
function detailMain(l, u, band) {
  const t = T[l]
  return `<main id="main-content" tabindex="-1" data-update-detail><div class="container update-detail"><a class="up-back" href="${t.base}/update"><span aria-hidden="true">←</span> ${t.back}</a>`
    + `<article class="up-article"><div class="up-hero"><img src="${e(u.imageUrl)}" alt="${e(u.title)}" width="1200" height="800"/></div><div class="up-article-body"><div class="up-meta up-meta-lg"><span class="up-user">${IG}${e(u.username)}</span><time datetime="${e(u.publishedAt)}">${fmt(l, u.publishedAt, 'long')}</time><span class="up-badge tone-${e(u.category.toLowerCase())}">${e(u.category)}</span></div>`
    + `<h1>${e(u.title)}</h1><p class="up-caption">${e(u.caption)}</p><div class="up-article-foot"><a class="button" href="${safeIg(u.postUrl)}" target="_blank" rel="noopener noreferrer">${IG}<span>${t.viewPost}</span> <span aria-hidden="true">↗</span></a></div></div></article></div>${band}</main>`
}
function setMeta(html, { title, desc, url, image, type }) {
  const r = (re, to) => { html = html.replace(re, to) }
  r(/<title>.*?<\/title>/, `<title>${e(title)}</title>`)
  r(/<meta name="description" content="[^"]*"\/>/, `<meta name="description" content="${e(desc)}"/>`)
  r(/<link rel="canonical" href="[^"]*"\/>/, `<link rel="canonical" href="${e(url)}"/>`)
  r(/<meta property="og:title" content="[^"]*"\/>/, `<meta property="og:title" content="${e(title)}"/>`)
  r(/<meta property="og:description" content="[^"]*"\/>/, `<meta property="og:description" content="${e(desc)}"/>`)
  r(/<meta property="og:url" content="[^"]*"\/>/, `<meta property="og:url" content="${e(url)}"/>`)
  r(/<meta property="og:type" content="[^"]*"\/>/, `<meta property="og:type" content="${type}"/>`)
  r(/<meta name="twitter:title" content="[^"]*"\/>/, `<meta name="twitter:title" content="${e(title)}"/>`)
  r(/<meta name="twitter:description" content="[^"]*"\/>/, `<meta name="twitter:description" content="${e(desc)}"/>`)
  html = html.replace(/<meta property="og:image" content="[^"]*"\/>/, '')
  if (image) html = html.replace('</head>', `<meta property="og:image" content="${e(image)}"/></head>`)
  return html
}

export function buildUpdates() {
  const store = loadStore(), items = published(store), account = store.account || 'spero_id'
  const out = { detail: 0, removed: 0 }
  for (const l of ['en', 'id']) {
    const t = T[l], listFile = path.join(ROOT, l === 'id' ? 'id/update/index.html' : 'update/index.html')
    if (!fs.existsSync(listFile)) continue
    let list = fs.readFileSync(listFile, 'utf8')
    const band = (list.match(/<section class="contact-band">.*?<\/section>/s) || [''])[0]
    const intro = (list.match(/<header class="container page-intro illustrated-intro">.*?<\/header>/s) || [''])[0]
    const tpl = list.replace(/<main id="main-content".*?<\/main>/s, '@@MAIN@@')
    const mk = (main, meta) => setMeta(tpl.replace('@@MAIN@@', () => main), meta)
    const listTitle = l === 'id' ? `Update | ${t.siteName}` : `Updates | ${t.siteName}`
    const listDesc = l === 'id' ? 'Ikuti update terbaru, kegiatan, dan cerita dari Spero.' : 'Follow the latest updates, activities and stories from Spero.'
    fs.writeFileSync(listFile, mk(`<main id="main-content" tabindex="-1">${intro}${listSection(l, items)}${band}</main>`,
      { title: listTitle, desc: listDesc, url: `${t.base}/update`, image: null, type: 'website' }))
    // detail pages
    const dir = path.join(ROOT, l === 'id' ? 'id/update' : 'update'), keep = new Set()
    for (const u of items) {
      keep.add(u.slug)
      fs.mkdirSync(path.join(dir, u.slug), { recursive: true })
      fs.writeFileSync(path.join(dir, u.slug, 'index.html'), mk(detailMain(l, u, band),
        { title: `${u.title} | ${t.siteName}`, desc: u.excerpt, url: `${t.base}/update/${u.slug}`, image: u.imageUrl, type: 'article' }))
      out.detail++
    }
    // drop detail pages of posts that are no longer published (only folders this script generated)
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory() || keep.has(d.name)) continue
      const f = path.join(dir, d.name, 'index.html')
      if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('data-update-detail')) { fs.rmSync(path.join(dir, d.name), { recursive: true }); out.removed++ }
    }
    // home teaser
    const homeFile = path.join(ROOT, l === 'id' ? 'id/index.html' : 'index.html')
    if (fs.existsSync(homeFile)) {
      let h = fs.readFileSync(homeFile, 'utf8').replace(/<!--updates-home-start-->.*?<!--updates-home-end-->/s, '')
      if (h.includes('<!--clients-start-->')) h = h.replace('<!--clients-start-->', () => homeSection(l, items, account) + '<!--clients-start-->')
      fs.writeFileSync(homeFile, h)
    }
  }
  return { published: items.length, ...out }
}
