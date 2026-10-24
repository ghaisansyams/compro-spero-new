// Renders pages from the CMS model: shell (head/header/footer) + sections. Pure functions, no file writes.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAGE_PATH } from './schema.mjs'
import { workBlock, workExtras } from './work.mjs'
import { renderUpdatesList, renderUpdatesHome, publishedUpdates } from './updates.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const A = JSON.parse(fs.readFileSync(path.join(here, 'assets.json'), 'utf8'))
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/* ---------- ctx helpers ---------- */
// ctx = { lang, v (asset version), c: {site,nav,theme,pages,portfolio,team,clients,contact}, store, pageKey }
const pick = (ctx, v) => (v && typeof v === 'object' && !Array.isArray(v) && ('en' in v || 'id' in v)) ? (Array.isArray(v.en) ? ((v[ctx.lang] && v[ctx.lang].length) ? v[ctx.lang] : v.en) : (v[ctx.lang] || v.en || '')) : v
const sub = (ctx, s) => String(s ?? '').replace(/\{email\}/g, ctx.c.contact.email || '').replace(/\{instagram\}/g, ctx.c.contact.instagram || '').replace(/\{year\}/g, String(new Date().getFullYear()))
const tx = (ctx, v) => esc(sub(ctx, pick(ctx, v)))                       // escaped text
const lines = (ctx, v) => (pick(ctx, v) || []).map((l) => esc(sub(ctx, l)))
export function url(ctx, h) {
  h = sub(ctx, h || '')
  if (!h) return '#'
  if (h.startsWith('#') || /^(mailto:|tel:|https?:)/i.test(h)) return h
  if (h.startsWith('/')) { if (ctx.lang !== 'id' || h === '/id' || h.startsWith('/id/')) return h; return h === '/' ? '/id' : '/id' + h }
  return h
}
const ext = (h) => (/^https?:/i.test(h) ? ' target="_blank" rel="noopener noreferrer"' : '')
const arrowSvg = A.arrowUi
function btn(ctx, o, cls = 'button') {
  const label = tx(ctx, o.label), h = url(ctx, o.href)
  if (!label) return ''
  const a = `<a class="${cls}" href="${esc(h)}"${ext(h)}>${label} <span aria-hidden="true">${arrowSvg}</span></a>`
  return h.startsWith('mailto:') ? `<span class="email-link">${a}</span>` : a
}
function tlink(ctx, label, href) {
  const l = tx(ctx, label); if (!l) return ''
  const h = url(ctx, href)
  return `<a class="text-link" href="${esc(h)}"${ext(h)}>${l}<span aria-hidden="true">${A.arrowLink}</span></a>`
}
function hl(ctx, text, cls = '') {   // scroll-highlight paragraph: one span per word
  const words = sub(ctx, pick(ctx, text)).trim().split(/\s+/).filter(Boolean)
  const spans = words.map((w, i) => `<span class="highlight-word" style="--highlight-index:${i}">${esc(w)}${i < words.length - 1 ? '<!-- --> ' : ''}</span>`).join('')
  return `<p class="scroll-highlight${cls ? ' ' + cls : ''}" data-highlight="true" style="--highlight-words:${words.length}" data-reveal-skip="true">${spans}</p>`
}
const illu = (name, compact) => `<div class="studio-illustration illustration-${A.illustrations[name] ? name : 'connection'}${compact ? ' illustration-compact' : ''}" data-motion="paused">${A.illustrations[name] || A.illustrations.connection}</div>`
const sectionIdFor = (type, sec, page) => ({ 'services-list': 'services', 'portfolio-teaser': 'portfolio' }[type] || (type === 'studio' && page.sections.find((s) => s.type === 'studio') === sec ? 'about' : ''))

