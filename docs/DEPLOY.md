# Deploy ke server (menggantikan https://spero.id)

Arsitektur: **satu proses Node** (`server/index.mjs`) + **PostgreSQL**. Node menyajikan halaman statis hasil build,
panel `/admin/`, dan API admin. Reverse proxy (Nginx/Caddy) hanya menambahkan HTTPS.

```
pengunjung ──HTTPS──▶ Nginx/Caddy ──▶ Node :8078 ──▶ PostgreSQL
                                        └─ menulis halaman statis + images/ di disk
```

> Yang perlu **disk permanen**: `images/` (unggahan + gambar Instagram) dan folder proyek itu sendiri (halaman HTML dibangun ulang
> ke disk setiap kali admin menerbitkan). Cocok untuk VPS/server biasa. **Tidak cocok** untuk hosting serverless
> (Vercel dsb.) kecuali hasil build dipublikasikan lewat langkah terpisah.

## 1. Siapkan server

```bash
# Node 20+ dan PostgreSQL 14+ terpasang
git clone https://github.com/ghaisansyams/compro-spero-new.git /srv/spero && cd /srv/spero
npm install --omit=dev
```

## 2. Database

```sql
-- sebagai superuser Postgres
CREATE ROLE comprospero LOGIN PASSWORD '<sandi-kuat>';
CREATE DATABASE compro_spero OWNER comprospero ENCODING 'UTF8';
```

`.env.local` (lihat `.env.example`):

```
DATABASE_URL=postgresql://comprospero:<sandi-kuat>@localhost:5432/compro_spero
APIFY_TOKEN=apify_api_...
COOKIE_SECURE=true
```

Tabel dibuat otomatis saat server pertama kali jalan (`db/schema.sql`). Isi data awal dari seed, lalu buat admin:

```bash
npm run db:migrate                               # impor data/seed/ (konten, update, riwayat versi)
node scripts/admin-user.mjs add <username> --role admin      # sandi diketik tersembunyi
npm run build                                    # bangun semua halaman dari konten
```

Untuk memindahkan data **terbaru** dari mesin lokal: `node scripts/db-export.mjs` (menulis `data/seed/`), commit/salin, lalu `db:migrate` di server.
Atau gunakan `pg_dump` / `pg_restore` (lebih lengkap, termasuk akun admin dan log).

## 3. Jalankan sebagai service (systemd)

`/etc/systemd/system/spero.service`:

```ini
[Unit]
Description=Spero website
After=network.target postgresql.service

[Service]
WorkingDirectory=/srv/spero
ExecStart=/usr/bin/node server/index.mjs
Restart=always
User=spero
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

`sudo systemctl enable --now spero`. User `spero` harus bisa **menulis** ke folder proyek (halaman & `images/`).

## 4. HTTPS (Caddy, paling singkat)

```
spero.id, www.spero.id {
  reverse_proxy 127.0.0.1:8078
}
```

Nginx: `proxy_pass http://127.0.0.1:8078;` + sertifikat Let's Encrypt, dan teruskan header `Host` / `X-Forwarded-For`.
Pastikan `COOKIE_SECURE=true`. Setelah domain siap, isi **Alamat situs** (`https://spero.id`) di admin → *Situs & footer* lalu terbitkan
(untuk canonical dan Open Graph).

## 5. Pindah dari situs lama dengan aman

1. Pasang di server baru / subdomain dulu (mis. `baru.spero.id`) dan uji lewat browser.
2. Pastikan semua halaman, bahasa EN/ID, login admin, dan unggah gambar berfungsi.
3. Turunkan TTL DNS beberapa jam sebelumnya, lalu arahkan `spero.id` ke server baru.
4. **Simpan cadangan situs lama** (file + database-nya) sebelum dimatikan, dan jangan hapus sampai situs baru stabil.

Pemetaan alamat: halaman baru memakai `/services`, `/portfolio`, `/update`, `/about` (dan `/id/...`). Kalau situs lama punya alamat lain yang sudah
terindeks Google, tambahkan redirect 301 di reverse proxy.

## 6. Otomatis & cadangan

```cron
# sinkron Instagram tiap tengah malam WIB (postingan baru masuk sebagai draf)
0 0 * * *  cd /srv/spero && /usr/bin/node scripts/instagram-sync.mjs >> /var/log/spero-ig.log 2>&1
# cadangan database harian (simpan 14 hari)
30 1 * * * pg_dump -Fc -U comprospero compro_spero > /var/backups/spero-$(date +\%F).dump && find /var/backups -name 'spero-*.dump' -mtime +14 -delete
```

Cadangkan juga folder `images/`. Restore: `pg_restore -c -d compro_spero file.dump`.

## Catatan teknis

- Postgres adalah sumber kebenaran. Server memuat data ke memori, **menyegarkannya di awal setiap permintaan admin**, dan menulis balik baris yang berubah
  di akhir permintaan (satu permintaan admin diproses pada satu waktu). Skrip CLI (`instagram-sync`, `admin-user`, dsb.) memakai mekanisme yang sama.
- Sesi login memakai cookie bertanda tangan (`SESSION_SECRET`), jadi tetap berlaku setelah server restart. Hanya penghitung percobaan login gagal yang di memori.
- Satu server Node saja yang boleh menjalankan admin. Beberapa instance di belakang load balancer belum didukung (halaman statis ditulis ke disk lokal).
