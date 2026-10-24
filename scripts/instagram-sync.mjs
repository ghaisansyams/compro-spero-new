#!/usr/bin/env node
/**
 * Instagram -> halaman Update (cara kerja sama dengan Kelas Bermain). Lihat docs/APIFY-INSTAGRAM.md.
 *   node scripts/instagram-sync.mjs                    # ambil lewat Apify, simpan sebagai DRAF, bangun halaman
 *   node scripts/instagram-sync.mjs --from dump.json   # pakai export dataset Apify (tanpa API)
 *   node scripts/instagram-sync.mjs --publish          # postingan baru langsung tayang
 */
import fs from 'node:fs'
import path from 'node:path'
import { init, flush, close } from './lib/db.mjs'
import { syncInstagram } from './lib/instagram.mjs'
import { buildSite } from './lib/site.mjs'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined }
try {
  await init()
  const from = arg('from') ? JSON.parse(fs.readFileSync(path.resolve(arg('from')), 'utf8')) : undefined
  const r = await syncInstagram({ from, publish: process.argv.includes('--publish') })
  console.log(`[instagram] ${r.saved} tersimpan, ${r.skipped} dilewati, ${r.uploaded} gambar baru, ${r.reused} dipakai ulang`)
  await flush()
  const b = buildSite()
  console.log(`[update] ${b.published} postingan tayang, ${b.detail} halaman detail`)
  if (r.drafts) console.log(`\n${r.drafts} postingan baru masuk sebagai DRAF. Terbitkan di admin (/admin) atau:\n  node scripts/instagram-publish.mjs publish all`)
  await close()
} catch (err) { console.error(`[instagram] sinkron gagal: ${err.message}`); await close().catch(() => {}); process.exit(1) }
