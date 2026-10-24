# CMS & Admin Spero Website

Situs publiknya tetap **statis** (HTML). Admin hanya mengubah data lalu membangun ulang halaman, jadi
pengunjung tidak pernah menyentuh database atau API admin.

```
npm start            # = node server/index.mjs  ->  http://localhost:8078   (admin: /admin/)
```

Server (`server/index.mjs`, tanpa dependency) menyajikan situs, UI admin `/admin/`, dan API `/api/admin/*`.
Hanya berjalan di `127.0.0.1` secara bawaan.

## Akun

```bash
node scripts/admin-user.mjs add budi --role editor            # kata sandi diketik tersembunyi
node scripts/admin-user.mjs add budi --role admin --generate  # atau dibuatkan acak (tampil sekali)
node scripts/admin-user.mjs passwd budi
node scripts/admin-user.mjs list
```

| Peran | Update, Tim, Klien, Kontak, Media | Pengguna, Aktivitas, Bangun ulang |
|---|---|---|
| admin | ✓ | ✓ |
| editor | ✓ | – |

Kata sandi minimal 10 karakter. Ganti sendiri di menu **Akun saya**.

## Apa yang bisa diatur

| Menu | Isi | Model |
|---|---|---|
| **Halaman** | Semua teks (EN + ID) lima halaman: Beranda, Layanan, Tentang, Portofolio, Update. Tambah / hapus / urutkan / sembunyikan section, judul tab & SEO | Draf → pratinjau → terbitkan |
| **Portofolio** | Karya (produk & 3D/game): nama, deskripsi, teknologi, metrik, link demo, warna, gambar | Draf → terbitkan |
| **Update** | Postingan Instagram (Apify) + update manual | Draf per item → **Terbitkan** |
| **Tim / Klien / Kontak** | Anggota tim, daftar klien, email-telepon-alamat-Instagram | Draf → terbitkan |
| **Menu** | Isi, urutan, dan tampil/sembunyi menu header & footer (EN + ID) | Draf → terbitkan |
| **Situs & footer** | Nama, logo terang/gelap, favicon, tombol header, tagline & teks footer, alamat situs, gambar berbagi | Draf → terbitkan |
| **Tema** | Preset warna, warna terang & gelap, sudut tombol/kartu, mode awal | Draf → terbitkan |
| **Riwayat versi** | 40 versi terakhir tiap bagian; lihat perbedaan; pulihkan sebagai draf | – |
| **Media** | Unggah / hapus gambar (JPG, PNG, WebP, maks. 5 MB) | langsung |
| **Pengguna / Aktivitas** | Akun & peran; 200 kejadian terakhir | langsung (admin) |

Setiap bagian punya **Pratinjau draf** (desktop/HP, EN/ID) dan **Lihat perubahan** (apa saja yang beda dari yang tayang) sebelum diterbitkan.
Dashboard menampilkan semua draf yang belum diterbitkan, dengan tombol **Terbitkan semua**.

### Section yang tersedia di editor halaman

Hero beranda · Pernyataan fokus · Garis kata berjalan (gaya + kecepatan) · Daftar layanan · Tentang studio · Rail portofolio ·
Update terbaru · Klien · Ajakan menghubungi · Judul halaman · Rincian layanan · Alur kerja · Profil perusahaan · Visi & misi ·
Tim · Info kontak · Daftar karya · Daftar update · **Blok teks bebas** (untuk halaman baru / tambahan).
Section bertanda “satu per halaman” tidak bisa dobel. Section yang isinya dikelola menu lain (Tim, Klien, Karya, Update) hanya menampilkan judulnya di sini.

Teks bisa memakai `{email}` dan `{instagram}`; keduanya diganti otomatis dari menu Kontak. Tautan internal (`/services`) otomatis menjadi `/id/services` di versi Indonesia.
Kalau satu bahasa dikosongkan, situs memakai versi EN.

## Penyimpanan

| Berkas | Isi | Di git? |
|---|---|---|
| `data/updates.json` | semua update + status | ya |
| `data/content.json` | semua konten CMS (halaman, portofolio, menu, situs, tema, tim, klien, kontak), masing-masing draf & tayang | ya |
| `data/versions/` | riwayat versi tiap bagian | ya |
| `theme.css` | dihasilkan dari menu Tema | ya (otomatis) |
| `data/admin-users.json` | akun + hash kata sandi (scrypt) | **tidak** |
| `data/activity.jsonl` | log aktivitas | **tidak** |
| `.env.local` | `APIFY_TOKEN`, `SESSION_SECRET` | **tidak** |

Setiap publikasi menjalankan `buildSite()` (`scripts/lib/site.mjs`), yang **membangun ulang seluruh halaman** (10 halaman EN+ID, detail Update, `theme.css`)
dari konten yang sudah diterbitkan lewat `scripts/lib/render.mjs`. File HTML di repo adalah hasil build; ubah lewat admin, bukan langsung.
Bisa dijalankan manual: `npm run build`. Struktur & aturan isi tiap section ada di `scripts/lib/schema.mjs`.

## Keamanan (ringkas)

- Sesi: cookie `HttpOnly` + `SameSite=Strict`, ditandatangani HMAC (`SESSION_SECRET`), berlaku 8 jam; ganti/reset sandi mencabut semua sesi.
- Login dibatasi 5 percobaan gagal per IP+username → kunci 15 menit; respons tidak membocorkan apakah username ada.
- Semua tautan divalidasi (`javascript:` ditolak), warna harus `#rrggbb`, semua teks di-escape saat dirender.
- Semua perubahan wajib JSON + pemeriksaan `Origin` (anti-CSRF); input divalidasi di server; HTML selalu di-escape.
- Unggahan dicek isinya (magic bytes), SVG ditolak, nama file dibuat acak.
- `/data`, `/server`, `/scripts`, `/docs`, `.env*`, `package.json`, `.git` tidak pernah disajikan; path traversal ditolak.
- Halaman admin memakai CSP ketat (tanpa skrip inline) dan `X-Frame-Options: DENY`.

## Kalau dipasang di server sungguhan

Jalankan di belakang **HTTPS** (mis. Nginx/Caddy), set `HOST=0.0.0.0` (atau biarkan 127.0.0.1 + reverse proxy) dan
`COOKIE_SECURE=true` di `.env.local`. Jangan membuka port Node langsung ke internet tanpa HTTPS.
Cron sinkron tengah malam: lihat `docs/APIFY-INSTAGRAM.md`. Cadangkan folder `data/` dan `images/`.
