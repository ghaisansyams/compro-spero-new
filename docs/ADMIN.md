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
| **Update** | Postingan Instagram (Apify) + update manual; terbitkan / tarik / sembunyikan / edit / hapus (manual) | Draf per item → **Terbitkan** |
| **Tim** | Nama, jabatan, foto, urutan → halaman About | Draf → **Simpan & terbitkan** |
| **Klien** | Daftar nama → marquee “Our Clients” | Draf → terbitkan |
| **Kontak** | Email (semua link mailto di situs), telepon, alamat, username Instagram | Draf → terbitkan |
| **Media** | Unggah / hapus gambar (JPG, PNG, WebP, maks. 5 MB) | langsung |
| **Pengguna** | Tambah, ubah peran, nonaktifkan, reset sandi, hapus | langsung (admin) |
| **Aktivitas** | 200 kejadian terakhir (siapa melakukan apa) | – |

Tombol **Sinkron Instagram** memakai Apify (`APIFY_TOKEN` di `.env.local`). Postingan baru masuk sebagai **draf**.
Update yang sudah Anda edit tidak ditimpa sinkron berikutnya; status terbit/sembunyi juga tidak berubah.

## Penyimpanan

| Berkas | Isi | Di git? |
|---|---|---|
| `data/updates.json` | semua update + status | ya |
| `data/content.json` | tim, klien, kontak (draf & tayang) | ya |
| `data/admin-users.json` | akun + hash kata sandi (scrypt) | **tidak** |
| `data/activity.jsonl` | log aktivitas | **tidak** |
| `.env.local` | `APIFY_TOKEN`, `SESSION_SECRET` | **tidak** |

Setiap publikasi menjalankan `buildSite()` (`scripts/lib/site.mjs`) yang menulis ulang blok di HTML:
`<!--team-…-->`, `<!--contactinfo-…-->`, `<!--clients-…-->`, daftar & detail Update, teaser beranda, dan email.
Bisa dijalankan manual: `npm run build`.

## Keamanan (ringkas)

- Sesi: cookie `HttpOnly` + `SameSite=Strict`, ditandatangani HMAC (`SESSION_SECRET`), berlaku 8 jam; ganti/reset sandi mencabut semua sesi.
- Login dibatasi 5 percobaan gagal per IP+username → kunci 15 menit; respons tidak membocorkan apakah username ada.
- Semua perubahan wajib JSON + pemeriksaan `Origin` (anti-CSRF); input divalidasi di server; HTML selalu di-escape.
- Unggahan dicek isinya (magic bytes), SVG ditolak, nama file dibuat acak.
- `/data`, `/server`, `/scripts`, `/docs`, `.env*`, `package.json`, `.git` tidak pernah disajikan; path traversal ditolak.
- Halaman admin memakai CSP ketat (tanpa skrip inline) dan `X-Frame-Options: DENY`.

## Kalau dipasang di server sungguhan

Jalankan di belakang **HTTPS** (mis. Nginx/Caddy), set `HOST=0.0.0.0` (atau biarkan 127.0.0.1 + reverse proxy) dan
`COOKIE_SECURE=true` di `.env.local`. Jangan membuka port Node langsung ke internet tanpa HTTPS.
Cron sinkron tengah malam: lihat `docs/APIFY-INSTAGRAM.md`. Cadangkan folder `data/` dan `images/`.
