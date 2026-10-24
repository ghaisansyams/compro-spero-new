// Portfolio rails / "show all" grid / lightbox (port of the original generator; now driven by CMS data).
const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const CATN = { '3d': '3D & Creative', games: 'Game', products: 'Product' }
export const WORK_L = {
  en: { live: 'Live demo', priv: 'Private', prev: 'Previous project', next: 'Next project', all: 'Show all work', less: 'Show less', allh: 'All work', filters: { all: 'All', products: 'Products', '3d': '3D & Creative', games: 'Games' }, open: 'Open screens', hint: 'Drag or scroll sideways', show: 'Show all', hide: 'Show less', liveS: 'Live' },
  id: { live: 'Demo langsung', priv: 'Privat', prev: 'Proyek sebelumnya', next: 'Proyek berikutnya', all: 'Lihat semua karya', less: 'Sembunyikan', allh: 'Semua karya', filters: { all: 'Semua', products: 'Produk', '3d': '3D & Kreatif', games: 'Game' }, open: 'Buka layar', hint: 'Geser atau gulir ke samping', show: 'Lihat semua', hide: 'Sembunyikan', liveS: 'Live' },
}
const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : '')
const chips = (arr, n) => arr.slice(0, n).map((x) => `<li>${e(x)}</li>`).join('')
const color = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#006ce5')

function desc(p, t) {
  return `<div class="work-descwrap"><p class="work-desc">${e(p.desc)}</p><button type="button" class="work-toggle" hidden data-show="${t.show}" data-hide="${t.hide}" aria-expanded="false">${t.show}</button></div>`
}
function status(p, t) {
  if (p.kind !== 'flagship') return ''
  return p.live ? `<span class="work-status is-live">${t.liveS}</span>` : `<span class="work-status">${t.priv}</span>`
}
function action(p, t) {
  if (p.kind === 'flagship' || !safeUrl(p.live)) return ''
  return `<div class="work-actions"><a class="button" href="${e(p.live)}" target="_blank" rel="noopener noreferrer"><span>${t.live}</span> <span aria-hidden="true">↗</span></a></div>`
}
function shot(p, t) {
  const im = p.images[0] || { src: '/images/placeholder.svg', label: p.name }
  return `<button class="work-shot" type="button" data-work="${e(p.id)}" aria-label="${t.open}: ${e(p.name)}"><span class="work-bar"><i></i><i></i><i></i></span>`
    + `<img src="${e(im.src)}" alt="${e(p.name)} — ${e(im.label)}" loading="lazy" width="1440" height="900" draggable="false"/>`
    + (p.images.length > 1 ? `<span class="work-count">${p.images.length}</span>` : '') + '</button>'
}
function slide(i, p, t) {
  const meta = [p.year, p.role].filter(Boolean).join(' · ') || CATN[p.cat] || ''
  const stats = (p.stats || []).map((s) => `<div><dt>${e(s.value)}</dt><dd>${e(s.label)}</dd></div>`).join('')
  return `<article class="work-slide" data-slide style="--c:${color(p.color)}">${shot(p, t)}<div class="work-body"><div class="work-top"><span class="work-num">${String(i + 1).padStart(2, '0')}</span><span class="work-meta">${e(meta)}</span>${status(p, t)}</div>`
    + `<h3>${e(p.name)}</h3>${p.subtitle ? `<p class="work-sub">${e(p.subtitle)}</p>` : ''}${desc(p, t)}<ul class="work-chips">${chips(p.tech || [], 6)}</ul>${stats ? `<dl class="work-stats">${stats}</dl>` : ''}${action(p, t)}</div></article>`
}
function rail(t, lst, head) {
  if (!lst.length) return ''
  return `<div class="work-group">${head}<div class="work-rail-wrap" data-work-rail><div class="work-controls"><p class="work-hint">${t.hint}</p><div class="work-nav"><span class="work-counter" data-counter>01 / ${String(lst.length).padStart(2, '0')}</span>`
    + `<button type="button" class="icon-button work-btn" data-prev aria-label="${t.prev}">←</button><button type="button" class="icon-button work-btn" data-next aria-label="${t.next}">→</button></div></div>`
    + `<div class="work-rail" data-track tabindex="0">${lst.map((p, i) => slide(i, p, t)).join('')}</div><div class="work-progress"><span data-bar></span></div></div></div>`
}
function card(p, t) {
  const sub = p.subtitle && p.kind === 'flagship' ? `<p class="work-sub">${e(p.subtitle)}</p>` : ''
  return `<article class="work-card" data-cat="${e(p.cat)}" style="--c:${color(p.color)}">${shot(p, t)}<div class="work-body"><div class="work-top"><span class="work-meta">${e(CATN[p.cat] || '')}</span>${status(p, t)}</div><h3>${e(p.name)}</h3>${sub}${desc(p, t)}<ul class="work-chips">${chips(p.tech || [], 4)}</ul>${action(p, t)}</div></article>`
}

/** @param {{lang:'en'|'id', projects:any[], texts:{productsTitle:string,productsDesc:string,moreTitle:string,moreDesc:string}, mode:'teaser'|'full'}} o */
export function workBlock({ lang, projects, texts, mode }) {
  const t = WORK_L[lang], flag = projects.filter((p) => p.kind === 'flagship'), more = projects.filter((p) => p.kind !== 'flagship')
  const head = (a, b) => `<div class="work-group-head"><h3>${e(a)}</h3><p>${e(b)}</p></div>`
  const rails = rail(t, flag, head(texts.productsTitle, texts.productsDesc)) + rail(t, more, head(texts.moreTitle, texts.moreDesc))
  if (mode === 'teaser') return `${rails}<div class="work-more"><a class="button" href="${lang === 'id' ? '/id' : ''}/portfolio#all"><span>${t.all}</span> <span aria-hidden="true">→</span></a></div>`
  const pills = Object.entries(t.filters).map(([k, v]) => `<button type="button" class="work-pill${k === 'all' ? ' is-on' : ''}" data-filter="${k}">${v}</button>`).join('')
  return `<section class="container work-section">${rails}<div class="work-more"><button type="button" class="button" data-toggle-all aria-expanded="false" data-more="${t.all}" data-less="${t.less}"><span>${t.all}</span> <span aria-hidden="true">↓</span></button></div>`
    + `<div class="work-all" id="all" hidden><div class="work-all-head"><h2>${t.allh} <span>(${projects.length})</span></h2><div class="work-pills">${pills}</div></div><div class="work-grid">${projects.map((p) => card(p, t)).join('')}</div></div></section>`
}
export function workExtras(projects) {
  const data = Object.fromEntries(projects.map((p) => [p.id, { name: p.name, images: p.images }]))
  return `<script type="application/json" id="work-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
    + '<div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true"><button type="button" class="lb-close" data-close aria-label="Close">×</button><button type="button" class="lb-nav lb-prev" data-lb-prev aria-label="Previous">←</button><figure><img alt="" src=""/><figcaption></figcaption></figure><button type="button" class="lb-nav lb-next" data-lb-next aria-label="Next">→</button></div>'
}