/* ---------- marquee ---------- */
function marquee(ctx, sec) {
  const words = (pick(ctx, sec.words) || []).map((w) => esc(sub(ctx, w))); if (!words.length) return ''
  const rows = sec.variant === 'cross' ? [['ltr', 1], ['rtl', 1.15]] : sec.variant === 'tilt' ? [['ltr', 0.8]] : [['ltr', 0.9]]
  const group = (off, ws) => `<span class="marquee-group">${ws.map((w, i) => `<span class="marquee-item">${w}<span class="marquee-sep" aria-hidden="true">${(i + off) % 2 ? '×' : '+'}</span></span>`).join('')}</span>`
  return `<section class="marquee-band" data-variant="${esc(sec.variant)}" aria-hidden="true">${rows.map(([d, sp]) => `<div class="marquee-row" data-marquee-row="true" data-motion="paused" data-direction="${d}" data-speed="${+(sp * (Number(sec.speed) || 1)).toFixed(2)}"><div class="marquee-track">${group(0, d === 'rtl' ? [...words].reverse() : words)}${group(1, d === 'rtl' ? [...words].reverse() : words)}</div></div>`).join('')}</section>`
}

/* ---------- generated blocks (team / contact info / clients) ---------- */
const tel = (p) => 'tel:' + p.replace(/[^\d+]/g, '')
function teamBlock(ctx, sec) {
  return `<section class="section about-team"><div class="container"><div class="section-heading"><div><p class="eyebrow">${tx(ctx, sec.eyebrow)}</p><h2>${tx(ctx, sec.title)}</h2></div></div><div class="team-grid">`
    + ctx.c.team.map((m) => `<article class="team-card"><img src="${esc(m.photo)}" alt="Foto ${esc(m.name)}" width="128" height="128" loading="lazy"/><h3>${esc(m.name)}</h3><p>${esc(m.role)}</p></article>`).join('') + '</div></div></section>'
}
function contactInfoBlock(ctx, sec) {
  const k = ctx.c.contact
  return `<section class="section about-contact"><div class="container split-section"><div><p class="eyebrow">${tx(ctx, sec.eyebrow)}</p><h2>${tx(ctx, sec.heading)}</h2></div><dl class="contact-list">`
    + `<div><dt>${tx(ctx, sec.phoneLabel)}</dt><dd>${(k.phones || []).map((p) => `<a href="${esc(tel(p))}">${esc(p)}</a>`).join('<br/>')}</dd></div>`
    + `<div><dt>${tx(ctx, sec.mailLabel)}</dt><dd><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></dd></div>`
    + `<div><dt>${tx(ctx, sec.addrLabel)}</dt><dd>${String(k.address || '').split('\n').map(esc).join('<br/>')}</dd></div></dl></div></section>`
}
const ini = (n) => { const w = n.split(/[\s\-.&]+/).filter(Boolean); return ((w.length === 1 ? w[0].slice(0, 2) : (w[0][0] || '') + (w[1][0] || '')) || '?').toUpperCase() }
function clientsBlock(ctx, sec) {
  const names = ctx.c.clients, half = Math.ceil(names.length / 2)
  const row = (lst, rev) => { const li = lst.map((n) => `<li><span class="client-ini">${esc(ini(n))}</span>${esc(n)}</li>`).join(''); return `<div class="client-row" data-dir="${rev ? 'rtl' : 'ltr'}"><div class="client-track"><ul class="client-set">${li}</ul><ul class="client-set" aria-hidden="true">${li}</ul></div></div>` }
  return `<section class="section clients-band" aria-label="${tx(ctx, sec.title)}"><div class="container clients-head"><div><p class="eyebrow">${tx(ctx, sec.eyebrow)}</p><h2>${tx(ctx, sec.title)}</h2></div><p>${tx(ctx, sec.desc)}</p></div>`
    + `<div class="client-marquee">${row(names.slice(0, half), false)}${row(names.slice(half), true)}</div></section>`
}

