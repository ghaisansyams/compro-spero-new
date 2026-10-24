#!/usr/bin/env node
// Bangun ulang semua halaman statis dari konten yang sudah diterbitkan di PostgreSQL.   npm run build
import { init, close } from './lib/db.mjs'
import { buildSite } from './lib/site.mjs'
try { await init(); console.log(buildSite()); await close() } catch (e) { console.error(e.message); await close().catch(() => {}); process.exit(1) }
