// Site-level views: dashboard, menu, site & footer, theme, history, media, users, activity, account.
import { h, st, api, guard, toast, modal, confirmBox, field, top, fmtDT, kb, clone, upload, pickImage, pubBar, showChanges, COL_NAMES, colRoute, colApi } from './lib.js'

const route = () => st.route()

/* ---------- dashboard ---------- */
export async function viewDashboard() {
  const s = await api('/summary'), u = s.updates
  const stat = (n, l, href) => h('a', { class: 'card stat', href, style: 'text-decoration:none;color:inherit' }, h('b', {}, n), h('span', {}, l))
  const pending = s.pending || []
  return [top('Dashboard', `Halo, ${st.user.name || st.user.username}.`),
    h('div', { class: 'grid g4', style: 'margin-bottom:16px' }, stat(u.published, 'Update tayang', '#updates'), stat(u.drafts, 'Draf update', '#updates'), stat(s.projects, 'Karya portofolio', '#portfolio'), stat(s.team.count, 'Anggota tim', '#team')),
    pending.length ? h('div', { class: 'card', style: 'margin-bottom:16px;border-color:var(--warn)' }, h('h3', { style: 'margin-bottom:10px' }, `${pending.length} perubahan belum diterbitkan`),
      h('div', { class: 'row' }, pending.map((k) => h('a', { class: 'badge warn', href: '#' + colRoute(k) }, COL_NAMES[k] || k))),
      h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn primary', type: 'button', onclick: guard(async () => {
        if (!(await confirmBox('Terbitkan semua draf?', pending.map((k) => COL_NAMES[k] || k).join(', '), 'Terbitkan semua'))) return
        for (const k of pending) await api(`/content/${colApi(k)}/publish`, 'POST', { note: 'Terbit massal' })
        toast('Semua draf diterbitkan.'); route() }) }, 'Terbitkan semua'))) : null,
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', {}, 'Instagram'), h('p', {}, `@${u.account || '—'} · sinkron terakhir: ${fmtDT(u.lastSync)}`),
        h('p', {}, h('span', { class: 'badge ' + (s.apify ? 'ok' : 'warn') }, s.apify ? 'APIFY_TOKEN terpasang' : 'APIFY_TOKEN belum diatur')),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#updates' }, 'Kelola update'))),
      h('div', { class: 'card' }, h('h3', {}, 'Situs'), h('p', { class: 'hint' }, 'Halaman publik dibuat statis dari konten yang sudah diterbitkan.'),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'Buka situs ↗'),
          st.user.role === 'admin' ? h('button', { class: 'btn', type: 'button', onclick: guard(async () => { const r = await api('/rebuild', 'POST', {}); toast(`Dibangun ulang: ${r.pages} halaman, ${r.published} update tayang.`) }) }, 'Bangun ulang halaman') : null)))]
}

/* ---------- small bilingual input ---------- */
const bi = (obj, k, label, touch, o = {}) => h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'bi' },
  ['en', 'id'].map((l) => h('div', {}, h('span', { class: 'lg' }, l.toUpperCase()), h('input', { type: 'text', maxlength: o.max || 200, value: obj[k]?.[l] ?? '', oninput: (e) => { (obj[k] ??= { en: '', id: '' })[l] = e.target.value; touch() } })))))
const txt = (obj, k, label, touch, o = {}) => field(label, h('input', { type: 'text', maxlength: o.max || 200, value: obj[k] ?? '', placeholder: o.ph || '', list: o.list, oninput: (e) => { obj[k] = e.target.value; touch() } }), o.hint)
const imgField = (obj, k, label, touch, hint) => {
  const im = h('img', { src: obj[k] || '/images/placeholder.svg', alt: '', class: 'pickimg' })
  return field(label, h('div', { class: 'row' }, im, h('button', { type: 'button', class: 'btn sm', onclick: async () => { const u = await pickImage(); if (u) { obj[k] = u; im.src = u; touch() } } }, 'Pilih / unggah'), obj[k] ? h('code', { class: 's' }, obj[k]) : null), hint)
}