/* ---------- section renderers ---------- */
const R = {
  hero: (ctx, s) => `<section class="home-hero" data-hero-stage="true">${A.heroArt}<div class="container hero-copy"><div class="hero-topline"><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><span class="small-note">${tx(ctx, s.note)}</span></div>`
    + `<div class="hero-lead"><h1 class="hero-headline">${lines(ctx, s.lines).map((l) => `<span class="hero-line" data-reveal="mask">${l}</span>`).join('')}</h1>${hl(ctx, s.lede, 'lede')}<div class="hero-actions">${btn(ctx, s.cta1)}${tlink(ctx, s.cta2.label, s.cta2.href)}</div></div></div></section>`,
  focus: (ctx, s) => `<section class="focus-statement"><div class="container"><p class="eyebrow">${tx(ctx, s.eyebrow)}</p>${(pick(ctx, s.lines) || []).map((l) => hl(ctx, l, 'focus-line').replace('<p ', '<h2 ').replace(/<\/p>$/, '</h2>')).join('')}</div></section>`,
  marquee: (ctx, s) => marquee(ctx, s),
  'services-list': (ctx, s, page) => `<section class="container section" id="services"><div class="section-heading"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h2>${lines(ctx, s.heading).join('<br/>')}</h2></div>${tlink(ctx, s.linkLabel, s.linkHref)}</div><div class="service-list">`
    + s.rows.map((r) => `<a class="service-row" href="${esc(url(ctx, r.href))}">${illu(r.illustration, true)}<span class="row-number">${esc(r.number)}</span><h3>${tx(ctx, r.title)}</h3><p>${tx(ctx, r.desc)}</p><span class="row-arrow" aria-hidden="true">${A.rowArrow}</span></a>`).join('') + '</div></section>',
  studio: (ctx, s, page) => { const l = lines(ctx, s.heading), id = sectionIdFor('studio', s, page); return `<section class="studio-section"${id ? ` id="${id}"` : ''}><div class="container split-section"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h2>${l.map((x, i) => (i === l.length - 1 && l.length > 1 ? `<span class="accent-text">${x}</span>` : x)).join('<br/>')}</h2>${illu(s.illustration)}</div><div class="prose">${hl(ctx, s.text)}${tx(ctx, s.text2) ? `<p>${tx(ctx, s.text2)}</p>` : ''}${tlink(ctx, s.linkLabel, s.linkHref)}</div></div></section>` },
  'portfolio-teaser': (ctx, s) => `<section class="container section" id="portfolio"><div class="section-heading"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h2>${tx(ctx, s.heading)}</h2></div>${tlink(ctx, s.linkLabel, s.linkHref)}</div>${workBlock({ lang: ctx.lang, projects: ctx.c.portfolio, texts: workTexts(ctx), mode: 'teaser' })}</section>`,
  'updates-home': (ctx, s) => renderUpdatesHome(ctx.lang, publishedUpdates(ctx.store), ctx.store.account || ctx.c.contact.instagram || 'spero_id', mapUpdatesHome(ctx, s)),
  clients: (ctx, s) => clientsBlock(ctx, s),
  'contact-band': (ctx, s) => `<section class="contact-band"><div class="container contact-inner">${illu('connection', true)}<div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h2>${tx(ctx, s.heading)}</h2>${hl(ctx, s.text)}</div>${btn(ctx, { label: s.buttonLabel, href: s.buttonHref }, 'button button-light')}</div></section>`,
  intro: (ctx, s) => `<header class="container page-intro illustrated-intro"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h1 data-reveal="mask">${tx(ctx, s.title)}</h1>${s.highlight ? hl(ctx, s.lede, 'lede') : `<p class="lede">${tx(ctx, s.lede)}</p>`}`
    + (tx(ctx, s.button?.label) ? `<div class="hero-actions">${(() => { const h = url(ctx, s.button.href); return `<a class="button" href="${esc(h)}"${ext(h)}><span>${tx(ctx, s.button.label)}</span> <span aria-hidden="true">↗</span></a>` })()}</div>` : '') + `</div>${illu(s.illustration)}</header>`,
  'service-details': (ctx, s) => '<div class="container service-details">' + s.items.map((it) => `<section class="service-detail" id="${esc(it.id)}"><div><p class="eyebrow">${tx(ctx, it.eyebrow)}</p><h2>${tx(ctx, it.title)}</h2><p class="tool-line">${tx(ctx, it.toolLine)}</p>${illu(it.illustration)}</div><div class="prose">${hl(ctx, it.text)}<ul class="deliverables">${(pick(ctx, it.deliverables) || []).map((d) => `<li>${esc(sub(ctx, d))}</li>`).join('')}</ul></div></section>`).join('') + '</div>',
  process: (ctx, s) => `<section class="studio-section"><div class="container split-section"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h2>${lines(ctx, s.heading).join('<br/>')}</h2>${illu(s.illustration)}</div><ol class="process-list">${s.steps.map((st, i) => `<li><span class="row-number">${String(i + 1).padStart(2, '0')}</span><div><h3>${tx(ctx, st.title)}</h3><p>${tx(ctx, st.text)}</p></div></li>`).join('')}</ol></div></section>`,
  story: (ctx, s) => `<section class="container split-section about-statement"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p>${illu(s.illustration)}</div><div class="prose large-prose"><h2${s.accent ? ' class="accent-text"' : ''}>${tx(ctx, s.heading)}</h2>${(pick(ctx, s.paragraphs) || []).map((p) => `<p>${esc(sub(ctx, p))}</p>`).join('')}${tx(ctx, s.since) ? `<p class="about-since">${tx(ctx, s.since)}</p>` : ''}</div></section>`,
  principles: (ctx, s) => `<section class="studio-section"><div class="container split-section"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h2>${tx(ctx, s.heading)}</h2>${illu(s.illustration)}</div><div class="principles">${s.items.map((it) => `<article><h3>${tx(ctx, it.title)}</h3><p>${tx(ctx, it.text)}</p></article>`).join('')}</div></div></section>`,
  team: (ctx, s) => teamBlock(ctx, s),
  contactinfo: (ctx, s) => contactInfoBlock(ctx, s),
  work: (ctx, s) => workBlock({ lang: ctx.lang, projects: ctx.c.portfolio, texts: workTexts(ctx, s), mode: 'full' }),
  'updates-list': (ctx) => renderUpdatesList(ctx.lang, publishedUpdates(ctx.store)),
  textblock: (ctx, s) => `<section class="container section"><div class="section-heading"><div><p class="eyebrow">${tx(ctx, s.eyebrow)}</p><h2>${tx(ctx, s.heading)}</h2></div>${tlink(ctx, s.linkLabel, s.linkHref)}</div><div class="prose">${(pick(ctx, s.paragraphs) || []).map((p) => `<p>${esc(sub(ctx, p))}</p>`).join('')}</div></section>`,
}
function mapUpdatesHome(ctx, s) { const o = {}; for (const k of ['eyebrow', 'title', 'desc', 'allLabel', 'viewLabel', 'emptyText']) o[k] = sub(ctx, pick(ctx, s[k])); return o }
function workTexts(ctx, s) {
  const w = s || ctx.c.pages.home.sections.find((x) => x.type === 'work') || ctx.c.pages.portfolio.sections.find((x) => x.type === 'work') || {}
  const g = (k, d) => sub(ctx, pick(ctx, w[k])) || d
  return { productsTitle: g('productsTitle', 'Products'), productsDesc: g('productsDesc', ''), moreTitle: g('moreTitle', '3D & Games'), moreDesc: g('moreDesc', '') }
}

