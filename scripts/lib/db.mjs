// PostgreSQL persistence for the CMS.
//
// Model: Postgres is the source of truth. The rest of the code keeps its simple synchronous API
// (loadContent/saveContent, loadStore/saveStore, loadUsers/saveUsers) against an in-memory cache;
//   await init()      connect, apply db/schema.sql, load the cache (CLI scripts and the server call this once)
//   await refresh()   re-read the cache from Postgres (done at the start of every admin request)
//   await flush()     write every changed row back (done at the end of every mutating request)
// A row is only written when its JSON differs from what was last read, so a flush is cheap.
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, readEnv } from './env.mjs'

let pg, pool, ready = false
export const cache = { content: null, store: null, users: null }
const snap = { content: new Map(), updates: new Map(), users: new Map(), meta: '' }
const j = (v) => JSON.stringify(v)

export async function init() {
  if (ready) return
  const url = readEnv('DATABASE_URL')
  if (!url) throw new Error('DATABASE_URL belum diatur. Isi di .env.local, mis. postgresql://user:sandi@localhost:5432/compro_spero')
  try { pg = (await import('pg')).default } catch { throw new Error('Paket "pg" belum terpasang. Jalankan: npm install') }
  pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000, ssl: readEnv('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : undefined })
  pool.on('error', (e) => console.error('[db] idle client error:', e.message))
  try { await pool.query(fs.readFileSync(path.join(ROOT, 'db/schema.sql'), 'utf8')) }
  catch (e) { await pool.end().catch(() => {}); throw new Error(`Gagal terhubung/menyiapkan database: ${e.message}`) }
  ready = true
  await refresh()
}
export const q = (text, params) => pool.query(text, params)
export async function close() { if (pool) { await pool.end(); pool = null; ready = false } }

/* ---------- load ---------- */
export async function refresh() {
  const [c, u, m, us] = await Promise.all([
    q('SELECT key, draft, published FROM cms_content'), q('SELECT data FROM updates'),
    q("SELECT value FROM cms_meta WHERE key='updates'"), q('SELECT id, username, role, disabled, last_login_at, data FROM admin_users ORDER BY (data->>\'created_at\') NULLS FIRST, username'),
  ])
  // content: same shape the app has always used (pages nested under .pages)
  const content = { pages: {} }; snap.content = new Map()
  for (const r of c.rows) {
    const v = { draft: r.draft, published: r.published }; snap.content.set(r.key, j(v))
    if (r.key.startsWith('page:')) content.pages[r.key.slice(5)] = v; else content[r.key] = v
  }
  cache.content = content
  const meta = m.rows[0]?.value || { account: 'spero_id', updatedAt: null }; snap.meta = j(meta)
  snap.updates = new Map(u.rows.map((r) => [r.data.key, j(r.data)]))
  cache.store = { account: meta.account, updatedAt: meta.updatedAt, items: u.rows.map((r) => r.data) }
  snap.users = new Map()
  cache.users = { users: us.rows.map((r) => {
    const o = { id: r.id, username: r.username, role: r.role, disabled: r.disabled, lastLoginAt: r.last_login_at ? r.last_login_at.toISOString() : null, ...r.data }
    snap.users.set(r.id, j(o)); return o
  }) }
}
export const isEmpty = async () => Number((await q('SELECT count(*) FROM cms_content')).rows[0].count) === 0

/* ---------- write (diff against the last snapshot) ---------- */
const contentRows = () => {
  const c = cache.content, out = []
  for (const [k, v] of Object.entries(c)) if (k !== 'pages') out.push([k, v])
  for (const [k, v] of Object.entries(c.pages || {})) out.push([`page:${k}`, v])
  return out
}
export async function flush() {
  if (!ready) return
  const cl = await pool.connect()
  try {
    await cl.query('BEGIN')
    for (const [key, v] of contentRows()) {
      const s = j(v); if (snap.content.get(key) === s) continue
      await cl.query('INSERT INTO cms_content(key,draft,published,updated_at) VALUES($1,$2,$3,now()) ON CONFLICT (key) DO UPDATE SET draft=$2, published=$3, updated_at=now()', [key, j(v.draft), j(v.published)])
      snap.content.set(key, s)
    }
    // updates
    const st = cache.store, meta = { account: st.account, updatedAt: st.updatedAt }
    if (j(meta) !== snap.meta) { await cl.query("INSERT INTO cms_meta(key,value) VALUES('updates',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [j(meta)]); snap.meta = j(meta) }
    const live = new Set()
    for (const it of st.items) {
      live.add(it.key); const s = j(it); if (snap.updates.get(it.key) === s) continue
      await cl.query(`INSERT INTO updates(key,slug,published_at,published,visible,data,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())
        ON CONFLICT (key) DO UPDATE SET slug=$2, published_at=$3, published=$4, visible=$5, data=$6, updated_at=now()`, [it.key, it.slug, it.publishedAt || null, !!it.published, it.visible !== false, s])
      snap.updates.set(it.key, s)
    }
    for (const k of [...snap.updates.keys()]) if (!live.has(k)) { await cl.query('DELETE FROM updates WHERE key=$1', [k]); snap.updates.delete(k) }
    // users
    const ids = new Set()
    for (const u of cache.users.users) {
      ids.add(u.id); const s = j(u); if (snap.users.get(u.id) === s) continue
      const { id, username, role, disabled, lastLoginAt, ...rest } = u
      await cl.query(`INSERT INTO admin_users(id,username,role,disabled,last_login_at,data,updated_at) VALUES($1,$2,$3,$4,$5,$6,now())
        ON CONFLICT (id) DO UPDATE SET username=$2, role=$3, disabled=$4, last_login_at=$5, data=$6, updated_at=now()`, [id, username, role, !!disabled, lastLoginAt || null, j(rest)])
      snap.users.set(u.id, s)
    }
    for (const id of [...snap.users.keys()]) if (!ids.has(id)) { await cl.query('DELETE FROM admin_users WHERE id=$1', [id]); snap.users.delete(id) }
    await cl.query('COMMIT')
  } catch (e) { await cl.query('ROLLBACK').catch(() => {}); throw e } finally { cl.release() }
}

/* ---------- versions + activity (direct queries) ---------- */
export async function insertVersion(v) {
  await q('INSERT INTO cms_versions(id,key,ts,username,note,data) VALUES($1,$2,$3,$4,$5,$6)', [v.id, v.key, v.ts, v.user, v.note, j(v.data)])
  await q(`DELETE FROM cms_versions WHERE key=$1 AND id NOT IN (SELECT id FROM cms_versions WHERE key=$1 ORDER BY ts DESC, id DESC LIMIT 40)`, [v.key])
}
export const listVersionRows = async (key) => (await q('SELECT id, ts, username, note FROM cms_versions WHERE key=$1 ORDER BY ts DESC, id DESC', [key])).rows.map((r) => ({ id: r.id, ts: r.ts.toISOString(), user: r.username, note: r.note }))
export const getVersionRow = async (key, id) => { const r = (await q('SELECT id, ts, username, note, data FROM cms_versions WHERE key=$1 AND id=$2', [key, id])).rows[0]; return r && { id: r.id, ts: r.ts.toISOString(), user: r.username, note: r.note, key, data: r.data } }
export const countVersions = async (key) => Number((await q('SELECT count(*) FROM cms_versions WHERE key=$1', [key])).rows[0].count)
export async function insertActivity(a) { await q('INSERT INTO activity_log(username,action,target,detail) VALUES($1,$2,$3,$4)', [a.user, a.action, a.target, a.detail]) }
export const recentActivity = async (limit) => (await q('SELECT ts, username, action, target, detail FROM activity_log ORDER BY ts DESC, id DESC LIMIT $1', [limit])).rows.map((r) => ({ ts: r.ts.toISOString(), user: r.username, action: r.action, target: r.target, detail: r.detail }))
