// Shared helpers for the admin UI. Every dynamic value goes through textContent / attributes (no innerHTML).
export const st = { user: null, view: 'dashboard', sub: '', lang: localStorage.getItem('adminLang') === 'id' ? 'id' : 'en', schema: null, route: () => {}, renderLogin: () => {} }
const toasts = document.getElementById('toasts')

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className = v
    else if (k === 'value') el.value = v
    else if (v === true) el.setAttribute(k, '')
    else el.setAttribute(k, v)
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)))
  return el
}
export const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
export const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '—'
export const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'
export const clone = (x) => JSON.parse(JSON.stringify(x))
export function toast(msg, err) { const t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg); toasts.append(t); setTimeout(() => t.remove(), err ? 7000 : 3200) }

export async function api(path, method = 'GET', body) {
  const res = await fetch('/api/admin' + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  let data = {}; try { data = await res.json() } catch { /* empty */ }
  if (res.status === 401 && st.user) { st.user = null; st.renderLogin('Sesi berakhir. Silakan masuk lagi.') }
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`)
  return data
}
export const guard = (fn) => async (...a) => { try { return await fn(...a) } catch (err) { toast(err.message, true) } }

export function modal(title, body, buttons, wide, onClose) {
  const close = () => { if (!ov.isConnected) return; ov.remove(); document.removeEventListener('keydown', esc); onClose?.() }
  const esc = (e) => { if (e.key === 'Escape') close() }
  const ov = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === ov) close() } },
    h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', {}, title), body,
      buttons ? h('div', { class: 'foot' }, buttons.map((b) => h('button', { class: 'btn ' + (b.cls || ''), type: 'button', onclick: guard(async () => { if ((await b.run?.(close)) !== false && b.close !== false) close() }) }, b.label))) : null))
  document.addEventListener('keydown', esc); document.body.append(ov); return close
}
export const confirmBox = (title, text, label = 'Ya, lanjut') => new Promise((resolve) => {
  let done = false
  const set = (v) => { if (!done) { done = true; resolve(v) } }
  modal(title, h('p', {}, text), [{ label: 'Batal', run: () => set(false) }, { label, cls: 'primary', run: () => set(true) }], false, () => set(false))
})
export const field = (label, input, hint) => h('div', { class: 'field' }, h('label', {}, label), input, hint ? h('div', { class: 'hint' }, hint) : null)
export const top = (title, sub, ...actions) => h('div', { class: 'top' }, h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null), h('div', { class: 'row' }, actions))

function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) }) }
export async function upload(file) {
  if (!file) return null
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran maksimal 5 MB.')
  return api('/media', 'POST', { data: await readFile(file) })
}
/** Choose from the media library or upload a new image. Resolves with the URL, or null. */
export function pickImage() {
  return new Promise((resolve) => {
    let picked = null, closeFn
    const grid = h('div', { class: 'mgrid' }), input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true })
    const finish = (u) => { picked = u; closeFn() }
    const load = guard(async () => {
      const { items } = await api('/media'); grid.replaceChildren()
      if (!items.length) grid.append(h('div', { class: 'empty' }, 'Belum ada gambar. Unggah dulu.'))
      for (const m of items) grid.append(h('div', { class: 'tile pick', onclick: () => finish(m.url) }, h('img', { src: m.url, alt: '' }), h('div', { class: 'm' }, m.name)))
    })
    input.addEventListener('change', guard(async () => { const f = await upload(input.files[0]); toast('Gambar diunggah.'); finish(f.url) }))
    closeFn = modal('Pilih gambar', h('div', {}, h('div', { class: 'row', style: 'margin-bottom:14px' }, h('button', { class: 'btn primary', type: 'button', onclick: () => input.click() }, 'Unggah gambar baru'), h('span', { class: 'hint' }, 'JPG, PNG, atau WebP · maks. 5 MB'), input), grid), [{ label: 'Tutup' }], false, () => resolve(picked))
    load()
  })
}

/* ---------- friendly names + routing for collections ---------- */
export const COL_NAMES = { site: 'Situs & footer', nav: 'Menu', theme: 'Tema', team: 'Tim', clients: 'Klien', contact: 'Kontak', portfolio: 'Portofolio (karya)', 'page:home': 'Halaman Beranda', 'page:services': 'Halaman Layanan', 'page:about': 'Halaman Tentang', 'page:portfolio': 'Halaman Portofolio', 'page:update': 'Halaman Update' }
export const colRoute = (key) => key.startsWith('page:') ? `pages/${key.slice(5)}` : ({ nav: 'menu' }[key] || key)
export const colApi = (key) => key.replace('page:', 'page.')

/* ---------- draft -> publish bar ---------- */
export function pubBar({ key, collect, state, reload, preview }) {
  const apiKey = colApi(key), msg = h('span', { class: 'msg' }), note = h('input', { type: 'text', placeholder: 'Catatan versi (opsional)', maxlength: 120, style: 'width:200px' })
  const bar = h('div', { class: 'pubbar' }), btn = (label, cls, fn) => h('button', { class: 'btn ' + cls, type: 'button', onclick: guard(fn) }, label)
  const save = btn('Simpan draf', '', async () => { const r = await api('/content/' + apiKey, 'PUT', { data: collect() }); state.local = false; state.server = r.dirty; state.changes = r.changes; toast('Draf tersimpan.'); refresh() })
  const pub = btn('Simpan & terbitkan', 'primary', async () => {
    if (state.local) { const r = await api('/content/' + apiKey, 'PUT', { data: collect() }); state.server = r.dirty }
    await api(`/content/${apiKey}/publish`, 'POST', { note: note.value }); state.local = false; state.server = false; state.changes = []; note.value = ''; toast('Diterbitkan. Situs sudah diperbarui.'); refresh()
  })
  const dis = btn('Buang perubahan', 'danger', async () => { if (!(await confirmBox('Buang perubahan?', 'Draf dikembalikan ke versi yang sedang tayang.', 'Buang'))) return; await api(`/content/${apiKey}/discard`, 'POST', {}); reload() })
  const diff = btn('Lihat perubahan', '', async () => { const r = await api('/content/' + apiKey); showChanges('Perubahan yang belum diterbitkan', r.changes) })
  const prev = preview ? h('button', { class: 'btn', type: 'button', onclick: async () => { if (state.local) { try { await api('/content/' + apiKey, 'PUT', { data: collect() }); state.local = false; refresh() } catch (e) { return toast(e.message, true) } } previewModal(preview) } }, 'Pratinjau draf') : null
  function refresh() {
    bar.className = 'pubbar' + (state.local || state.server ? ' dirty' : '')
    msg.textContent = state.local ? 'Ada perubahan yang belum disimpan.' : state.server ? 'Draf tersimpan, tetapi belum diterbitkan ke situs.' : 'Semua perubahan sudah tayang di situs.'
    save.disabled = !state.local; pub.disabled = !(state.local || state.server); dis.disabled = !(state.local || state.server); diff.hidden = !(state.server && !state.local); note.hidden = pub.disabled
  }
  bar.append(msg, note, prev, diff, save, pub, dis); refresh(); bar.touch = () => { state.local = true; refresh() }; return bar
}
export function showChanges(title, changes) {
  modal(title, changes.length ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Bagian', 'Sebelumnya', 'Sesudahnya'].map((x) => h('th', {}, x)))),
    h('tbody', {}, changes.map((c) => h('tr', {}, h('td', { class: 's' }, c.path), h('td', {}, c.before), h('td', {}, c.after))))) : h('p', {}, 'Tidak ada perbedaan.'), [{ label: 'Tutup' }], true)
}
export function previewModal(page) {
  let lang = st.lang, device = 'desktop'
  const frame = h('iframe', { class: 'pv-frame', title: 'Pratinjau' }), wrap = h('div', { class: 'pv-wrap' }, frame)
  const load = () => { frame.src = `/api/admin/preview?page=${encodeURIComponent(page)}&lang=${lang}&t=${Date.now()}`; wrap.className = 'pv-wrap ' + device }
  const seg = (items, cur, set) => h('div', { class: 'seg' }, items.map(([v, l]) => h('button', { type: 'button', class: v === cur ? 'on' : '', onclick: (e) => { set(v); e.target.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target)); load() } }, l)))
  modal('Pratinjau draf (belum tayang)', h('div', {}, h('div', { class: 'row', style: 'margin-bottom:12px' }, seg([['en', 'EN'], ['id', 'ID']], lang, (v) => { lang = v }), seg([['desktop', 'Desktop'], ['mobile', 'HP']], device, (v) => { device = v })), wrap), [{ label: 'Tutup' }], true)
  load()
}