/* ---------- menu ---------- */
export async function viewMenu() {
  const r = await api('/content/nav'), data = clone(r.draft), state = { local: false, server: r.dirty }
  const list = h('div'), bar = pubBar({ key: 'nav', state, collect: () => data, reload: route, preview: 'home' }), touch = () => bar.touch()
  function draw() {
    list.replaceChildren()
    data.items.forEach((it, i) => list.append(h('div', { class: 'mrow' },
      h('div', { class: 'bi' }, ['en', 'id'].map((l) => h('div', {}, h('span', { class: 'lg' }, l.toUpperCase()), h('input', { type: 'text', maxlength: 40, value: it.label[l] || '', oninput: (e) => { it.label[l] = e.target.value; touch() } })))),
      h('input', { type: 'text', list: 'hrefs', value: it.href, placeholder: '/halaman atau https://…', oninput: (e) => { it.href = e.target.value; touch() } }),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: it.visible !== false, onchange: (e) => { it.visible = e.target.checked; touch() } }), ' tampil'),
      h('div', { class: 'acts' }, h('button', { class: 'btn sm', disabled: i === 0, onclick: () => { [data.items[i - 1], data.items[i]] = [data.items[i], data.items[i - 1]]; touch(); draw() } }, '↑'),
        h('button', { class: 'btn sm', disabled: i === data.items.length - 1, onclick: () => { [data.items[i + 1], data.items[i]] = [data.items[i], data.items[i + 1]]; touch(); draw() } }, '↓'),
        h('button', { class: 'btn sm danger', onclick: () => { data.items.splice(i, 1); touch(); draw() } }, 'Hapus')))))
    list.append(h('button', { class: 'btn sm', disabled: data.items.length >= 12, onclick: () => { data.items.push({ id: 'n' + Math.random().toString(36).slice(2, 6), label: { en: 'Menu baru', id: 'Menu baru' }, href: '/', visible: true }); touch(); draw() } }, '+ Tambah menu'))
  }
  if (!document.getElementById('hrefs')) document.body.append(h('datalist', { id: 'hrefs' }, ['/', '/services', '/portfolio', '/update', '/about', 'mailto:{email}', 'https://'].map((x) => h('option', { value: x }))))
  draw()
  return [top('Menu', 'Menu di header dan footer. Tautan internal (diawali /) otomatis diberi /id di versi Indonesia.'), bar, h('div', { class: 'card' }, list)]
}

