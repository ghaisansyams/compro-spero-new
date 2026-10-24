#!/usr/bin/env node
// Ekspor konten dari PostgreSQL ke data/seed/ (tanpa akun admin & log). Berguna sebagai cadangan yang bisa dibaca / seed server baru.
//   node scripts/db-export.mjs      (cadangan penuh tetap disarankan lewat pg_dump, lihat docs/DEPLOY.md)
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './lib/env.mjs'
import { init, close, cache, q } from './lib/db.mjs'
try {
  await init()
  const dir = path.join(ROOT, 'data/seed'); fs.mkdirSync(path.join(dir, 'versions'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'content.json'), JSON.stringify(cache.content, null, 1) + '\n')
  fs.writeFileSync(path.join(dir, 'updates.json'), JSON.stringify(cache.store, null, 2) + '\n')
  const vs = (await q('SELECT id, key, ts, username, note, data FROM cms_versions ORDER BY key, ts')).rows
  fs.rmSync(path.join(dir, 'versions'), { recursive: true, force: true })
  for (const v of vs) { const d = path.join(dir, 'versions', v.key.replace(/[^\w-]/g, '_')); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, v.id + '.json'), JSON.stringify({ id: v.id, ts: v.ts.toISOString(), user: v.username, key: v.key, note: v.note, data: v.data })) }
  console.log(`Seed ditulis ke data/seed/: ${Object.keys(cache.content.pages).length + 7} koleksi, ${cache.store.items.length} update, ${vs.length} versi.`)
  await close()
} catch (e) { console.error(e.message); await close().catch(() => {}); process.exit(1) }
