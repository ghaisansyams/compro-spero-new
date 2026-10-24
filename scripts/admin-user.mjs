#!/usr/bin/env node
// Kelola akun admin dari terminal.
//   node scripts/admin-user.mjs add <username> [--role admin|editor] [--name "Nama"] [--generate]
//   node scripts/admin-user.mjs passwd <username> [--generate]
//   node scripts/admin-user.mjs list
import crypto from 'node:crypto'
import readline from 'node:readline'
import { loadUsers, createUser, setPassword, publicUser } from '../server/auth.mjs'
import { init, flush, close } from './lib/db.mjs'

const [cmd, username] = process.argv.slice(2)
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d }
const gen = process.argv.includes('--generate')

function ask(q) {   // tanpa echo, supaya kata sandi tidak terlihat / tidak masuk riwayat shell
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); else if (s.includes('\n')) process.stdout.write('\n') }
    rl.question(q, (a) => { rl.close(); resolve(a) })
  })
}
async function password() {
  if (gen) return crypto.randomBytes(12).toString('base64url')
  const a = await ask('Kata sandi (min. 10 karakter): '), b = await ask('Ulangi: ')
  if (a !== b) { console.error('Tidak sama.'); process.exit(1) }
  return a
}
try {
  await init()
  if (cmd === 'list') { for (const u of loadUsers().users.map(publicUser)) console.log(`${u.username}\t${u.role}\t${u.disabled ? 'nonaktif' : 'aktif'}`) }
  else if (cmd === 'add' && username) {
    const pw = await password()
    const u = await createUser({ username: username.toLowerCase(), name: arg('name', username), role: arg('role', 'admin'), password: pw })
    console.log(`Akun "${u.username}" (${u.role}) dibuat.`); if (gen) console.log(`Kata sandi sementara (tampil sekali): ${pw}`)
  } else if (cmd === 'passwd' && username) {
    const u = loadUsers().users.find((x) => x.username === username.toLowerCase())
    if (!u) throw new Error('Pengguna tidak ditemukan.')
    const pw = await password(); await setPassword(u.id, pw)
    console.log('Kata sandi diganti; semua sesi lama dicabut.'); if (gen) console.log(`Kata sandi baru (tampil sekali): ${pw}`)
  } else { console.error('Pemakaian: add <username> | passwd <username> | list'); await close(); process.exit(1) }
  await flush(); await close()
} catch (err) { console.error(err.message); await close().catch(() => {}); process.exit(1) }
