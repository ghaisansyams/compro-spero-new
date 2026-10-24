# Mengambil postingan Instagram @spero_id lewat Apify

Halaman **Update** (`/update`) membaca `data/instagram.json`. File itu diisi oleh
`scripts/fetch-instagram.mjs`, yang memanggil Actor **Instagram Scraper** di Apify.
Token Apify hanya dipakai di skrip ini (di komputer Anda), tidak pernah masuk ke browser.

## 1. Buat akun dan ambil API token

1. Daftar di https://console.apify.com (bisa pakai Google/GitHub). Akun gratis mendapat kredit
   bulanan; cek angka terbarunya di halaman Billing.
2. Buka **Settings → API & Integrations** (atau https://console.apify.com/account/integrations).
3. Di **Personal API tokens**, salin token (`apify_api_...`). Boleh buat token baru lewat
   **+ Create new token** dan beri nama, misalnya `spero-website`.
4. Anggap token seperti password. Jangan ditempel di HTML/JS, jangan di-commit.
   Kalau terlanjur bocor, hapus tokennya di halaman yang sama lalu buat yang baru.

## 2. Coba dulu lewat web (tanpa kode)

1. Buka Actor: https://apify.com/apify/instagram-scraper lalu klik **Try for free**.
2. Isi **Input**:
   - **Direct URLs**: `https://www.instagram.com/spero_id/`
   - **Type of results (Results type)**: `Posts`
   - **Max items / Results limit**: `12`
3. Klik **Start**. Setelah status **Succeeded**, buka tab **Output / Storage** untuk melihat datanya.
4. Cek kolom yang dipakai website: `shortCode`, `url`, `caption`, `displayUrl`, `likesCount`,
   `commentsCount`, `timestamp`, `type`. Kalau di Output Anda namanya berbeda, sesuaikan
   bagian pemetaan di `scripts/fetch-instagram.mjs`.
5. (Opsional) Klik **Export** → JSON untuk menyimpan hasilnya sebagai file.

## 3. Pakai lewat API (yang dijalankan skrip)

Satu panggilan: jalankan Actor, tunggu selesai, langsung terima hasilnya.

```bash
curl -X POST "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items" \
  -H "Authorization: Bearer $APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"directUrls":["https://www.instagram.com/spero_id/"],"resultsType":"posts","resultsLimit":12,"addParentData":false}'
```

Catatan: pada URL API, nama Actor ditulis dengan `~` (`apify~instagram-scraper`), bukan `/`.
Endpoint `run-sync-...` menunggu paling lama sekitar 5 menit. Kalau akun besar atau lambat,
pakai pola asinkron: `POST /v2/acts/apify~instagram-scraper/runs`, lalu ambil hasilnya dari
`GET /v2/datasets/{defaultDatasetId}/items`.

## 4. Jalankan di proyek ini

```bash
cd ~/Projects/pana-clone-full

# simpan token (file ini sudah masuk .gitignore)
echo 'APIFY_TOKEN=apify_api_xxxxxxxx' > .env.local

# ambil 12 postingan terbaru -> data/instagram.json + images/instagram/*.jpg
node scripts/fetch-instagram.mjs

# opsi
node scripts/fetch-instagram.mjs --user spero_id --limit 20
node scripts/fetch-instagram.mjs --from dataset.json   # pakai hasil export, tanpa memanggil API
```

Lalu buka http://localhost:8078/update. Gambar disalin ke `images/instagram/` karena link
gambar Instagram kedaluwarsa dan tidak boleh di-hotlink.

## 5. Biar otomatis (opsional)

- **Jadwal di Apify**: di halaman Actor pilih **Schedules**, misalnya tiap hari jam 06.00.
- **Cron / GitHub Actions**: jalankan `node scripts/fetch-instagram.mjs` terjadwal, simpan
  `APIFY_TOKEN` sebagai *secret*, lalu commit `data/` dan `images/instagram/`.

## Catatan

- Hanya akun/postingan **publik**. Instagram bisa mengubah struktur halamannya sewaktu-waktu;
  Actor di Apify biasanya diperbarui oleh pembuatnya, jadi kalau hasil kosong cek halaman Actor.
- Biaya dihitung per hasil/penggunaan Actor, lihat harga terbaru di halaman Actor sebelum
  menjadwalkan dalam jumlah besar.
- Pakai data hanya dari akun milik sendiri atau yang diizinkan, dan patuhi ketentuan Instagram.
