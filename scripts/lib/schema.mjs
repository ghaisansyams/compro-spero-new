// Section schemas for the page builder: drives (1) server-side sanitising, (2) the admin form (served at /api/admin/schema).
//
// Field types
//   i    text, per language {en,id}            it   long text, per language
//   il   list of lines, per language           ip   list of paragraphs, per language
//   p    plain text (same in both languages)   href link (/path, #anchor, https://, mailto:, tel:, or {email}/{instagram})
//   ill  illustration name                     sel  one of `options`          bool  checkbox
//   obj  nested object (`fields`)              list list of objects (`fields`), `max` items
export const ILLUSTRATIONS = ['software', 'interface', 'identity', 'connection', 'assembly', 'archive']
const MARQUEE_VARIANTS = ['cross', 'tilt', 'flat']
const CTA = (label) => ({ t: 'obj', label, fields: [{ k: 'label', t: 'i', label: 'Teks', max: 60 }, { k: 'href', t: 'href', label: 'Tautan' }] })

export const SECTIONS = {
  hero: { label: 'Hero beranda', unique: true, fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil di atas', max: 120 }, { k: 'note', t: 'i', label: 'Catatan di kanan atas', max: 120 },
    { k: 'lines', t: 'il', label: 'Judul besar (satu baris per baris; baris terakhir berwarna)', max: 60, maxItems: 5 },
    { k: 'lede', t: 'it', label: 'Paragraf pengantar', max: 400 }, { ...CTA('Tombol utama'), k: 'cta1' }, { ...CTA('Tautan kedua'), k: 'cta2' }] },
  focus: { label: 'Pernyataan fokus (blok biru)', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'lines', t: 'il', label: 'Pernyataan (satu per baris)', max: 120, maxItems: 6 }] },
  marquee: { label: 'Garis kata berjalan', fields: [
    { k: 'words', t: 'il', label: 'Kata-kata (satu per baris)', max: 40, maxItems: 12 },
    { k: 'variant', t: 'sel', label: 'Gaya', options: [['cross', 'Dua garis menyilang'], ['tilt', 'Satu garis miring'], ['flat', 'Satu garis lurus']] },
    { k: 'speed', t: 'sel', def: '1', label: 'Kecepatan', options: [['0.6', 'Lambat'], ['1', 'Normal'], ['1.25', 'Cepat'], ['1.6', 'Sangat cepat']] }] },
  'services-list': { label: 'Daftar layanan (beranda)', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'il', label: 'Judul (satu per baris)', max: 80, maxItems: 4 },
    { k: 'linkLabel', t: 'i', label: 'Teks tautan', max: 60 }, { k: 'linkHref', t: 'href', label: 'Tautan' },
    { k: 'rows', t: 'list', label: 'Layanan', max: 12, fields: [
      { k: 'number', t: 'p', label: 'Nomor', max: 4 }, { k: 'title', t: 'i', label: 'Judul', max: 80 }, { k: 'desc', t: 'it', label: 'Deskripsi', max: 200 },
      { k: 'href', t: 'href', label: 'Tautan' }, { k: 'illustration', t: 'ill', label: 'Ilustrasi' }] }] },
  studio: { label: 'Tentang studio (beranda)', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'il', label: 'Judul (satu per baris; baris terakhir berwarna)', max: 80, maxItems: 4 },
    { k: 'illustration', t: 'ill', label: 'Ilustrasi' }, { k: 'text', t: 'it', label: 'Paragraf utama', max: 500 }, { k: 'text2', t: 'it', label: 'Paragraf kedua', max: 400 },
    { k: 'linkLabel', t: 'i', label: 'Teks tautan', max: 60 }, { k: 'linkHref', t: 'href', label: 'Tautan' }] },
  'portfolio-teaser': { label: 'Portofolio (beranda: rail karya)', unique: true, generated: 'Rail karya diambil dari menu Portofolio.', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'i', label: 'Judul', max: 120 },
    { k: 'linkLabel', t: 'i', label: 'Teks tautan', max: 60 }, { k: 'linkHref', t: 'href', label: 'Tautan' }] },
  'updates-home': { label: 'Update terbaru (beranda)', unique: true, generated: 'Kotak postingan diambil dari menu Update.', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'title', t: 'i', label: 'Judul', max: 120 }, { k: 'desc', t: 'it', label: 'Deskripsi', max: 240 },
    { k: 'allLabel', t: 'i', label: 'Tombol “lihat semua”', max: 60 }, { k: 'viewLabel', t: 'i', label: 'Tautan Instagram', max: 60 }, { k: 'emptyText', t: 'i', label: 'Teks bila belum ada update', max: 160 }] },
  clients: { label: 'Klien (marquee)', unique: true, generated: 'Nama klien diatur di menu Klien.', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 60 }, { k: 'title', t: 'i', label: 'Judul', max: 100 }, { k: 'desc', t: 'it', label: 'Deskripsi', max: 240 }] },
  'contact-band': { label: 'Ajakan menghubungi (blok biru)', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'i', label: 'Judul', max: 120 }, { k: 'text', t: 'it', label: 'Teks', max: 240 },
    { k: 'buttonLabel', t: 'i', label: 'Teks tombol', max: 60 }, { k: 'buttonHref', t: 'href', label: 'Tautan tombol (mis. mailto:{email})' }] },
  intro: { label: 'Judul halaman', unique: true, fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 120 }, { k: 'title', t: 'i', label: 'Judul', max: 140 }, { k: 'lede', t: 'it', label: 'Paragraf pengantar', max: 400 },
    { k: 'highlight', t: 'bool', label: 'Teks menyala per kata saat di-scroll' }, { k: 'illustration', t: 'ill', label: 'Ilustrasi' },
    { ...CTA('Tombol (opsional)'), k: 'button' }] },
  'service-details': { label: 'Rincian layanan', fields: [
    { k: 'items', t: 'list', label: 'Layanan', max: 12, fields: [
      { k: 'id', t: 'p', label: 'ID anchor (tanpa spasi, untuk tautan #…)', max: 40 }, { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'title', t: 'i', label: 'Judul', max: 100 },
      { k: 'toolLine', t: 'i', label: 'Teknologi / alat', max: 160 }, { k: 'illustration', t: 'ill', label: 'Ilustrasi' }, { k: 'text', t: 'it', label: 'Deskripsi', max: 500 },
      { k: 'deliverables', t: 'il', label: 'Hasil kerja (satu per baris)', max: 120, maxItems: 10 }] }] },
  process: { label: 'Alur kerja', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'il', label: 'Judul (satu per baris)', max: 80, maxItems: 4 }, { k: 'illustration', t: 'ill', label: 'Ilustrasi' },
    { k: 'steps', t: 'list', label: 'Langkah', max: 10, fields: [{ k: 'title', t: 'i', label: 'Judul', max: 80 }, { k: 'text', t: 'it', label: 'Deskripsi', max: 240 }] }] },
  story: { label: 'Profil perusahaan', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'i', label: 'Judul besar', max: 80 }, { k: 'accent', t: 'bool', label: 'Judul berwarna aksen' },
    { k: 'paragraphs', t: 'ip', label: 'Paragraf', max: 700, maxItems: 8 }, { k: 'since', t: 'i', label: 'Catatan (mis. tahun berdiri)', max: 60 }, { k: 'illustration', t: 'ill', label: 'Ilustrasi' }] },
  principles: { label: 'Visi & misi / prinsip', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'i', label: 'Judul', max: 120 }, { k: 'illustration', t: 'ill', label: 'Ilustrasi' },
    { k: 'items', t: 'list', label: 'Butir', max: 8, fields: [{ k: 'title', t: 'i', label: 'Judul', max: 80 }, { k: 'text', t: 'it', label: 'Isi', max: 500 }] }] },
  team: { label: 'Tim', unique: true, generated: 'Anggota tim diatur di menu Tim.', fields: [{ k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 100 }, { k: 'title', t: 'i', label: 'Judul', max: 80 }] },
  contactinfo: { label: 'Info kontak', unique: true, generated: 'Isi kontak diatur di menu Kontak.', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 60 }, { k: 'heading', t: 'i', label: 'Judul', max: 100 },
    { k: 'phoneLabel', t: 'i', label: 'Label telepon', max: 30 }, { k: 'mailLabel', t: 'i', label: 'Label email', max: 30 }, { k: 'addrLabel', t: 'i', label: 'Label alamat', max: 30 }] },
  work: { label: 'Daftar karya (portofolio)', unique: true, generated: 'Karya diatur di menu Portofolio.', fields: [
    { k: 'productsTitle', t: 'i', label: 'Judul grup produk', max: 60 }, { k: 'productsDesc', t: 'i', label: 'Deskripsi grup produk', max: 160 },
    { k: 'moreTitle', t: 'i', label: 'Judul grup 3D & game', max: 60 }, { k: 'moreDesc', t: 'i', label: 'Deskripsi grup 3D & game', max: 160 }] },
  'updates-list': { label: 'Daftar update Instagram', unique: true, generated: 'Postingan diatur di menu Update.', fields: [] },
  textblock: { label: 'Blok teks bebas', fields: [
    { k: 'eyebrow', t: 'i', label: 'Teks kecil', max: 80 }, { k: 'heading', t: 'i', label: 'Judul', max: 140 }, { k: 'paragraphs', t: 'ip', label: 'Paragraf', max: 900, maxItems: 8 },
    { k: 'linkLabel', t: 'i', label: 'Teks tautan (opsional)', max: 60 }, { k: 'linkHref', t: 'href', label: 'Tautan' }] },
}
export const PAGES = { home: 'Beranda', services: 'Layanan', about: 'Tentang', portfolio: 'Portofolio', update: 'Update' }
export const PAGE_PATH = { home: '/', services: '/services', about: '/about', portfolio: '/portfolio', update: '/update' }

