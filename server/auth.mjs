// Admin accounts, password hashing and signed session cookies. No dependencies.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { ROOT, readEnv } from '../scripts/lib/env.mjs'
import { cache } from '../scripts/lib/db.mjs'

const scrypt = promisify(crypto.scrypt)
export const COOKIE = 'spero_admin'
const TTL_MS = 8 * 60 * 60 * 1000
export const ROLES = ['admin', 'editor']

export const loadUsers = () => cache.users
export const saveUsers = (d) => { cache.users = d }
export const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, disabled: !!u.disabled, lastLoginAt: u.lastLoginAt || null, createdAt: u.createdAt })

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16)
  const h = await scrypt(pw, salt, 64)
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`
}
async function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const h = await scrypt(pw, Buffer.from(salt, 'hex'), 64)
  const want = Buffer.from(hash, 'hex')
  return h.length === want.length && crypto.timingSafeEqual(h, want)
}
export const validPassword = (pw) => typeof pw === 'string' && pw.length >= 10 && pw.length <= 200

export async function createUser({ username, name, role, password }) {
  const d = loadUsers()
  if (!/^[a-z0-9._-]{3,32}$/.test(username || '')) throw new Error('Username 3-32 karakter: huruf kecil, angka, titik, strip, garis bawah.')
  if (d.users.some((u) => u.username === username)) throw new Error('Username sudah dipakai.')
  if (!ROLES.includes(role)) throw new Error('Peran tidak dikenal.')
  if (!validPassword(password)) throw new Error('Kata sandi minimal 10 karakter.')
  const u = { id: crypto.randomUUID(), username, name: String(name || username).slice(0, 80), role, hash: await hashPassword(password), pv: 1, disabled: false, createdAt: new Date().toISOString() }
  d.users.push(u); saveUsers(d); return u
}
export async function setPassword(id, password) {
  const d = loadUsers(), u = d.users.find((x) => x.id === id)
  if (!u) throw new Error('Pengguna tidak ditemukan.')
  if (!validPassword(password)) throw new Error('Kata sandi minimal 10 karakter.')
  u.hash = await hashPassword(password); u.pv = (u.pv || 1) + 1; saveUsers(d)   // pv naik -> semua sesi lama mati
}
export async function checkPassword(user, password) { return verifyPassword(String(password ?? ''), user.hash) }

/* ---------- session secret (persisted in .env.local the first time) ---------- */
function secret() {
  let s = readEnv('SESSION_SECRET')
  if (!s) {
    s = crypto.randomBytes(32).toString('hex')
    const f = path.join(ROOT, '.env.local')
    fs.appendFileSync(f, `${fs.existsSync(f) ? '\n' : ''}SESSION_SECRET=${s}\n`, { mode: 0o600 })
    process.env.SESSION_SECRET = s
  }
  return s
}
const sign = (b) => crypto.createHmac('sha256', secret()).update(b).digest('base64url')
export function makeToken(u) {
  const body = Buffer.from(JSON.stringify({ u: u.id, pv: u.pv || 1, exp: Date.now() + TTL_MS })).toString('base64url')
  return `${body}.${sign(body)}`
}
export function userFromCookie(header) {
  const m = String(header || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (!m) return null
  const [body, sig] = m[1].split('.')
  if (!body || !sig) return null
  const want = sign(body)
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (!p.exp || p.exp < Date.now()) return null
    const u = loadUsers().users.find((x) => x.id === p.u)
    return u && !u.disabled && (u.pv || 1) === p.pv ? u : null
  } catch { return null }
}
export const cookieHeader = (token) => `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}${readEnv('COOKIE_SECURE') === 'true' ? '; Secure' : ''}`
export const clearCookie = () => `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`

/* ---------- login with throttling ---------- */
const fails = new Map()   // ip|username -> {n, until}
export async function login(ip, username, password) {
  const uname = String(username ?? '').toLowerCase(), key = `${ip}|${uname}`, f = fails.get(key)
  if (f && f.until > Date.now()) throw Object.assign(new Error('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'), { status: 429 })
  const d = loadUsers(), u = d.users.find((x) => x.username === uname)
  // selalu jalankan hash supaya waktu respons tidak membocorkan apakah username ada
  const match = await verifyPassword(String(password ?? ''), u ? u.hash : 'scrypt$00$00')
  if (!(match && u && !u.disabled)) {
    const n = (f?.n || 0) + 1
    fails.set(key, { n, until: n >= 5 ? Date.now() + 15 * 60_000 : 0 })
    throw Object.assign(new Error('Username atau kata sandi salah.'), { status: 401 })
  }
  fails.delete(key)
  u.lastLoginAt = new Date().toISOString(); saveUsers(d)
  return u
}