/* ---------- main content ---------- */
export function renderMain(ctx, page) {
  let html = '', work = false
  for (const sec of page.sections) {
    if (sec.visible === false || !R[sec.type]) continue
    if (sec.type === 'work' || sec.type === 'portfolio-teaser') work = true
    html += R[sec.type](ctx, sec, page)
  }
  if (work) html += workExtras(ctx.c.portfolio)
  return { html, work }
}

/* ---------- shell ---------- */
function logo(ctx) {
  const s = ctx.c.site, a = esc(s.name)
  return `<span class="brand"><span class="brand-mark"><img alt="${a}" width="128" height="40" decoding="async" class="logo-light" style="color:transparent" src="${esc(s.logoLight)}"/><img alt="" width="128" height="40" decoding="async" class="logo-dark" style="color:transparent" src="${esc(s.logoDark)}"/></span></span>`
}
const navActive = (href, pageKey) => { const p = String(href).replace(/[#?].*$/, '').replace(/\/$/, '') || '/'; return pageKey && p === PAGE_PATH[pageKey] }
function navLinks(ctx, pageKey) {
  return ctx.c.nav.items.filter((i) => i.visible !== false).map((i) => {
    const h = url(ctx, i.href), cur = navActive(i.href, pageKey) ? ' aria-current="page"' : ''
    return `<a${cur} href="${esc(h)}"${ext(h)}>${tx(ctx, i.label)}</a>`
  }).join('')
}
const T = { en: { skip: 'Skip to content', main: 'Main navigation', foot: 'Footer navigation', lang: 'Language', toEn: 'Switch to English', toId: 'Ganti ke Bahasa Indonesia', menu: 'Open menu', theme: 'Toggle color theme', home: 'home' },
  id: { skip: 'Lewati ke konten', main: 'Navigasi utama', foot: 'Navigasi footer', lang: 'Bahasa', toEn: 'Switch to English', toId: 'Ganti ke Bahasa Indonesia', menu: 'Buka menu', theme: 'Ganti tema warna', home: 'beranda' } }
export function shell(ctx, { pageKey, enPath, title, description, ogImage, main, scripts = [], noindex = false }) {
  const s = ctx.c.site, t = T[ctx.lang], lp = enPath === '/' ? '/' : enPath.replace(/\/?$/, '/'), idPath = lp === '/' ? '/id' : '/id' + lp
  const base = (s.siteUrl || '').replace(/\/$/, ''), selfPath = ctx.lang === 'id' ? idPath : lp
  const full = (p) => (base ? base + p : '')
  const meta = [`<meta name="description" content="${esc(description)}"/>`]
  if (base) meta.push(`<link rel="canonical" href="${esc(full(selfPath))}"/>`, `<link rel="alternate" hreflang="en" href="${esc(full(lp))}"/>`, `<link rel="alternate" hreflang="id" href="${esc(full(idPath))}"/>`, `<meta property="og:url" content="${esc(full(selfPath))}"/>`)
  meta.push(`<meta property="og:title" content="${esc(title)}"/>`, `<meta property="og:description" content="${esc(description)}"/>`, `<meta property="og:site_name" content="${esc(s.name)}"/>`, `<meta property="og:locale" content="${ctx.lang === 'id' ? 'id_ID' : 'en_US'}"/>`, '<meta property="og:type" content="website"/>', '<meta name="twitter:card" content="summary"/>', `<meta name="twitter:title" content="${esc(title)}"/>`, `<meta name="twitter:description" content="${esc(description)}"/>`)
  const og = ogImage || s.ogImage; if (og) meta.push(`<meta property="og:image" content="${esc(base && og.startsWith('/') ? base + og : og)}"/>`)
  if (noindex) meta.push('<meta name="robots" content="noindex"/>')
  const email = ctx.c.contact.email, cta = s.cta, ctaHref = url(ctx, cta.href)
  const themeScript = `try{var t=localStorage.getItem("theme"),d=${JSON.stringify(ctx.c.theme.mode)};if(t==="dark"||(!t&&(d==="dark"||(d==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))))document.documentElement.classList.add("dark")}catch(e){}`
  const brandLink = `<a aria-label="${esc(s.name)} ${t.home}" class="brand-link" href="${ctx.lang === 'id' ? '/id' : '/'}">${logo(ctx)}</a>`
  const loc = `<nav aria-label="${t.lang}" class="locale-switcher desktop-switcher"><a href="${esc(lp)}" hreflang="en" lang="en"${ctx.lang === 'en' ? ' aria-current="true"' : ''} aria-label="${t.toEn}">EN</a><a href="${esc(idPath)}" hreflang="id" lang="id"${ctx.lang === 'id' ? ' aria-current="true"' : ''} aria-label="${t.toId}">ID</a></nav>`
  const nm = tx(ctx, s.cta.label)
  const header = `<header class="site-header"><div class="container nav-inner">${brandLink}<nav aria-label="${t.main}" class="desktop-nav">${navLinks(ctx, pageKey)}</nav><div class="nav-actions">${loc}`
    + (nm ? `${ctaHref.startsWith('mailto:') ? '<span class="email-link">' : ''}<a class="nav-contact" href="${esc(ctaHref)}"${ext(ctaHref)}>${nm} <span aria-hidden="true">${A.arrowCta}</span></a>${ctaHref.startsWith('mailto:') ? '</span>' : ''}` : '')
    + `<button class="icon-button theme-toggle" aria-label="${t.theme}">${A.themeToggle}</button><div class="mobile-navigation"><button class="icon-button" aria-label="${t.menu}" aria-expanded="false" aria-controls="mobile-menu">${A.menuIcon}</button></div></div></div></header>`
  const footer = `<footer class="site-footer"><div class="container"><div class="footer-top"><div>${brandLink}<p>${tx(ctx, s.tagline)}</p></div><nav aria-label="${t.foot}">${navLinks(ctx, pageKey)}<span class="email-link"><a class="" href="mailto:${esc(email)}">${esc(email)}</a></span></nav></div>`
    + `<div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(s.copyrightName || s.name)}</span><span>${tx(ctx, s.footerRight)}</span></div></div></footer>`
  const icon = s.favicon ? `<link rel="icon" href="${esc(s.faviconIco || s.favicon)}" sizes="any"/><link rel="icon" href="${esc(s.favicon)}" type="image/png"/><link rel="apple-touch-icon" href="${esc(s.favicon)}"/>` : ''
  const v = ctx.v
  return `<!DOCTYPE html><html lang="${ctx.lang}" class="plus_jakarta_sans_3d8f4431-module__pMTOia__variable"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>`
    + `<link rel="preload" href="/_next/static/media/fba5a26ea33df6a3-s.p.0eehd8tgys7nv.woff2" as="font" crossorigin="" type="font/woff2"/><link rel="stylesheet" href="/_next/static/chunks/0h2-6_24o2hf6.css" data-precedence="next"/>`
    + `<title>${esc(title)}</title>${meta.join('')}${icon}<link rel="stylesheet" href="/site.css?v=${v}"/><link rel="stylesheet" href="/theme.css?v=${ctx.themeV || v}"/><script>${themeScript}</script></head>`
    + `<body><div hidden=""></div><a class="skip-link" href="#main-content">${t.skip}</a><div class="scroll-progress" aria-hidden="true"></div>${header}<main id="main-content" tabindex="-1">${main}</main>${footer}`
    + `<script src="/app.js?v=${v}"></script>${scripts.map((x) => `<script src="/${x}.js?v=${v}"></script>`).join('')}</body></html>`
}

/** Full page: { html, path } for one language. */
export function renderPage(ctx, pageKey) {
  const page = ctx.c.pages[pageKey], enPath = PAGE_PATH[pageKey]
  const { html, work } = renderMain(ctx, page)
  const title = sub(ctx, pick(ctx, page.meta.title)) || ctx.c.site.name, description = sub(ctx, pick(ctx, page.meta.description))
  return { path: ctx.lang === 'id' ? (enPath === '/' ? '/id/' : `/id${enPath}/`) : (enPath === '/' ? '/' : `${enPath}/`), html: shell(ctx, { pageKey, enPath, title, description, main: html, scripts: work ? ['work'] : [] }) }
}
