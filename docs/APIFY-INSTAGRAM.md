# Update dari Instagram @spero_id (Apify)

Fiturnya sama dengan halaman Update di Kelas Bermain:

- **Actor Apify**: `apify/instagram-post-scraper` (input: `username`, `resultsLimit`, `dataDetailLevel: basicData`).
- Postingan masuk sebagai **DRAF** dan baru tayang setelah diterbitkan (padanan tombol *Terbitkan* di CMS).
- Gambar disalin ke `images/instagram/` (URL CDN Instagram kedaluwarsa).
- Judul, ringkasan, slug, dan kategori (Kegiatan / Event / Pengumuman / Dokumentasi) dibuat otomatis dari caption.
- Halaman yang dibuat: daftar `/update`, detail `/update/<slug>`, teaser "Update terbaru" di beranda (EN dan ID).
- Nol postingan dari Apify dianggap **gagal**, data lama tidak diubah.

## Setup sekali

1. Token: console.apify.com → Settings → API & Integrations → Personal API tokens. (Pakai token yang sama dengan Kelas Bermain boleh; kreditnya satu akun.)
2. Buat `.env.local` di folder proyek (sudah di-gitignore):
   ```
   APIFY_TOKEN=apify_api_xxxxxxxx
   INSTAGRAM_USERNAME=spero_id
   INSTAGRAM_LIMIT=12
   INSTAGRAM_SKIP_VIDEO=false
   ```

## Pemakaian

```bash
cd ~/Projects/pana-clone-full

node scripts/instagram-sync.mjs               # ambil dari Apify -> simpan sebagai draf -> bangun halaman
node scripts/instagram-publish.mjs list       # lihat status: DRAF / TAYANG / TERSEMBUNYI
node scripts/instagram-publish.mjs publish all            # terbitkan semua draf
node scripts/instagram-publish.mjs publish <slug>         # terbitkan satu
node scripts/instagram-publish.mjs unpublish <slug|all>   # tarik kembali jadi draf
node scripts/instagram-publish.mjs hide <slug>            # sembunyikan; sinkron berikutnya tidak menampilkannya lagi
node scripts/instagram-publish.mjs show <slug>
```

Opsi sinkron: `--publish` (postingan baru langsung tayang), `--from dump.json` (pakai export dari Apify
Console tanpa memanggil API).

Status terbit/sembunyi **tidak ditimpa** oleh sinkron berikutnya; yang diperbarui hanya isi (caption, gambar, dll).

## Otomatis tiap tengah malam (seperti cron Kelas Bermain)

`crontab -e`, lalu tambahkan (zona waktu Mac harus WIB):

```
0 0 * * * cd /Users/ghaisansyams/Projects/pana-clone-full && /usr/local/bin/node scripts/instagram-sync.mjs --publish >> /tmp/spero-instagram.log 2>&1
```

`--publish` hanya bila Anda mau postingan baru langsung tayang tanpa review; tanpa itu postingan baru
menunggu `publish`. Cek path node dengan `which node`.

## Biaya dan catatan

- Akun Apify gratis mendapat kredit bulanan; 12 postingan per sinkron sangat kecil biayanya. Cek **Usage**
  di console setelah run pertama.
- Hanya postingan publik dari akun sendiri; tidak ada login Instagram.
- Jangan commit token. Jika bocor, hapus dan buat ulang di Settings → API & Integrations.
