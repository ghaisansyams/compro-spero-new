// Content views: pages (section builder), portfolio, updates, team, clients, contact.
import { h, st, api, guard, toast, modal, confirmBox, field, top, fmtD, fmtDT, clone, pickImage, pubBar, pickImage as pick } from './lib.js'
import { renderFields, blank } from './forms.js'

const route = () => st.route()
const langSeg = (onChange) => h('div', { class: 'seg' }, [['en', 'EN'], ['id', 'ID']].map(([v, l]) => h('button', { type: 'button', class: st.lang === v ? 'on' : '', onclick: (e) => { st.lang = v; localStorage.setItem('adminLang', v); e.target.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.target)); onChange() } }, l)))

/* ---------- pages (section builder) ---------- */
export async function viewPages(sub) {
  const keys = Object.keys(st.schema.pages), key = keys.includes(sub) ? sub : 'home'
  const r = await api('/content/page.' + key), data = clone(r.draft), state = { local: false, server: r.dirty }
  const open = new Set(), list = h('div', { class: 'secs' })
  const bar = pubBar({ key: 'page:' + key, state, collect: () => data, reload: route, preview: key })
  const touch = () => bar.touch()
  const S = st.schema.sections
  const summary = (sec) => { for (const f of S[sec.type].fields) { const v = sec[f.k]; const t = typeof v === 'string' ? v : v?.[st.lang] || v?.en; if (typeof t === 'string' && t.trim() && (f.t === 'i' || f.t === 'it')) return t.slice(0, 70); if (Array.isArray(t) && t.length) return t[0].slice(0, 70) } return '' }
  function draw() {
    list.replaceChildren()
    data.sections.forEach((sec, i) => {
      const def = S[sec.type]
      const det = h('details', { class: 'sec' + (sec.visible === false ? ' off' : ''), open: open.has(sec.id) || null, ontoggle: (e) => { e.target.open ? open.add(sec.id) : open.delete(sec.id) } },
        h('summary', {}, h('span', { class: 'ty' }, def.label), h('span', { class: 't' }, summary(sec)),
          h('span', { class: 'acts' }, h('label', { class: 'chk', title: 'Tampilkan di situs', onclick: (e) => e.stopPropagation() }, h('input', { type: 'checkbox', checked: sec.visible !== false, onchange: (e) => { sec.visible = e.target.checked; touch(); draw() } }), ' tampil'),
            h('button', { type: 'button', class: 'btn sm', disabled: i === 0, title: 'Naik', onclick: (e) => { e.preventDefault(); [data.sections[i - 1], data.sections[i]] = [data.sections[i], data.sections[i - 1]]; touch(); draw() } }, '↑'),
            h('button', { type: 'button', class: 'btn sm', disabled: i === data.sections.length - 1, title: 'Turun', onclick: (e) => { e.preventDefault(); [data.sections[i + 1], data.sections[i]] = [data.sections[i], data.sections[i + 1]]; touch(); draw() } }, '↓'),
            h('button', { type: 'button', class: 'btn sm danger', onclick: guard(async (e) => { e.preventDefault(); if (await confirmBox('Hapus section?', def.label, 'Hapus')) { data.sections.splice(i, 1); touch(); draw() } }) }, 'Hapus'))),
        h('div', { class: 'sbody' }, def.generated ? h('p', { class: 'hint note' }, 'ℹ ' + def.generated) : null, renderFields(def.fields, sec, touch)))
      list.append(det)
    })
    if (!data.sections.length) list.append(h('div', { class: 'empty' }, 'Halaman kosong. Tambahkan section di bawah.'))
  }
  const types = Object.entries(S).filter(([k, d]) => !d.unique || true), sel = h('select', { style: 'width:auto;min-width:260px' }, types.map(([k, d]) => h('option', { value: k }, d.label + (d.unique ? ' (satu per halaman)' : ''))))
  const add = h('button', { class: 'btn', type: 'button', onclick: guard(async () => {
    const t = sel.value
    if (S[t].unique && data.sections.some((s) => s.type === t)) return toast(`“${S[t].label}” hanya boleh satu per halaman.`, true)
    const { section } = await api('/schema/new-section', 'POST', { type: t }); data.sections.push(section); open.add(section.id); touch(); draw()
  }) }, '+ Tambah section')
  const meta = h('div', { class: 'card', style: 'margin-bottom:16px' }, h('h3', { style: 'margin-bottom:12px' }, 'Judul tab & SEO'), h('div', { class: 'metaform' }))
  const drawMeta = () => meta.querySelector('.metaform').replaceChildren(renderFields([{ k: 'title', t: 'i', label: 'Judul tab / hasil pencarian', max: 120 }, { k: 'description', t: 'it', label: 'Deskripsi pencarian (SEO)', max: 300 }], data.meta, touch))
  const tabs = h('div', { class: 'tabs' }, keys.map((k) => h('a', { class: k === key ? 'on' : '', href: '#pages/' + k }, st.schema.pages[k])))
  drawMeta(); draw()
  return [top('Halaman', 'Susun teks dan section tiap halaman. Edit satu bahasa dalam satu waktu.', langSeg(() => { drawMeta(); draw() })), tabs, bar, meta, list, h('div', { class: 'row', style: 'margin-top:16px' }, sel, add)]
}