/* ---------- site & footer ---------- */
export async function viewSite() {
  const r = await api('/content/site'), d = clone(r.draft), state = { local: false, server: r.dirty }
  const bar = pubBar({ key: 'site', state, collect: () => d, reload: route, preview: 'home' }), touch = () => bar.touch()
  d.cta ??= { label: { en: '', id: '' }, href: '' }
  return [top('Situs & footer', 'Identitas, logo, tombol header, dan footer.'), bar,
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:14px' }, 'Identitas'), txt(d, 'name', 'Nama situs / perusahaan', touch, { max: 80 }), txt(d, 'copyrightName', 'Nama di hak cipta footer', touch, { max: 80 }),
        txt(d, 'siteUrl', 'Alamat situs (opsional)', touch, { ph: 'https://spero.id', hint: 'Dipakai untuk canonical dan Open Graph. Kosongkan bila belum ada domain.' }), imgField(d, 'ogImage', 'Gambar berbagi (Open Graph)', touch, 'Muncul saat tautan dibagikan.')),
      h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:14px' }, 'Logo & ikon'), imgField(d, 'logoLight', 'Logo (mode terang)', touch, 'PNG transparan, rasio lebar. Tampil ±128 px.'), imgField(d, 'logoDark', 'Logo (mode gelap)', touch), imgField(d, 'favicon', 'Favicon (PNG)', touch), imgField(d, 'faviconIco', 'Favicon (ICO, opsional)', touch))),
    h('div', { class: 'grid g2', style: 'margin-top:16px' },
      h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:14px' }, 'Tombol header'), bi(d.cta, 'label', 'Teks', touch, { max: 40 }), txt(d.cta, 'href', 'Tautan', touch, { list: 'hrefs', ph: 'mailto:{email}', hint: '{email} diganti otomatis dari menu Kontak.' })),
      h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:14px' }, 'Footer'), bi(d, 'tagline', 'Tagline di bawah logo', touch), bi(d, 'footerRight', 'Teks kanan bawah', touch)))]
}

/* ---------- theme ---------- */
const LABELS = { electric: 'Warna utama (tombol, blok biru)', accent: 'Aksen (tautan, angka)', midnight: 'Biru tua (hover tombol)', blue: 'Biru sedang', sky: 'Biru muda', background: 'Latar halaman', foreground: 'Teks utama', muted: 'Teks redup', line: 'Garis pemisah', surface: 'Latar kartu' }
export async function viewTheme() {
  const r = await api('/content/theme'); let d = clone(r.draft); const state = { local: false, server: r.dirty }
  const bar = pubBar({ key: 'theme', state, collect: () => d, reload: route, preview: 'home' }), touch = () => { d.preset = 'custom'; bar.touch(); drawPreview() }
  const presetWrap = h('div', { class: 'presets' }), grid = h('div', { class: 'colors' }), prev = h('div', { class: 'tprev' })
  const sw = (t) => h('span', { class: 'sw', style: `background:${t.light.electric}` })
  function drawPresets() {
    presetWrap.replaceChildren(...Object.entries(st.schema.presets).map(([k, p]) => h('button', { type: 'button', class: 'preset' + (d.preset === k ? ' on' : ''), onclick: () => { const mode = d.mode, radius = d.radius; d = clone(p.theme); d.mode = mode; d.radius = radius; d.preset = k; bar.touch(); drawPresets(); drawColors(); drawPreview() } }, sw(p.theme), p.label)))
  }
  const colorRow = (obj, k, label) => {
    const txtIn = h('input', { type: 'text', value: obj[k], maxlength: 7, class: 'hex' }), col = h('input', { type: 'color', value: obj[k] })
    col.addEventListener('input', () => { obj[k] = col.value; txtIn.value = col.value; touch(); drawPresets() })
    txtIn.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(txtIn.value)) { obj[k] = txtIn.value.toLowerCase(); col.value = obj[k]; touch(); drawPresets() } })
    return h('div', { class: 'crow' }, col, h('div', {}, h('b', {}, label), h('div', { class: 's' }, k)), txtIn)
  }
  function drawColors() {
    grid.replaceChildren(h('div', {}, h('h3', {}, 'Mode terang'), st.schema.lightKeys.map((k) => colorRow(d.light, k, LABELS[k] || k))), h('div', {}, h('h3', {}, 'Mode gelap'), st.schema.darkKeys.map((k) => colorRow(d.dark, k, LABELS[k] || k))))
  }
  function drawPrev() {
    const mk = (c, title) => h('div', { class: 'tp', style: `--bg:${c.background};--fg:${c.foreground};--mu:${c.muted};--ln:${c.line};--sf:${c.surface};--ac:${c.accent};--pr:${c.electric || d.light.electric};--rb:${d.radius.button}px;--rc:${d.radius.card}px` },
      h('b', {}, title), h('div', { class: 'tc' }, h('b', {}, 'Judul kartu'), h('p', {}, 'Teks redup contoh isi kartu portofolio.'), h('span', { class: 'ta' }, 'Aksen / tautan')), h('span', { class: 'tb' }, 'Tombol utama'))
    prev.replaceChildren(mk(d.light, 'Terang'), mk({ ...d.dark, electric: d.light.electric }, 'Gelap'))
  }
  const drawPreview = drawPrev
  const radius = (k, label) => { const n = h('b', {}, d.radius[k] + ' px'); return field(label, h('div', { class: 'row' }, h('input', { type: 'range', min: 0, max: 32, value: d.radius[k], style: 'width:220px', oninput: (e) => { d.radius[k] = +e.target.value; n.textContent = d.radius[k] + ' px'; touch(); drawPrev() } }), n)) }
  const mode = h('select', { style: 'width:auto', onchange: (e) => { d.mode = e.target.value; bar.touch() } }, [['light', 'Terang'], ['dark', 'Gelap'], ['system', 'Ikuti perangkat pengunjung']].map(([v, l]) => h('option', { value: v, selected: d.mode === v }, l)))
  drawPresets(); drawColors(); drawPrev()
  return [top('Tema', 'Warna dan sudut. Perubahan baru tampil di situs setelah diterbitkan.'), bar, h('div', { class: 'card', style: 'margin-bottom:16px' }, h('h3', { style: 'margin-bottom:12px' }, 'Preset'), presetWrap),
    h('div', { class: 'card', style: 'margin-bottom:16px' }, h('h3', { style: 'margin-bottom:12px' }, 'Pratinjau cepat'), prev),
    h('div', { class: 'card', style: 'margin-bottom:16px' }, h('div', { class: 'grid g2' }, radius('button', 'Sudut tombol'), radius('card', 'Sudut kartu')), field('Mode awal untuk pengunjung baru', mode, 'Pengunjung tetap bisa memilih sendiri lewat tombol tema di header.')),
    h('div', { class: 'card' }, h('h3', { style: 'margin-bottom:12px' }, 'Warna (lanjutan)'), grid)]
}

