#!/usr/bin/env node
// Pengganti tombol "Terbitkan" di CMS Kelas Bermain.
//   node scripts/instagram-publish.mjs list
//   node scripts/instagram-publish.mjs publish <slug|all>
//   node scripts/instagram-publish.mjs unpublish <slug|all>
//   node scripts/instagram-publish.mjs hide <slug>      # sembunyikan; sinkron berikutnya tidak menampilkannya lagi
//   node scripts/instagram-publish.mjs show <slug>
import { loadStore, saveStore } from './lib/updates.mjs'
import { init, flush, close } from './lib/db.mjs'
import { buildSite as buildUpdates } from './lib/site.mjs'
const [cmd, target] = process.argv.slice(2)
await init()
const store = loadStore()
const pick = () => (target === 'all' ? store.items : store.items.filter((i) => i.slug === target || i.key === target))
const label = (i) => `${i.published ? (i.visible ? 'TAYANG ' : 'TERSEMBUNYI') : 'DRAF  '}  ${i.publishedAt}  ${i.slug}\n         ${i.title}`
if (!cmd || cmd === 'list') {
  if (!store.items.length) console.log('Belum ada data. Jalankan: node scripts/instagram-sync.mjs')
  for (const i of [...store.items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) console.log(label(i))
  await close(); process.exit(0)
}
const set = { publish: { published: true }, unpublish: { published: false }, hide: { visible: false }, show: { visible: true } }[cmd]
if (!set) { console.error('Perintah: list | publish | unpublish | hide | show'); process.exit(1) }
const items = pick()
if (!target || !items.length) { console.error(`Tidak ada postingan untuk "${target ?? ''}". Lihat: list`); process.exit(1) }
items.forEach((i) => Object.assign(i, set))
saveStore(store)
await flush()
const r = buildUpdates()
console.log(`${items.length} postingan diubah (${cmd}). ${r.published} tayang, ${r.detail} halaman detail.`)
await close()