/* ---------- portfolio (projects) ---------- */
const blankProject = (kind) => ({ id: '', kind, name: '', subtitle: '', year: String(new Date().getFullYear()), role: '', color: '#006ce5', live: '', github: '', private: false, desc: '', tech: [], stats: [], images: [], cat: kind === 'flagship' ? 'products' : '3d' })
export async function viewPortfolio() {
  const r = await api('/content/portfolio'); let items = clone(r.draft); const state = { local: false, server: r.dirty }
  const list = h('div'), bar = pubBar({ key: 'portfolio', state, collect: () => items, reload: route, preview: 'portfolio' })
  const kindLabel = (p) => p.kind === 'flagship' ? 'Produk unggulan' : p.cat === 'games' ? 'Game' : '3D & Kreatif'
  function draw() {
    list.replaceChildren()
    const groups = [['flagship', 'Produk (rail “Products”)'], ['more', '3D & Games (rail kedua)']]
    for (const [kind, title] of groups) {
      const idx = items.map((p, i) => [p, i]).filter(([p]) => (kind === 'flagship') === (p.kind === 'flagship'))
      list.append(h('h3', { style: 'margin:22px 0 10px' }, `${title} · ${idx.length}`))
      if (!idx.length) list.append(h('div', { class: 'empty' }, 'Belum ada karya.'))
      for (const [p, i] of idx) {
        const prev = idx.findIndex(([, j]) => j === i)
        list.append(h('div', { class: 'prow' }, h('img', { src: p.images[0]?.src || '/images/placeholder.svg', alt: '' }),
          h('div', { class: 'pm' }, h('b', {}, p.name || '(tanpa nama)'), h('div', { class: 's' }, kindLabel(p) + (p.live ? ' · demo' : '') + ` · ${p.images.length} gambar`)),
          h('div', { class: 'acts' },
            h('button', { class: 'btn sm', disabled: prev === 0, onclick: () => { const j = idx[prev - 1][1];[items[i], items[j]] = [items[j], items[i]]; bar.touch(); draw() } }, '↑'),
            h('button', { class: 'btn sm', disabled: prev === idx.length - 1, onclick: () => { const j = idx[prev + 1][1];[items[i], items[j]] = [items[j], items[i]]; bar.touch(); draw() } }, '↓'),
            h('button', { class: 'btn sm', onclick: () => editProject(p, false) }, 'Edit'),
            h('button', { class: 'btn sm danger', onclick: guard(async () => { if (await confirmBox('Hapus karya?', p.name, 'Hapus')) { items.splice(i, 1); bar.touch(); draw() } }) }, 'Hapus'))))
      }
    }
  }
  function editProject(src, isNew) {
    const p = clone(src), f = {}
    const inp = (k, o = {}) => (f[k] = h('input', { type: 'text', value: p[k] ?? '', oninput: (e) => { p[k] = e.target.value }, ...o }))
    const techIn = h('input', { type: 'text', value: (p.tech || []).join(', '), placeholder: 'Next.js, React, PostgreSQL' })
    const stats = h('div'), imgs = h('div', { class: 'imgs' })
    const drawStats = () => { stats.replaceChildren(); p.stats.forEach((s, i) => stats.append(h('div', { class: 'lrow' }, h('input', { type: 'text', placeholder: 'Label (mis. Tests)', value: s.label, maxlength: 24, oninput: (e) => { s.label = e.target.value } }), h('input', { type: 'text', placeholder: 'Nilai (mis. 148)', value: s.value, maxlength: 12, oninput: (e) => { s.value = e.target.value } }), h('button', { type: 'button', class: 'btn sm danger', onclick: () => { p.stats.splice(i, 1); drawStats() } }, '×')))); stats.append(h('button', { type: 'button', class: 'btn sm', disabled: p.stats.length >= 4, onclick: () => { p.stats.push({ label: '', value: '' }); drawStats() } }, '+ Metrik')) }
    const drawImgs = () => {
      imgs.replaceChildren(); p.images.forEach((im, i) => imgs.append(h('div', { class: 'irow' }, h('img', { src: im.src, alt: '' }), h('input', { type: 'text', value: im.label, maxlength: 60, placeholder: 'Keterangan', oninput: (e) => { im.label = e.target.value } }),
        h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn sm', disabled: i === 0, onclick: () => { [p.images[i - 1], p.images[i]] = [p.images[i], p.images[i - 1]]; drawImgs() } }, '↑'), h('button', { type: 'button', class: 'btn sm', disabled: i === p.images.length - 1, onclick: () => { [p.images[i + 1], p.images[i]] = [p.images[i], p.images[i + 1]]; drawImgs() } }, '↓'), h('button', { type: 'button', class: 'btn sm danger', onclick: () => { p.images.splice(i, 1); drawImgs() } }, '×')))))
      imgs.append(h('button', { type: 'button', class: 'btn sm', disabled: p.images.length >= 12, onclick: async () => { const u = await pick(); if (u) { p.images.push({ src: u, label: p.name || 'Layar' }); drawImgs() } } }, '+ Tambah gambar'))
    }
    const kind = h('select', { onchange: (e) => { p.kind = e.target.value; p.cat = p.kind === 'flagship' ? 'products' : (p.cat === 'products' ? '3d' : p.cat); catSel.disabled = p.kind === 'flagship' } }, [['flagship', 'Produk (rail “Products”)'], ['more', '3D & Games']].map(([v, l]) => h('option', { value: v, selected: p.kind === v }, l)))
    const catSel = h('select', { disabled: p.kind === 'flagship', onchange: (e) => { p.cat = e.target.value } }, [['3d', '3D & Kreatif'], ['games', 'Game']].map(([v, l]) => h('option', { value: v, selected: p.cat === v }, l)))
    const desc = h('textarea', { rows: 6, maxlength: 2500, oninput: (e) => { p.desc = e.target.value } }); desc.value = p.desc
    const color = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#006ce5', oninput: (e) => { p.color = e.target.value }, style: 'width:64px;height:40px;padding:2px' })
    drawStats(); drawImgs()
    modal(isNew ? 'Karya baru' : 'Edit karya', h('div', {}, h('div', { class: 'grid g2' }, field('Nama', inp('name', { maxlength: 80, oninput: (e) => { p.name = e.target.value; if (isNew && !p._idTouched) { p.id = e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50); f.id.value = p.id } } })),
      field('ID (untuk tautan internal)', inp('id', { maxlength: 50, oninput: (e) => { p.id = e.target.value; p._idTouched = true } }), 'Huruf kecil, angka, strip.')),
    h('div', { class: 'grid g2' }, field('Jenis', kind), field('Kategori (3D & Games)', catSel)),
    field('Subjudul', inp('subtitle', { maxlength: 120 })), h('div', { class: 'grid g2' }, field('Tahun', inp('year', { maxlength: 10 })), field('Peran', inp('role', { maxlength: 60 }))),
    field('Deskripsi', desc, 'Dipotong 4 baris di kartu; pengunjung bisa membuka penuh lewat “Show all”.'),
    field('Teknologi (pisahkan dengan koma)', techIn), field('Metrik (maks. 4, hanya tampil di Produk)', stats),
    h('div', { class: 'grid g2' }, field('Link demo (opsional, hanya di 3D & Games)', inp('live', { placeholder: 'https://…' })), field('Link GitHub (opsional, disimpan)', inp('github', { placeholder: 'https://…' }))),
    field('Warna aksen', color), field('Gambar (gambar pertama = sampul; klik gambar di situs untuk melihat semua)', imgs)),
    [{ label: 'Batal' }, { label: 'Simpan', cls: 'primary', run: () => {
      p.tech = techIn.value.split(',').map((x) => x.trim()).filter(Boolean); delete p._idTouched
      if (!p.name.trim()) return toast('Nama wajib diisi.', true) || false
      if (!p.images.length) return toast('Tambahkan minimal satu gambar.', true) || false
      if (isNew) items.push(p); else items[items.findIndex((x) => x.id === src.id)] = p
      bar.touch(); draw()
    } }], true)
  }
  draw()
  return [top('Portofolio', 'Karya yang tampil di rail beranda, halaman Portofolio, dan grid “Show all”. Gambar diunggah lewat tombol “+ Tambah gambar”.',
    h('button', { class: 'btn', type: 'button', onclick: () => editProject(blankProject('flagship'), true) }, '+ Produk'), h('button', { class: 'btn', type: 'button', onclick: () => editProject(blankProject('more'), true) }, '+ 3D / Game')), bar, list]
}

/* ---------- updates ---------- */
export async function viewUpdates() {
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
      tbody.append(h('tr', {}, h('td', {}, h('img', { src: i.imageUrl, alt: '' })),
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
  return [top('Update', `Postingan Instagram @${data.account} dan update manual. Sinkron terakhir: ${fmtDT(data.updatedAt)}.`, sync, h('button', { class: 'btn', type: 'button', onclick: () => editUpdate(null, data.categories) }, '+ Update manual')), h('div', { class: 'row', style: 'margin-bottom:14px' }, sel, search), table]
}
function editUpdate(item, categories) {
  const f = {
    title: h('input', { type: 'text', value: item?.title || '', maxlength: 120 }), category: h('select', {}, categories.map((c) => h('option', { value: c, selected: item?.category === c }, c))),
    date: h('input', { type: 'date', value: item?.publishedAt || new Date().toISOString().slice(0, 10) }), excerpt: h('input', { type: 'text', value: item?.excerpt || '', maxlength: 240 }),
    caption: h('textarea', { style: 'min-height:160px' }), postUrl: h('input', { type: 'text', value: item?.postUrl || '', placeholder: 'https://www.instagram.com/p/…' }),
  }
  f.caption.value = item?.caption || ''
  let image = item?.imageUrl || ''; const manual = !item || item.source === 'manual'
  const prev = h('img', { src: image || '/images/placeholder.svg', alt: '', style: 'width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--line)' })
  const choose = h('button', { class: 'btn', type: 'button', onclick: async () => { const u = await pickImage(); if (u) { image = u; prev.src = u } } }, 'Ganti gambar')
  modal(item ? 'Edit update' : 'Update manual', h('div', {}, field('Judul', f.title), h('div', { class: 'grid g2' }, field('Kategori', f.category), field('Tanggal', f.date)),
    field('Ringkasan', f.excerpt, 'Tampil di kartu daftar. Kosongkan untuk dibuat otomatis dari isi (update baru).'), field('Isi / caption', f.caption),
    field('Gambar', h('div', { class: 'row' }, prev, choose)), item && !manual ? field('Link postingan Instagram', f.postUrl) : null,
    item && !manual ? h('p', { class: 'hint' }, 'Setelah diedit, isi tidak akan ditimpa oleh sinkron berikutnya.') : null),
  [{ label: 'Batal' }, { label: 'Simpan', cls: 'primary', run: async () => {
    const body = { title: f.title.value, category: f.category.value, publishedAt: f.date.value, excerpt: f.excerpt.value, caption: f.caption.value, imageUrl: image }
    if (item && !manual) body.postUrl = f.postUrl.value
    if (!item && !body.excerpt.trim()) delete body.excerpt
    if (item && !body.excerpt.trim()) return toast('Ringkasan wajib diisi.', true) || false
    await api(item ? '/updates/' + item.key : '/updates', item ? 'PATCH' : 'POST', body); toast('Tersimpan.'); route()
  } }])
}

/* ---------- team / clients / contact ---------- */
export async function viewTeam() {
  const r = await api('/content/team'); const items = clone(r.draft); const state = { local: false, server: r.dirty }
  const list = h('div'), bar = pubBar({ key: 'team', state, collect: () => items, reload: route, preview: 'about' })
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
  return [top('Tim', 'Tampil di halaman Tentang. Urutan di sini = urutan di situs.', h('button', { class: 'btn', type: 'button', onclick: async () => { const u = await pickImage(); if (!u) return; items.push({ name: 'Nama baru', role: 'Jabatan', photo: u }); bar.touch(); draw() } }, '+ Tambah anggota')), bar, list]
}
export async function viewClients() {
  const r = await api('/content/clients'); const state = { local: false, server: r.dirty }
  const parse = () => ta.value.split('\n').map((s) => s.trim()).filter(Boolean)
  const count = h('span', { class: 'badge' }), ta = h('textarea', { style: 'min-height:420px', oninput: () => { count.textContent = parse().length + ' klien'; bar.touch() } }); ta.value = r.draft.join('\n'); count.textContent = parse().length + ' klien'
  const bar = pubBar({ key: 'clients', state, collect: parse, reload: route, preview: 'home' })
  return [top('Klien', 'Satu nama per baris. Tampil sebagai marquee “Our Clients” di beranda dan Portofolio.', count), bar, h('div', { class: 'card' }, ta)]
}
export async function viewContact() {
  const r = await api('/content/contact'), d = r.draft, state = { local: false, server: r.dirty }
  const ins = { email: h('input', { type: 'email', value: d.email || '' }), phones: h('textarea', { style: 'min-height:80px' }), address: h('textarea', { style: 'min-height:100px' }), instagram: h('input', { type: 'text', value: d.instagram || '' }) }
  ins.phones.value = (d.phones || []).join('\n'); ins.address.value = d.address || ''
  const bar = pubBar({ key: 'contact', state, reload: route, preview: 'about', collect: () => ({ email: ins.email.value, phones: ins.phones.value.split('\n').map((s) => s.trim()).filter(Boolean), address: ins.address.value, instagram: ins.instagram.value }) })
  Object.values(ins).forEach((el) => el.addEventListener('input', () => bar.touch()))
  return [top('Kontak', 'Dipakai di halaman Tentang, semua tombol email, dan sebagai akun sumber Update.'), bar,
    h('div', { class: 'card', style: 'max-width:620px' }, field('Email', ins.email, 'Mengganti semua link mailto: di situs.'), field('Telepon', ins.phones, 'Satu nomor per baris (maks. 4).'), field('Alamat', ins.address, 'Maks. 6 baris.'), field('Username Instagram', ins.instagram, 'Tanpa @. Dipakai saat sinkron dan di halaman Update.'))]
}
void blank
