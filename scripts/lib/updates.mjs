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
  return `<section class="container update-section">${body}</section>`
}
function homeSection(l, items, account, tx) {
  const t = T[l], sub = (v) => e(String(v || '').replace(/\{instagram\}/g, account))
  const tiles = items.length
    ? `<div class="up-tiles">${items.slice(0, 6).map((u) => `<a class="up-tile" href="${t.base}/update/${u.slug}"><img src="${e(u.imageUrl)}" alt="${e(u.title)}" loading="lazy" width="400" height="400"/><span class="up-tile-text"><time datetime="${e(u.publishedAt)}">${fmt(l, u.publishedAt, 'short')}</time><strong>${e(u.title)}</strong></span></a>`).join('')}</div>`
    : `<p class="update-empty-home">${sub(tx.emptyText)}</p>`
  return `<section class="section updates-home"><div class="container"><div class="section-heading"><div><p class="eyebrow">${sub(tx.eyebrow)}</p><h2>${sub(tx.title)}</h2><p class="updates-sub">${sub(tx.desc)}</p></div>`
    + `<div class="up-actions"><a class="button" href="${t.base}/update"><span>${sub(tx.allLabel)}</span> <span aria-hidden="true">→</span></a><a class="up-ig" href="https://www.instagram.com/${e(account)}/" target="_blank" rel="noopener noreferrer">${IG} ${sub(tx.viewLabel)} <span aria-hidden="true">↗</span></a></div></div>${tiles}</div></section>`
}
function detailMain(l, u, band) {
  const t = T[l]
  return `<div class="container update-detail" data-update-detail><a class="up-back" href="${t.base}/update"><span aria-hidden="true">←</span> ${t.back}</a>`
    + `<article class="up-article"><div class="up-hero"><img src="${e(u.imageUrl)}" alt="${e(u.title)}" width="1200" height="800"/></div><div class="up-article-body"><div class="up-meta up-meta-lg"><span class="up-user">${IG}${e(u.username)}</span><time datetime="${e(u.publishedAt)}">${fmt(l, u.publishedAt, 'long')}</time><span class="up-badge tone-${e(u.category.toLowerCase())}">${e(u.category)}</span></div>`
    + `<h1>${e(u.title)}</h1><p class="up-caption">${e(u.caption)}</p><div class="up-article-foot"><a class="button" href="${safeIg(u.postUrl)}" target="_blank" rel="noopener noreferrer">${IG}<span>${t.viewPost}</span> <span aria-hidden="true">↗</span></a></div></div></article></div>${band}`
}

export const renderUpdatesList = listSection
export const renderUpdatesHome = homeSection
export const renderUpdateDetail = detailMain
export const publishedUpdates = published
export const T_UPDATES = T
