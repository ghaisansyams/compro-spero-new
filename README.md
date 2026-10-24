# pana-clone-full

Latihan kuliah: mempelajari struktur dan CSS sebuah situs Next.js dengan menyalinnya secara lokal.

Repo ini **privat** dan hanya untuk belajar. Seluruh konten, logo, dan gambar di dalamnya milik
Pana Digital Labs (https://www.pana.id) dan tidak boleh dipublikasikan atau dipakai ulang.

Menjalankan: `npm start` (atau `node server/index.mjs`), lalu buka http://localhost:8078. Admin/CMS: http://localhost:8078/admin/ — lihat [docs/ADMIN.md](docs/ADMIN.md)

## Halaman Update (Instagram)

`/update`, `/update/<slug>` dan teaser di beranda dibangun dari `data/updates.json`, yang diisi dari
https://www.instagram.com/spero_id/ lewat Apify (fitur yang sama dengan Kelas Bermain: draf, terbitkan,
sinkron tengah malam). Panduan: [docs/APIFY-INSTAGRAM.md](docs/APIFY-INSTAGRAM.md).