/* ---------- sanitising ---------- */
const bad = (msg) => Object.assign(new Error(msg), { status: 400 })
const s = (v, max, label) => { const x = typeof v === 'string' ? v.replace(/\r/g, '').trim() : ''; if (x.length > max) throw bad(`${label}: maksimal ${max} karakter.`); return x }
export function cleanHref(v, label = 'Tautan') {
  const x = s(v ?? '', 300, label)
  if (!x) return ''
  if (/^(\/(?!\/)|#|mailto:|tel:|https:\/\/|\{email\}|\{instagram\})/i.test(x) && !/[\s"<>]/.test(x.replace(/^mailto:/, ''))) return x
  throw bad(`${label}: gunakan /halaman, #anchor, https://…, mailto: atau tel:.`)
}
function cleanField(f, v) {
  const L = f.label || f.k, max = f.max || 200
  switch (f.t) {
    case 'i': case 'it': return { en: s(v?.en, max, L), id: s(v?.id, max, L) }
    case 'il': case 'ip': {
      const one = (a) => { if (a != null && !Array.isArray(a)) throw bad(`${L}: format daftar tidak valid.`); const r = (a || []).map((x) => s(x, max, L)).filter(Boolean); if (r.length > (f.maxItems || 12)) throw bad(`${L}: maksimal ${f.maxItems || 12} baris.`); return r }
      return { en: one(v?.en), id: one(v?.id) }
    }
    case 'p': return s(v, max, L)
    case 'href': return cleanHref(v, L)
    case 'ill': { v = v ?? 'connection'; if (!ILLUSTRATIONS.includes(v)) throw bad(`${L}: ilustrasi tidak dikenal.`); return v }
    case 'sel': { v = v ?? f.def ?? f.options[0][0]; if (!f.options.some(([o]) => o === v)) throw bad(`${L}: pilihan tidak valid.`); return v }
    case 'bool': return !!v
    case 'obj': return cleanObj(f.fields, v)
    case 'list': { if (v != null && !Array.isArray(v)) throw bad(`${L}: format daftar tidak valid.`); if ((v || []).length > (f.max || 20)) throw bad(`${L}: maksimal ${f.max || 20} butir.`); return (v || []).map((it) => cleanObj(f.fields, it)) }
    default: throw new Error('tipe field tidak dikenal ' + f.t)
  }
}
function cleanObj(fields, v) { const o = {}; for (const f of fields) o[f.k] = cleanField(f, v?.[f.k]); return o }
export function blank(fields) {
  const o = {}
  for (const f of fields) o[f.k] = { i: { en: '', id: '' }, it: { en: '', id: '' }, il: { en: [], id: [] }, ip: { en: [], id: [] }, p: '', href: '', ill: 'connection', sel: f.def ?? f.options?.[0]?.[0], bool: false, list: [] }[f.t] ?? (f.t === 'obj' ? blank(f.fields) : '')
  return o
}
export function newSection(type) {
  const d = SECTIONS[type]; if (!d) throw bad('Jenis section tidak dikenal.')
  return { id: `${type}-${Math.random().toString(36).slice(2, 7)}`, type, visible: true, ...blank(d.fields) }
}
export function cleanPage(page) {
  if (!page || !Array.isArray(page.sections)) throw bad('Data halaman tidak valid.')
  if (page.sections.length > 30) throw bad('Maksimal 30 section per halaman.')
  const seen = new Set(), uniq = new Set()
  const sections = page.sections.map((sec, i) => {
    const def = SECTIONS[sec?.type]; if (!def) throw bad(`Section #${i + 1}: jenis tidak dikenal.`)
    if (def.unique) { if (uniq.has(sec.type)) throw bad(`Section “${def.label}” hanya boleh satu per halaman.`); uniq.add(sec.type) }
    let id = /^[\w-]{1,40}$/.test(sec.id || '') ? sec.id : `${sec.type}-${i + 1}`; while (seen.has(id)) id += 'x'; seen.add(id)
    return { id, type: sec.type, visible: sec.visible !== false, ...cleanObj(def.fields, sec) }
  })
  return { meta: { title: cleanField({ t: 'i', max: 120, label: 'Judul tab' }, page.meta?.title), description: cleanField({ t: 'i', max: 300, label: 'Deskripsi SEO' }, page.meta?.description) }, sections }
}
