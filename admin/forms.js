// Schema-driven form renderer (field types are defined in scripts/lib/schema.mjs and served by /api/admin/schema).
import { h, st, field, clone } from './lib.js'

const other = () => (st.lang === 'en' ? 'id' : 'en')
export function blank(fields) {
  const o = {}
  for (const f of fields) {
    o[f.k] = { i: { en: '', id: '' }, it: { en: '', id: '' }, il: { en: [], id: [] }, ip: { en: [], id: [] }, p: '', href: '', ill: 'connection', bool: false, list: [] }[f.t]
    if (f.t === 'sel') o[f.k] = f.def ?? f.options[0][0]
    if (f.t === 'obj') o[f.k] = blank(f.fields)
    o[f.k] = clone(o[f.k])
  }
  return o
}
const HREFS = ['/', '/services', '/portfolio', '/update', '/about', '/services#software', '/services#interfaces', '/services#identity', '/portfolio#all', 'mailto:{email}', 'https://www.instagram.com/{instagram}/', 'tel:+62']
function datalist() {
  if (!document.getElementById('hrefs')) document.body.append(h('datalist', { id: 'hrefs' }, HREFS.map((x) => h('option', { value: x }))))
}
const reorder = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false;[arr[i], arr[j]] = [arr[j], arr[i]]; return true }

/** Editable list of lines (il) or paragraphs (ip) for the current language. */
function linesEditor(f, obj, touch) {
  const wrap = h('div', { class: 'lines' }), long = f.t === 'ip'
  const arr = () => { obj[f.k] ??= { en: [], id: [] }; return (obj[f.k][st.lang] ??= []) }
  function draw() {
    wrap.replaceChildren()
    arr().forEach((v, i) => {
      const input = long ? h('textarea', { rows: 3, maxlength: f.max, oninput: (e) => { arr()[i] = e.target.value; touch(); warn() } }) : h('input', { type: 'text', maxlength: f.max, value: v, oninput: (e) => { arr()[i] = e.target.value; touch(); warn() } })
      if (long) input.value = v
      wrap.append(h('div', { class: 'lrow' }, input, h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn sm', title: 'Naik', disabled: i === 0, onclick: () => { reorder(arr(), i, -1); touch(); draw() } }, '↑'),
        h('button', { type: 'button', class: 'btn sm', title: 'Turun', disabled: i === arr().length - 1, onclick: () => { reorder(arr(), i, 1); touch(); draw() } }, '↓'),
        h('button', { type: 'button', class: 'btn sm danger', title: 'Hapus', onclick: () => { arr().splice(i, 1); touch(); draw() } }, '×'))))
    })
    wrap.append(h('button', { type: 'button', class: 'btn sm', disabled: arr().length >= (f.maxItems || 12), onclick: () => { arr().push(''); touch(); draw() } }, '+ Tambah baris'), warnEl)
    warn()
  }
  const warnEl = h('div', { class: 'hint warn' })
  const warn = () => { const o = obj[f.k]?.[other()] || []; warnEl.textContent = !o.length && arr().length ? `Versi ${other().toUpperCase()} masih kosong (akan memakai EN bila kosong).` : '' }
  draw(); return field(f.label, wrap)
}
function simple(f, obj, touch) {
  const L = st.lang, hint = h('div', { class: 'hint warn' })
  const set = (v) => { if (f.t === 'i' || f.t === 'it') { obj[f.k] ??= { en: '', id: '' }; obj[f.k][L] = v } else obj[f.k] = v; touch(); warn() }
  const val = () => (f.t === 'i' || f.t === 'it' ? (obj[f.k]?.[L] ?? '') : (obj[f.k] ?? ''))
  const warn = () => { if (f.t === 'i' || f.t === 'it') { const o = obj[f.k]?.[other()]; hint.textContent = !o && val() ? `Versi ${other().toUpperCase()} masih kosong (akan memakai EN bila kosong).` : '' } }
  let el
  if (f.t === 'it') { el = h('textarea', { rows: 3, maxlength: f.max, oninput: (e) => set(e.target.value) }); el.value = val() }
  else if (f.t === 'ill') el = h('select', { onchange: (e) => set(e.target.value) }, st.schema.illustrations.map((n) => h('option', { value: n, selected: val() === n }, n)))
  else if (f.t === 'sel') el = h('select', { onchange: (e) => set(e.target.value) }, f.options.map(([v, l]) => h('option', { value: v, selected: String(val()) === v }, l)))
  else if (f.t === 'bool') return h('div', { class: 'field' }, h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!val(), onchange: (e) => set(e.target.checked) }), ' ', f.label))
  else if (f.t === 'href') { datalist(); el = h('input', { type: 'text', list: 'hrefs', value: val(), placeholder: '/halaman, #anchor, https://…', oninput: (e) => set(e.target.value) }) }
  else el = h('input', { type: 'text', maxlength: f.max, value: val(), oninput: (e) => set(e.target.value) })
  warn(); return field(f.label + (f.t === 'i' || f.t === 'it' ? ` (${L.toUpperCase()})` : ''), h('div', {}, el, hint))
}
function summaryOf(f, item) {
  for (const sf of f.fields) { const v = item[sf.k]; const t = typeof v === 'string' ? v : v?.[st.lang] || v?.en; if (typeof t === 'string' && t.trim() && (sf.t === 'i' || sf.t === 'p')) return t.slice(0, 60) }
  return ''
}
function listEditor(f, obj, touch) {
  const wrap = h('div', { class: 'items' })
  obj[f.k] ??= []
  function draw() {
    wrap.replaceChildren(); const arr = obj[f.k]
    arr.forEach((item, i) => {
      const body = h('div', { class: 'ibody' }, renderFields(f.fields, item, touch))
      wrap.append(h('details', { class: 'item' }, h('summary', {}, h('span', { class: 'n' }, `#${i + 1}`), h('span', { class: 't' }, summaryOf(f, item) || '(kosong)'), h('span', { class: 'acts' },
        h('button', { type: 'button', class: 'btn sm', title: 'Naik', disabled: i === 0, onclick: (e) => { e.preventDefault(); reorder(arr, i, -1); touch(); draw() } }, '↑'),
        h('button', { type: 'button', class: 'btn sm', title: 'Turun', disabled: i === arr.length - 1, onclick: (e) => { e.preventDefault(); reorder(arr, i, 1); touch(); draw() } }, '↓'),
        h('button', { type: 'button', class: 'btn sm danger', title: 'Hapus', onclick: (e) => { e.preventDefault(); arr.splice(i, 1); touch(); draw() } }, 'Hapus'))), body))
    })
    wrap.append(h('button', { type: 'button', class: 'btn sm', disabled: arr.length >= (f.max || 20), onclick: () => { arr.push(blank(f.fields)); touch(); draw(); wrap.querySelector('details:last-of-type')?.setAttribute('open', '') } }, '+ Tambah'))
  }
  draw(); return field(f.label, wrap)
}
export function renderFields(fields, obj, touch) {
  const frag = document.createDocumentFragment()
  for (const f of fields) {
    if (f.t === 'il' || f.t === 'ip') frag.append(linesEditor(f, obj, touch))
    else if (f.t === 'list') frag.append(listEditor(f, obj, touch))
    else if (f.t === 'obj') { obj[f.k] ??= blank(f.fields); frag.append(h('fieldset', { class: 'sub' }, h('legend', {}, f.label), renderFields(f.fields, obj[f.k], touch))) }
    else frag.append(simple(f, obj, touch))
  }
  return frag
}
