// Spero admin / CMS. Vanilla JS; every dynamic value goes through textContent / attributes (no innerHTML).
const app = document.getElementById('app'), toasts = document.getElementById('toasts')
const st = { user: null, view: 'dashboard', counts: null }

/* ---------- tiny helpers ---------- */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className = v
    else if (k === 'value') el.value = v
    else if (v === true) el.setAttribute(k, '')
    else el.setAttribute(k, v)
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)))
  return el
}
const fmtDT = (iso) => iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '—'
const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'
function toast(msg, err) {
  const t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg); toasts.append(t); setTimeout(() => t.remove(), err ? 6000 : 3200)
}
async function api(path, method = 'GET', body) {
  const res = await fetch('/api/admin' + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  let data = {}; try { data = await res.json() } catch { /* empty */ }
  if (res.status === 401 && st.user) { st.user = null; renderLogin('Sesi berakhir. Silakan masuk lagi.') }
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`)
  return data
}
const guard = (fn) => async (...a) => { try { return await fn(...a) } catch (err) { toast(err.message, true) } }
function modal(title, body, buttons) {
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc) }
  const esc = (e) => { if (e.key === 'Escape') close() }
  const ov = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === ov) close() } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', {}, title), body,
      buttons ? h('div', { class: 'foot' }, buttons.map((b) => h('button', { class: 'btn ' + (b.cls || ''), type: 'button', onclick: guard(async () => { if ((await b.run?.(close)) !== false && b.close !== false) close() }) }, b.label))) : null))
  document.addEventListener('keydown', esc); document.body.append(ov); return close
}
const confirmBox = (title, text, label = 'Ya, lanjut') => new Promise((resolve) => {
  let done = false
  const close = modal(title, h('p', {}, text), [{ label: 'Batal', close: true, run: () => { if (!done) resolve(false); done = true } }, { label, cls: 'primary', run: () => { done = true; resolve(true) } }])
  void close
})
const field = (label, input, hint) => h('div', { class: 'field' }, h('label', {}, label), input, hint ? h('div', { class: 'hint' }, hint) : null)
function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) }) }
async function upload(file) {
  if (!file) return null
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran maksimal 5 MB.')
  return api('/media', 'POST', { data: await readFile(file) })
}
function pickImage() {   // resolves with an image URL from the media library, or null
  return new Promise((resolve) => {
    let picked = null
    const grid = h('div', { class: 'mgrid' }), input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true })
    const finish = (u, close) => { picked = u; close() }
    let closeFn
    const load = guard(async () => {
      const { items } = await api('/media'); grid.replaceChildren()
      if (!items.length) grid.append(h('div', { class: 'empty' }, 'Belum ada gambar. Unggah dulu.'))
      for (const m of items) grid.append(h('div', { class: 'tile pick', onclick: () => finish(m.url, closeFn) }, h('img', { src: m.url, alt: '' }), h('div', { class: 'm' }, m.name)))
    })
    input.addEventListener('change', guard(async () => { const f = await upload(input.files[0]); toast('Gambar diunggah.'); finish(f.url, closeFn) }))
    closeFn = modal('Pilih gambar', h('div', {}, h('div', { class: 'row', style: 'margin-bottom:14px' }, h('button', { class: 'btn primary', type: 'button', onclick: () => input.click() }, 'Unggah gambar baru'), h('span', { class: 'hint' }, 'JPG, PNG, atau WebP · maks. 5 MB'), input), grid), [{ label: 'Tutup', close: true }])
    const obs = new MutationObserver(() => { if (!document.body.contains(grid)) { obs.disconnect(); resolve(picked) } }); obs.observe(document.body, { childList: true })
    load()
  })
}

/* ---------- login ---------- */
function renderLogin(msg = '') {
  const err = h('div', { class: 'err', role: 'alert' }, msg), u = h('input', { type: 'text', autocomplete: 'username', required: true, autofocus: true }), p = h('input', { type: 'password', autocomplete: 'current-password', required: true })
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = ''
    try { const r = await api('/login', 'POST', { username: u.value.trim(), password: p.value }); st.user = r.user; boot() } catch (x) { err.textContent = x.message; p.value = '' }
  } },
  h('div', { class: 'brand' }, h('img', { src: '/spero-icon.png', alt: '' }), h('div', {}, 'Spero Admin', h('small', {}, 'PT. Spero Mahakarya Nusantara'))),
  h('h1', {}, 'Masuk'), h('p', { class: 'hint', style: 'margin-bottom:18px' }, 'Gunakan akun admin atau editor.'), err,
  field('Username', u), field('Kata sandi', p), h('button', { class: 'btn primary', style: 'width:100%;justify-content:center', type: 'submit' }, 'Masuk'))
  app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'card' }, form)))
}

/* ---------- shell ---------- */
const NAV = [['dashboard', 'Dashboard'], ['updates', 'Update'], ['team', 'Tim'], ['clients', 'Klien'], ['contact', 'Kontak'], ['media', 'Media'], ['users', 'Pengguna', 'admin'], ['activity', 'Aktivitas', 'admin'], ['account', 'Akun saya']]
async function boot() {
  try { st.user = (await api('/me')).user } catch { return renderLogin() }
  window.addEventListener('hashchange', route)
  route()
}
async function route() {
  if (!st.user) return
  st.view = location.hash.slice(1) || 'dashboard'
  if (!NAV.some(([k, , r]) => k === st.view && (!r || r === st.user.role))) st.view = 'dashboard'
  const main = h('main', { class: 'main' }, h('p', { class: 'boot' }, 'Memuat…'))
  app.replaceChildren(h('div', { class: 'shell' }, sidebar(), main))
  try { main.replaceChildren(...(await VIEWS[st.view]())) } catch (err) { main.replaceChildren(h('div', { class: 'empty' }, err.message)) }
}
function sidebar() {
  return h('aside', { class: 'side' },
    h('div', { class: 'brand' }, h('img', { src: '/spero-icon.png', alt: '' }), h('div', {}, 'Spero Admin', h('small', {}, 'CMS website'))),
    NAV.filter(([, , r]) => !r || r === st.user.role).map(([k, label]) => h('button', { class: 'nav', type: 'button', 'aria-current': st.view === k ? 'page' : null, onclick: () => { location.hash = k } }, label)),
    h('a', { class: 'nav', href: '/', target: '_blank', rel: 'noopener' }, 'Lihat situs ↗'),
    h('div', { class: 'spacer' }),
    h('div', { class: 'who' }, h('b', {}, st.user.name || st.user.username), st.user.role, ' · ', h('a', { href: '#', onclick: guard(async (e) => { e.preventDefault(); await api('/logout', 'POST', {}); st.user = null; renderLogin() }) }, 'Keluar')))
}
const top = (title, sub, ...actions) => h('div', { class: 'top' }, h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null), h('div', { class: 'row' }, actions))

/* ---------- publish bar (team / clients / contact) ---------- */
function pubBar({ key, collect, state, reload }) {
  const msg = h('span', { class: 'msg' }), bar = h('div', { class: 'pubbar' }), btn = (label, cls, fn) => h('button', { class: 'btn ' + cls, type: 'button', onclick: guard(fn) }, label)
  const save = btn('Simpan draf', '', async () => { const r = await api('/' + key, 'PUT', collect()); state.local = false; state.server = r.dirty; toast('Draf tersimpan.'); refresh() })
  const pub = btn('Simpan & terbitkan', 'primary', async () => {
    if (state.local) { const r = await api('/' + key, 'PUT', collect()); state.server = r.dirty }
    const r = await api(`/${key}/publish`, 'POST', {}); state.local = false; state.server = r.dirty; toast('Diterbitkan. Situs sudah diperbarui.'); refresh()
  })
  const dis = btn('Buang perubahan', 'danger', async () => { if (!(await confirmBox('Buang perubahan?', 'Draf dikembalikan ke versi yang sedang tayang.', 'Buang'))) return; await api(`/${key}/discard`, 'POST', {}); reload() })
  function refresh() {
    bar.className = 'pubbar' + (state.local || state.server ? ' dirty' : '')
    msg.textContent = state.local ? 'Ada perubahan yang belum disimpan.' : state.server ? 'Draf tersimpan, tetapi belum diterbitkan ke situs.' : 'Semua perubahan sudah tayang di situs.'
    save.disabled = !state.local; pub.disabled = !(state.local || state.server); dis.disabled = !(state.local || state.server)
  }
  bar.append(msg, save, pub, dis); refresh(); bar.touch = () => { state.local = true; refresh() }; return bar
}

/* ---------- dashboard ---------- */
async function viewDashboard() {
  const s = await api('/summary'), u = s.updates
  const stat = (n, l, href) => h('a', { class: 'card stat', href, style: 'text-decoration:none;color:inherit' }, h('b', {}, n), h('span', {}, l))
  const notes = [s.team.dirty && ['Tim', '#team'], s.clients.dirty && ['Klien', '#clients'], s.contact.dirty && ['Kontak', '#contact']].filter(Boolean)
  return [top('Dashboard', `Halo, ${st.user.name || st.user.username}.`),
    h('div', { class: 'grid g4', style: 'margin-bottom:16px' }, stat(u.published, 'Update tayang', '#updates'), stat(u.drafts, 'Draf menunggu', '#updates'), stat(s.team.count, 'Anggota tim', '#team'), stat(s.clients.count, 'Klien', '#clients')),
    notes.length ? h('div', { class: 'card', style: 'margin-bottom:16px;border-color:var(--warn)' }, h('b', {}, 'Perubahan belum diterbitkan: '), notes.map(([l, href], i) => [i ? ', ' : '', h('a', { href }, l)])) : null,
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', {}, 'Instagram'), h('p', {}, `@${u.account || '—'} · sinkron terakhir: ${fmtDT(u.lastSync)}`),
        h('p', {}, h('span', { class: 'badge ' + (s.apify ? 'ok' : 'warn') }, s.apify ? 'APIFY_TOKEN terpasang' : 'APIFY_TOKEN belum diatur')),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#updates' }, 'Kelola update'))),
      h('div', { class: 'card' }, h('h3', {}, 'Situs'), h('p', { class: 'hint' }, 'Halaman publik dibuat statis dari konten yang sudah diterbitkan.'),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'Buka situs ↗'),
          st.user.role === 'admin' ? h('button', { class: 'btn', type: 'button', onclick: guard(async () => { const r = await api('/rebuild', 'POST', {}); toast(`Dibangun ulang: ${r.published} update tayang.`) }) }, 'Bangun ulang halaman') : null)))]
}

/* ---------- updates ---------- */
async function viewUpdates() {
  const data = await api('/updates'); let filter = 'all', q = ''
  const tbody = h('tbody'), table = h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['', 'Judul', 'Kategori', 'Tanggal', 'Status', 'Aksi'].map((x) => h('th', {}, x)))), tbody)
  const statusOf = (i) => !i.published ? ['Draf', 'warn'] : i.visible ? ['Tayang', 'ok'] : ['Tersembunyi', '']
  const patch = guard(async (key, body, msg) => { await api('/updates/' + key, 'PATCH', body); toast(msg); route() })
  function draw() {
    tbody.replaceChildren()
    const rows = data.items.filter((i) => (filter === 'all' || (filter === 'draft' && !i.published) || (filter === 'live' && i.published && i.visible) || (filter === 'hidden' && i.published && !i.visible)) && (!q || (i.title + i.caption).toLowerCase().includes(q)))
    if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: 6 }, h('div', { class: 'empty' }, data.items.length ? 'Tidak ada yang cocok.' : 'Belum ada update. Jalankan “Sinkron Instagram” atau buat update manual.'))))
    for (const i of rows) {
      const [sl, sc] = statusOf(i)
      tbody.append(h('tr', {},
        h('td', {}, h('img', { src: i.imageUrl, alt: '' })),
        h('td', {}, h('div', { class: 't' }, i.title), h('div', { class: 's' }, i.source === 'manual' ? 'Manual' : 'Instagram', i.edited && i.source !== 'manual' ? ' · diedit' : '')),
        h('td', {}, h('span', { class: 'badge acc' }, i.category)), h('td', {}, fmtD(i.publishedAt)), h('td', {}, h('span', { class: 'badge ' + sc }, sl)),
        h('td', {}, h('div', { class: 'acts' },
          i.published ? h('button', { class: 'btn sm', onclick: () => patch(i.key, { published: false }, 'Ditarik jadi draf.') }, 'Tarik') : h('button', { class: 'btn sm primary', onclick: () => patch(i.key, { published: true }, 'Diterbitkan.') }, 'Terbitkan'),
          i.published ? h('button', { class: 'btn sm', onclick: () => patch(i.key, { visible: !i.visible }, i.visible ? 'Disembunyikan.' : 'Ditampilkan.') }, i.visible ? 'Sembunyikan' : 'Tampilkan') : null,
          h('button', { class: 'btn sm', onclick: () => editUpdate(i, data.categories) }, 'Edit'),
          i.published && i.visible ? h('a', { class: 'btn sm', href: '/update/' + i.slug + '/', target: '_blank', rel: 'noopener' }, 'Lihat') : null,
          i.source === 'manual' ? h('button', { class: 'btn sm danger', onclick: guard(async () => { if (await confirmBox('Hapus update?', i.title, 'Hapus')) { await api('/updates/' + i.key, 'DELETE'); toast('Dihapus.'); route() } }) }, 'Hapus') : null))))
    }
  }
  const sel = h('select', { style: 'width:auto', onchange: (e) => { filter = e.target.value; draw() } }, [['all', 'Semua'], ['draft', 'Draf'], ['live', 'Tayang'], ['hidden', 'Tersembunyi']].map(([v, l]) => h('option', { value: v }, l)))
  const search = h('input', { type: 'search', placeholder: 'Cari…', style: 'width:200px', oninput: (e) => { q = e.target.value.toLowerCase(); draw() } })
  const sync = h('button', { class: 'btn primary', type: 'button', onclick: guard(async () => {
    if (!(await confirmBox('Sinkron dari Instagram?', `Mengambil postingan terbaru @${data.account} lewat Apify (memakai sedikit kredit). Postingan baru masuk sebagai draf.`, 'Sinkron'))) return
    sync.disabled = true; sync.textContent = 'Menyinkronkan… (bisa 1–2 menit)'
    try { const { report: r } = await api('/updates/sync', 'POST', {}); toast(`${r.saved} tersimpan, ${r.drafts} draf baru, ${r.skipped} dilewati.`); route() } finally { sync.disabled = false; sync.textContent = 'Sinkron Instagram' }
  }) }, 'Sinkron Instagram')
  draw()
  return [top('Update', `Postingan Instagram @${data.account} dan update manual. Sinkron terakhir: ${fmtDT(data.updatedAt)}.`, sync, h('button', { class: 'btn', type: 'button', onclick: () => editUpdate(null, data.categories) }, '+ Update manual')),
    h('div', { class: 'row', style: 'margin-bottom:14px' }, sel, search), table]
}
function editUpdate(item, categories) {
  const f = {
    title: h('input', { type: 'text', value: item?.title || '', maxlength: 120 }), category: h('select', {}, categories.map((c) => h('option', { value: c, selected: item?.category === c }, c))),
    date: h('input', { type: 'date', value: item?.publishedAt || new Date().toISOString().slice(0, 10) }), excerpt: h('input', { type: 'text', value: item?.excerpt || '', maxlength: 240 }),
    caption: h('textarea', { style: 'min-height:160px' }), postUrl: h('input', { type: 'text', value: item?.postUrl || '', placeholder: 'https://www.instagram.com/p/…' }),
  }
  f.caption.value = item?.caption || ''
  let image = item?.imageUrl || '', manual = !item || item.source === 'manual'
  const prev = h('img', { src: image || '/images/placeholder.svg', alt: '', style: 'width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--line)' })
  const choose = h('button', { class: 'btn', type: 'button', onclick: async () => { const u = await pickImage(); if (u) { image = u; prev.src = u } } }, 'Ganti gambar')
  modal(item ? 'Edit update' : 'Update manual', h('div', {}, field('Judul', f.title), h('div', { class: 'grid g2' }, field('Kategori', f.category), field('Tanggal', f.date)),
    field('Ringkasan', f.excerpt, 'Tampil di kartu daftar. Kosongkan untuk dibuat otomatis dari isi (update baru).'), field('Isi / caption', f.caption),
    field('Gambar', h('div', { class: 'row' }, prev, choose)), item && !manual ? field('Link postingan Instagram', f.postUrl) : null,
    item && !manual ? h('p', { class: 'hint' }, 'Setelah diedit, isi tidak akan ditimpa oleh sinkron berikutnya.') : null),
  [{ label: 'Batal', close: true }, { label: 'Simpan', cls: 'primary', run: async () => {
    const body = { title: f.title.value, category: f.category.value, publishedAt: f.date.value, excerpt: f.excerpt.value, caption: f.caption.value, imageUrl: image }
    if (item && !manual) body.postUrl = f.postUrl.value
    if (!item && !body.excerpt.trim()) delete body.excerpt
    if (item && !body.excerpt.trim()) return toast('Ringkasan wajib diisi.', true) || false
    await api(item ? '/updates/' + item.key : '/updates', item ? 'PATCH' : 'POST', body); toast('Tersimpan.'); route()
  } }])
}

/* ---------- team ---------- */
async function viewTeam() {
  const r = await api('/team'); let items = r.draft.map((m) => ({ ...m })); const state = { local: false, server: r.dirty }
  const list = h('div'), bar = pubBar({ key: 'team', state, collect: () => ({ items }), reload: route })
  function draw() {
    list.replaceChildren(); if (!items.length) list.append(h('div', { class: 'empty' }, 'Belum ada anggota tim.'))
    items.forEach((m, i) => list.append(h('div', { class: 'trow' },
      h('img', { class: 'ph', src: m.photo, alt: '', title: 'Klik untuk ganti foto', onclick: async () => { const u = await pickImage(); if (u) { m.photo = u; bar.touch(); draw() } } }),
      h('div', { class: 'field' }, h('label', {}, 'Nama'), h('input', { type: 'text', value: m.name, maxlength: 80, oninput: (e) => { m.name = e.target.value; bar.touch() } })),
      h('div', { class: 'field' }, h('label', {}, 'Jabatan'), h('input', { type: 'text', value: m.role, maxlength: 60, oninput: (e) => { m.role = e.target.value; bar.touch() } })),
      h('div', { class: 'acts' }, h('button', { class: 'btn sm', disabled: i === 0, title: 'Naik', onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; bar.touch(); draw() } }, '↑'),
        h('button', { class: 'btn sm', disabled: i === items.length - 1, title: 'Turun', onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; bar.touch(); draw() } }, '↓'),
        h('button', { class: 'btn sm danger', onclick: () => { items.splice(i, 1); bar.touch(); draw() } }, 'Hapus')))))
  }
  draw()
  return [top('Tim', 'Tampil di halaman About. Urutan di sini = urutan di situs.', h('button', { class: 'btn', type: 'button', onclick: async () => { const u = await pickImage(); if (!u) return; items.push({ name: 'Nama baru', role: 'Jabatan', photo: u }); bar.touch(); draw() } }, '+ Tambah anggota')), bar, list]
}

/* ---------- clients ---------- */
async function viewClients() {
  const r = await api('/clients'); const state = { local: false, server: r.dirty }
  const ta = h('textarea', { style: 'min-height:420px', oninput: () => { count.textContent = parse().length + ' klien'; bar.touch() } }); ta.value = r.draft.join('\n')
  const parse = () => ta.value.split('\n').map((s) => s.trim()).filter(Boolean), count = h('span', { class: 'badge' }, parse().length + ' klien')
  const bar = pubBar({ key: 'clients', state, collect: () => ({ items: parse() }), reload: route })
  return [top('Klien', 'Satu nama per baris. Tampil sebagai marquee “Our Clients” di beranda dan Portfolio.', count), bar, h('div', { class: 'card' }, ta)]
}

/* ---------- contact ---------- */
async function viewContact() {
  const r = await api('/contact'), d = r.draft, state = { local: false, server: r.dirty }
  const ins = { email: h('input', { type: 'email', value: d.email || '' }), phones: h('textarea', { style: 'min-height:80px' }), address: h('textarea', { style: 'min-height:100px' }), instagram: h('input', { type: 'text', value: d.instagram || '' }) }
  ins.phones.value = (d.phones || []).join('\n'); ins.address.value = d.address || ''
  const bar = pubBar({ key: 'contact', state, reload: route, collect: () => ({ email: ins.email.value, phones: ins.phones.value.split('\n').map((s) => s.trim()).filter(Boolean), address: ins.address.value, instagram: ins.instagram.value }) })
  Object.values(ins).forEach((el) => el.addEventListener('input', () => bar.touch()))
  return [top('Kontak', 'Dipakai di halaman About, semua tombol email, dan sebagai akun sumber Update.'), bar,
    h('div', { class: 'card', style: 'max-width:620px' }, field('Email', ins.email, 'Mengganti semua link mailto: di situs.'), field('Telepon', ins.phones, 'Satu nomor per baris (maks. 4).'), field('Alamat', ins.address, 'Maks. 6 baris.'), field('Username Instagram', ins.instagram, 'Tanpa @. Dipakai saat sinkron dan di halaman Update.'))]
}

/* ---------- media ---------- */
async function viewMedia() {
  const { items } = await api('/media'), input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true })
  input.addEventListener('change', guard(async () => { for (const f of input.files) await upload(f); toast('Diunggah.'); route() }))
  return [top('Media', 'Gambar unggahan (tim dan update manual). JPG, PNG, WebP · maks. 5 MB.', h('button', { class: 'btn primary', type: 'button', onclick: () => input.click() }, 'Unggah gambar'), input),
    items.length ? h('div', { class: 'mgrid' }, items.map((m) => h('div', { class: 'tile' }, h('img', { src: m.url, alt: '' }), h('div', { class: 'm' }, m.name, h('br'), kb(m.size)),
      h('div', { class: 'acts', style: 'padding:0 10px 10px' }, h('button', { class: 'btn sm danger', onclick: guard(async () => { if (await confirmBox('Hapus gambar?', m.name, 'Hapus')) { await api('/media/' + m.name, 'DELETE'); toast('Dihapus.'); route() } }) }, 'Hapus'))))) : h('div', { class: 'empty' }, 'Belum ada unggahan.')]
}

/* ---------- users (admin) ---------- */
async function viewUsers() {
  const { users } = await api('/users')
  const rows = users.map((u) => h('tr', {}, h('td', {}, h('b', {}, u.username), h('div', { class: 's' }, u.name)), h('td', {}, h('select', { style: 'width:auto', onchange: guard(async (e) => { await api('/users/' + u.id, 'PATCH', { role: e.target.value }); toast('Peran diubah.'); route() }) }, ['admin', 'editor'].map((r) => h('option', { value: r, selected: u.role === r }, r)))),
    h('td', {}, h('span', { class: 'badge ' + (u.disabled ? 'warn' : 'ok') }, u.disabled ? 'Nonaktif' : 'Aktif')), h('td', {}, fmtDT(u.lastLoginAt)),
    h('td', {}, h('div', { class: 'acts' }, h('button', { class: 'btn sm', onclick: guard(async () => { await api('/users/' + u.id, 'PATCH', { disabled: !u.disabled }); toast('Diperbarui.'); route() }) }, u.disabled ? 'Aktifkan' : 'Nonaktifkan'),
      h('button', { class: 'btn sm', onclick: () => { const p = h('input', { type: 'password', autocomplete: 'new-password' }); modal('Reset kata sandi: ' + u.username, field('Kata sandi baru', p, 'Minimal 10 karakter. Semua sesi pengguna ini dicabut.'), [{ label: 'Batal', close: true }, { label: 'Simpan', cls: 'primary', run: async () => { await api('/users/' + u.id, 'PATCH', { password: p.value }); toast('Kata sandi diganti.') } }]) } }, 'Reset sandi'),
      h('button', { class: 'btn sm danger', onclick: guard(async () => { if (await confirmBox('Hapus pengguna?', u.username, 'Hapus')) { await api('/users/' + u.id, 'DELETE'); toast('Dihapus.'); route() } }) }, 'Hapus')))))
  const add = () => {
    const f = { username: h('input', { type: 'text', autocomplete: 'off' }), name: h('input', { type: 'text' }), role: h('select', {}, ['editor', 'admin'].map((r) => h('option', { value: r }, r))), password: h('input', { type: 'password', autocomplete: 'new-password' }) }
    modal('Tambah pengguna', h('div', {}, field('Username', f.username, 'Huruf kecil, angka, titik, strip, garis bawah.'), field('Nama', f.name), field('Peran', f.role, 'admin: semua akses · editor: konten saja'), field('Kata sandi', f.password, 'Minimal 10 karakter.')),
      [{ label: 'Batal', close: true }, { label: 'Buat', cls: 'primary', run: async () => { await api('/users', 'POST', { username: f.username.value.trim(), name: f.name.value, role: f.role.value, password: f.password.value }); toast('Pengguna dibuat.'); route() } }])
  }
  return [top('Pengguna', 'Akun yang boleh masuk ke admin.', h('button', { class: 'btn primary', type: 'button', onclick: add }, '+ Tambah pengguna')),
    h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Pengguna', 'Peran', 'Status', 'Masuk terakhir', 'Aksi'].map((x) => h('th', {}, x)))), h('tbody', {}, rows))]
}

/* ---------- activity (admin) ---------- */
async function viewActivity() {
  const { items } = await api('/activity')
  return [top('Aktivitas', '200 kejadian terakhir.'), items.length ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Waktu', 'Pengguna', 'Aksi', 'Target', 'Detail'].map((x) => h('th', {}, x)))),
    h('tbody', {}, items.map((a) => h('tr', {}, h('td', {}, fmtDT(a.ts)), h('td', {}, a.user), h('td', {}, h('span', { class: 'badge' }, a.action)), h('td', {}, a.target), h('td', { class: 's' }, a.detail))))) : h('div', { class: 'empty' }, 'Belum ada aktivitas.')]
}

/* ---------- account ---------- */
async function viewAccount() {
  const f = { cur: h('input', { type: 'password', autocomplete: 'current-password' }), next: h('input', { type: 'password', autocomplete: 'new-password' }) }
  return [top('Akun saya', `${st.user.username} · ${st.user.role}`), h('div', { class: 'card', style: 'max-width:460px' }, h('h3', { style: 'margin-bottom:16px' }, 'Ganti kata sandi'),
    field('Kata sandi saat ini', f.cur), field('Kata sandi baru', f.next, 'Minimal 10 karakter. Sesi di perangkat lain akan berakhir.'),
    h('button', { class: 'btn primary', type: 'button', onclick: guard(async () => { await api('/me/password', 'POST', { current: f.cur.value, next: f.next.value }); f.cur.value = f.next.value = ''; toast('Kata sandi diganti.') }) }, 'Simpan'))]
}

const VIEWS = { dashboard: viewDashboard, updates: viewUpdates, team: viewTeam, clients: viewClients, contact: viewContact, media: viewMedia, users: viewUsers, activity: viewActivity, account: viewAccount }
boot()
