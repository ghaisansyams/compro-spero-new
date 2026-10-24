#!/usr/bin/env node
/**
 * Impor data awal dari data/seed/ (content.json, updates.json, versions/) ke PostgreSQL.
 * Dipakai sekali saat database baru (mis. di server produksi). Buat seed terbaru dari database dengan: node scripts/db-export.mjs
 *   node scripts/db-migrate.mjs            # hanya jika database masih kosong
 *   node scripts/db-migrate.mjs --force    # timpa isi database dengan file JSON
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { init, close, cache, flush, isEmpty, q, insertVersion } from './lib/db.mjs'

const force = process.argv.includes('--force')
const SEED = 'data/seed'
const rd = (f) => { const p = path.join(ROOT, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
try {
  await init()
  if (!(await isEmpty()) && !force) { console.log('Database sudah berisi data; tidak ada yang diubah. Pakai --force untuk menimpa.'); await close(); process.exit(0) }
  const content = rd(`${SEED}/content.json`); if (!content) throw new Error(`${SEED}/content.json tidak ditemukan.`)
  if (force) { for (const t of ['cms_content', 'cms_versions', 'cms_meta', 'updates', 'admin_users', 'activity_log']) await q(`TRUNCATE ${t}`); await (await import('./lib/db.mjs')).refresh() }
  cache.content = content
  const store = rd(`${SEED}/updates.json`); if (store) cache.store = store
    await flush()
  // version history
  let nv = 0; const vroot = path.join(ROOT, SEED, 'versions')
  if (fs.existsSync(vroot)) for (const d of fs.readdirSync(vroot)) for (const f of fs.readdirSync(path.join(vroot, d))) {
    const v = JSON.parse(fs.readFileSync(path.join(vroot, d, f), 'utf8')); await insertVersion({ id: v.id, ts: v.ts, user: v.user || 'system', key: v.key, note: v.note || '', data: v.data }); nv++
  }
  const n = async (t) => Number((await q(`SELECT count(*) FROM ${t}`)).rows[0].count)
  console.log(`Selesai. cms_content=${await n('cms_content')} updates=${await n('updates')} admin_users=${await n('admin_users')} cms_versions=${nv} activity_log=0 (akun admin dibuat dengan: node scripts/admin-user.mjs add <username> --role admin)`)
  await close()
} catch (e) { console.error('Migrasi gagal:', e.message); await close().catch(() => {}); process.exit(1) }
