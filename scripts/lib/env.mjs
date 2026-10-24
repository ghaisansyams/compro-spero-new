// Paths + environment lookup (process env first, then .env.local, then .env).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export function readEnv(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    const m = fs.readFileSync(p, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`, 'm'))
    if (m && m[1]) return m[1].replace(/^['"]|['"]$/g, '')
  }
  return undefined
}