/* ---------- history ---------- */
export async function viewHistory(sub) {
  const keys = st.schema.collections, cur = keys.includes(sub?.replace('.', ':')) ? sub.replace('.', ':') : 'page:home'
  const sel = h('select', { style: 'width:auto;min-width:260px', onchange: (e) => { location.hash = 'history/' + colApi(e.target.value) } }, keys.map((k) => h('option', { value: k, selected: k === cur }, COL_NAMES[k] || k)))
  const { items } = await api('/versions/' + colApi(cur)), c = await api('/content/' + colApi(cur))
  const rows = items.map((v, i) => h('tr', {}, h('td', {}, fmtDT(v.ts), i === 0 ? h('span', { class: 'badge ok', style: 'margin-left:8px' }, 'terbaru') : null), h('td', {}, v.user), h('td', { class: 's' }, v.note || '—'),
    h('td', {}, h('div', { class: 'acts' }, h('button', { class: 'btn sm', onclick: guard(async () => { const d = await api(`/versions/${colApi(cur)}/${v.id}`); showChanges('Beda dengan versi yang tayang sekarang', d.changes) }) }, 'Lihat perbedaan'),
      h('button', { class: 'btn sm primary', onclick: guard(async () => {
        if (!(await confirmBox('Pulihkan versi ini?', `Isi versi ${fmtDT(v.ts)} dimuat ke DRAF “${COL_NAMES[cur]}”. Situs belum berubah sampai Anda menerbitkannya.`, 'Pulihkan sebagai draf'))) return
        await api(`/versions/${colApi(cur)}/${v.id}/restore`, 'POST', {}); toast('Dimuat sebagai draf. Tinjau lalu terbitkan.'); location.hash = colRoute(cur) }) }, 'Pulihkan sebagai draf')))))
  return [top('Riwayat versi', 'Setiap kali sebuah bagian diterbitkan, versinya disimpan (40 terakhir). Pulihkan kapan saja sebagai draf.', sel),
    c.dirty ? h('div', { class: 'card', style: 'margin-bottom:16px;border-color:var(--warn)' }, 'Ada draf yang belum diterbitkan di bagian ini. ', h('a', { href: '#' + colRoute(cur) }, 'Buka editor')) : null,
    items.length ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Waktu', 'Oleh', 'Catatan', 'Aksi'].map((x) => h('th', {}, x)))), h('tbody', {}, rows)) : h('div', { class: 'empty' }, 'Belum ada versi.')]
}

/* ---------- media ---------- */
export async function viewMedia() {
  const { items } = await api('/media'), input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true })
  input.addEventListener('change', guard(async () => { for (const f of input.files) await upload(f); toast('Diunggah.'); route() }))
  return [top('Media', 'Gambar unggahan (tim, logo, update manual, portofolio). JPG, PNG, WebP · maks. 5 MB.', h('button', { class: 'btn primary', type: 'button', onclick: () => input.click() }, 'Unggah gambar'), input),
    items.length ? h('div', { class: 'mgrid' }, items.map((m) => h('div', { class: 'tile' }, h('img', { src: m.url, alt: '' }), h('div', { class: 'm' }, m.name, h('br'), kb(m.size)),
      h('div', { class: 'acts', style: 'padding:0 10px 10px' }, h('button', { class: 'btn sm danger', onclick: guard(async () => { if (await confirmBox('Hapus gambar?', m.name, 'Hapus')) { await api('/media/' + m.name, 'DELETE'); toast('Dihapus.'); route() } }) }, 'Hapus'))))) : h('div', { class: 'empty' }, 'Belum ada unggahan.')]
}

