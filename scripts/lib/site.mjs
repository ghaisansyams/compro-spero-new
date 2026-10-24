// Content store (team / clients / contact: draft -> publish) and the static-page generators.
// buildSite() renders everything the public site shows from PUBLISHED content, so the site stays static.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, loadStore, saveStore, buildUpdates } from './updates.mjs'

const CONTENT = path.join(ROOT, 'data/content.json')
const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function loadContent() {
  try { return JSON.parse(fs.readFileSync(CONTENT, 'utf8')) } catch { return { team: { draft: [], published: [] }, clients: { draft: [], published: [] }, contact: { draft: {}, published: {} } } }
}
export function saveContent(c) { fs.writeFileSync(CONTENT, JSON.stringify(c, null, 2) + '\n') }
export const dirty = (c, k) => JSON.stringify(c[k].draft) !== JSON.stringify(c[k].published)

/* ---------- labels ---------- */
const L = {
  en: { team: 'We are proud to be part of the Spero team', teamh: 'Our Team', contact: 'Get Contact', phone: 'Phone', mail: 'Email', addr: 'Address', clients: 'Clients', clientsh: 'Our Clients', clientsp: 'Institutions and companies that have worked with us.' },
  id: { team: 'Kami bangga menjadi bagian dari tim Spero', teamh: 'Tim Kami', contact: 'Hubungi Kami', phone: 'Telepon', mail: 'Email', addr: 'Alamat', clients: 'Klien', clientsh: 'Klien Kami', clientsp: 'Instansi dan perusahaan yang pernah bekerja sama dengan kami.' },
}
const PAGES = { en: ['about/index.html', 'index.html', 'portfolio/index.html'], id: ['id/about/index.html', 'id/index.html', 'id/portfolio/index.html'] }

/* ---------- block helper: replace <!--name-start-->…<!--name-end--> (or a legacy region the first time) ---------- */
function setBlock(html, name, block, legacy) {
  const wrapped = `<!--${name}-start-->${block}<!--${name}-end-->`
  const re = new RegExp(`<!--${name}-start-->.*?<!--${name}-end-->`, 's')
  if (re.test(html)) return html.replace(re, () => wrapped)
  if (legacy && legacy.test(html)) return html.replace(legacy, () => wrapped)
  return null
}

/* ---------- generators ---------- */
function teamHtml(l, items) {
  const t = L[l]
  return `<section class="section about-team"><div class="container"><div class="section-heading"><div><p class="eyebrow">${t.team}</p><h2>${t.teamh}</h2></div></div><div class="team-grid">`
    + items.map((m) => `<article class="team-card"><img src="${e(m.photo)}" alt="Foto ${e(m.name)}" width="128" height="128" loading="lazy"/><h3>${e(m.name)}</h3><p>${e(m.role)}</p></article>`).join('')
    + '</div></div></section>'
}
const tel = (p) => 'tel:' + p.replace(/[^\d+]/g, '')
function contactHtml(l, k) {
  const t = L[l]
  return `<section class="section about-contact"><div class="container split-section"><div><p class="eyebrow">${t.contact}</p><h2>PT. Spero Mahakarya Nusantara</h2></div><dl class="contact-list">`
    + `<div><dt>${t.phone}</dt><dd>${(k.phones || []).map((p) => `<a href="${e(tel(p))}">${e(p)}</a>`).join('<br/>')}</dd></div>`
    + `<div><dt>${t.mail}</dt><dd><a href="mailto:${e(k.email)}">${e(k.email)}</a></dd></div>`
    + `<div><dt>${t.addr}</dt><dd>${String(k.address || '').split('\n').map(e).join('<br/>')}</dd></div></dl></div></section>`
}
function ini(n) { const w = n.split(/[\s\-.&]+/).filter(Boolean); return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase() }
function clientsHtml(l, names) {
  const t = L[l], half = Math.ceil(names.length / 2)
  const row = (lst, rev) => {
    const li = lst.map((n) => `<li><span class="client-ini">${e(ini(n))}</span>${e(n)}</li>`).join('')
    return `<div class="client-row" data-dir="${rev ? 'rtl' : 'ltr'}"><div class="client-track"><ul class="client-set">${li}</ul><ul class="client-set" aria-hidden="true">${li}</ul></div></div>`
  }
  return `<section class="section clients-band" aria-label="${t.clientsh}"><div class="container clients-head"><div><p class="eyebrow">${t.clients}</p><h2>${t.clientsh}</h2></div><p>${t.clientsp}</p></div>`
    + `<div class="client-marquee">${row(names.slice(0, half), false)}${row(names.slice(half), true)}</div></section>`
}

function allHtmlFiles(dir = ROOT, out = []) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '_next', 'server', 'scripts', 'docs', 'data', 'images', 'admin'].includes(d.name)) continue
    const f = path.join(dir, d.name)
    if (d.isDirectory()) allHtmlFiles(f, out)
    else if (d.name === 'index.html') out.push(f)
  }
  return out
}

export function buildSite() {
  const c = loadContent(), team = c.team.published, clients = c.clients.published, k = c.contact.published
  // keep the Instagram account used by the Update pages in step with Contact settings
  const store = loadStore()
  if (k.instagram && store.account !== k.instagram) { store.account = k.instagram; saveStore(store) }

  for (const l of ['en', 'id']) for (const rel of PAGES[l]) {
    const f = path.join(ROOT, rel); if (!fs.existsSync(f)) continue
    let h = fs.readFileSync(f, 'utf8')
    if (rel.endsWith('about/index.html')) {
      // first run migrates the old unmarked sections into marker blocks
      h = setBlock(h, 'team', teamHtml(l, team), /<section class="section about-team">.*?<\/section>/s) ?? h
      h = setBlock(h, 'contactinfo', contactHtml(l, k), /<section class="section about-contact">.*?<\/section>/s) ?? h
    } else if (h.includes('<!--clients-start-->')) {
      h = setBlock(h, 'clients', clientsHtml(l, clients)) ?? h
    }
    fs.writeFileSync(f, h)
  }
  // contact email everywhere (links + visible address)
  if (k.email) for (const f of allHtmlFiles()) {
    const h = fs.readFileSync(f, 'utf8')
    const n = h.replace(/mailto:[^"']+/g, () => `mailto:${e(k.email)}`).replace(/>[\w.+-]+@[\w-]+\.[\w.-]+</g, () => `>${e(k.email)}<`)
    if (n !== h) fs.writeFileSync(f, n)
  }
  return buildUpdates()
}
