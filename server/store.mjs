// Activity log + media library.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { ROOT } from '../scripts/lib/env.mjs'
import { insertActivity, recentActivity } from '../scripts/lib/db.mjs'

export async function logActivity(user, action, target = '', detail = '') {
  try { await insertActivity({ user: user?.username || '-', action, target: String(target).slice(0, 200), detail: String(detail).slice(0, 300) }) }
  catch (e) { console.error('[activity]', e.message) }   // a log failure must never break the request
}
export const readActivity = (limit = 100) => recentActivity(limit)

export const MEDIA_DIR = path.join(ROOT, 'images/uploads')
const MAX = 5 * 1024 * 1024
function sniff(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp'
  return null
}
export function saveUpload(base64) {
  const buf = Buffer.from(String(base64 || '').replace(/^data:[^,]*,/, ''), 'base64')
  if (!buf.length) throw new Error('File kosong.')
  if (buf.length > MAX) throw new Error('Ukuran maksimal 5 MB.')
  const ext = sniff(buf)
  if (!ext) throw new Error('Hanya gambar JPG, PNG, atau WebP.')    // SVG sengaja ditolak (bisa membawa skrip)
  fs.mkdirSync(MEDIA_DIR, { recursive: true })
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.${ext}`
  fs.writeFileSync(path.join(MEDIA_DIR, name), buf)
  return { name, url: `/images/uploads/${name}`, size: buf.length }
}
export function listMedia() {
  if (!fs.existsSync(MEDIA_DIR)) return []
  return fs.readdirSync(MEDIA_DIR).filter((f) => /^[\w-]+\.(jpg|png|webp)$/.test(f)).map((f) => {
    const s = fs.statSync(path.join(MEDIA_DIR, f))
    return { name: f, url: `/images/uploads/${f}`, size: s.size, mtime: s.mtime.toISOString() }
  }).sort((a, b) => b.mtime.localeCompare(a.mtime))
}
export function deleteMedia(name) {
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(name)) throw new Error('Nama file tidak valid.')
  const f = path.join(MEDIA_DIR, name)
  if (!fs.existsSync(f)) throw new Error('File tidak ditemukan.')
  fs.unlinkSync(f)
}