/* ---------- users (admin) ---------- */
export async function viewUsers() {
  const { users } = await api('/users')
  const rows = users.map((u) => h('tr', {}, h('td', {}, h('b', {}, u.username), h('div', { class: 's' }, u.name)), h('td', {}, h('select', { style: 'width:auto', onchange: guard(async (e) => { await api('/users/' + u.id, 'PATCH', { role: e.target.value }); toast('Peran diubah.'); route() }) }, ['admin', 'editor'].map((r) => h('option', { value: r, selected: u.role === r }, r)))),
    h('td', {}, h('span', { class: 'badge ' + (u.disabled ? 'warn' : 'ok') }, u.disabled ? 'Nonaktif' : 'Aktif')), h('td', {}, fmtDT(u.lastLoginAt)),
    h('td', {}, h('div', { class: 'acts' }, h('button', { class: 'btn sm', onclick: guard(async () => { await api('/users/' + u.id, 'PATCH', { disabled: !u.disabled }); toast('Diperbarui.'); route() }) }, u.disabled ? 'Aktifkan' : 'Nonaktifkan'),
      h('button', { class: 'btn sm', onclick: () => { const p = h('input', { type: 'password', autocomplete: 'new-password' }); modal('Reset kata sandi: ' + u.username, field('Kata sandi baru', p, 'Minimal 10 karakter. Semua sesi pengguna ini dicabut.'), [{ label: 'Batal' }, { label: 'Simpan', cls: 'primary', run: async () => { await api('/users/' + u.id, 'PATCH', { password: p.value }); toast('Kata sandi diganti.') } }]) } }, 'Reset sandi'),
      h('button', { class: 'btn sm danger', onclick: guard(async () => { if (await confirmBox('Hapus pengguna?', u.username, 'Hapus')) { await api('/users/' + u.id, 'DELETE'); toast('Dihapus.'); route() } }) }, 'Hapus')))))
  const add = () => {
    const f = { username: h('input', { type: 'text', autocomplete: 'off' }), name: h('input', { type: 'text' }), role: h('select', {}, ['editor', 'admin'].map((r) => h('option', { value: r }, r))), password: h('input', { type: 'password', autocomplete: 'new-password' }) }
    modal('Tambah pengguna', h('div', {}, field('Username', f.username, 'Huruf kecil, angka, titik, strip, garis bawah.'), field('Nama', f.name), field('Peran', f.role, 'admin: semua akses · editor: konten saja'), field('Kata sandi', f.password, 'Minimal 10 karakter.')),
      [{ label: 'Batal' }, { label: 'Buat', cls: 'primary', run: async () => { await api('/users', 'POST', { username: f.username.value.trim(), name: f.name.value, role: f.role.value, password: f.password.value }); toast('Pengguna dibuat.'); route() } }])
  }
  return [top('Pengguna', 'Akun yang boleh masuk ke admin.', h('button', { class: 'btn primary', type: 'button', onclick: add }, '+ Tambah pengguna')),
    h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Pengguna', 'Peran', 'Status', 'Masuk terakhir', 'Aksi'].map((x) => h('th', {}, x)))), h('tbody', {}, rows))]
}
export async function viewActivity() {
  const { items } = await api('/activity')
  return [top('Aktivitas', '200 kejadian terakhir.'), items.length ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Waktu', 'Pengguna', 'Aksi', 'Target', 'Detail'].map((x) => h('th', {}, x)))),
    h('tbody', {}, items.map((a) => h('tr', {}, h('td', {}, fmtDT(a.ts)), h('td', {}, a.user), h('td', {}, h('span', { class: 'badge' }, a.action)), h('td', {}, a.target), h('td', { class: 's' }, a.detail))))) : h('div', { class: 'empty' }, 'Belum ada aktivitas.')]
}
export async function viewAccount() {
  const f = { cur: h('input', { type: 'password', autocomplete: 'current-password' }), next: h('input', { type: 'password', autocomplete: 'new-password' }) }
  return [top('Akun saya', `${st.user.username} · ${st.user.role}`), h('div', { class: 'card', style: 'max-width:460px' }, h('h3', { style: 'margin-bottom:16px' }, 'Ganti kata sandi'),
    field('Kata sandi saat ini', f.cur), field('Kata sandi baru', f.next, 'Minimal 10 karakter. Sesi di perangkat lain akan berakhir.'),
    h('button', { class: 'btn primary', type: 'button', onclick: guard(async () => { await api('/me/password', 'POST', { current: f.cur.value, next: f.next.value }); f.cur.value = f.next.value = ''; toast('Kata sandi diganti.') }) }, 'Simpan'))]
}
void upload; void clone
