#!/usr/bin/env node
// Pull the latest posts of an Instagram account through Apify's "Instagram Scraper"
// (apify/instagram-scraper) and write them to data/instagram.json for the /update page.
//
//   APIFY_TOKEN=apify_api_xxx node scripts/fetch-instagram.mjs
//   node scripts/fetch-instagram.mjs --user spero_id --limit 12
//   node scripts/fetch-instagram.mjs --from dataset.json      # re-use an exported dataset, no API call
//
// The token is read from the APIFY_TOKEN environment variable or from a .env.local file
// (git-ignored). It is only ever used here, never in the browser.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const user = arg('user', 'spero_id')
const limit = Number(arg('limit', 12))
const from = arg('from', null)

async function loadToken() {
  if (process.env.APIFY_TOKEN) return process.env.APIFY_TOKEN
  const f = path.join(root, '.env.local')
  if (existsSync(f)) {
    const m = (await readFile(f, 'utf8')).match(/^\s*APIFY_TOKEN\s*=\s*(.+?)\s*$/m)
    if (m) return m[1].replace(/^['"]|['"]$/g, '')
  }
  return null
}

async function fetchDataset() {
  if (from) return JSON.parse(await readFile(path.resolve(from), 'utf8'))
  const token = await loadToken()
  if (!token) {
    console.error('Missing APIFY_TOKEN. Put it in the environment or in .env.local (APIFY_TOKEN=apify_api_...).')
    process.exit(1)
  }
  console.log(`Running apify/instagram-scraper for @${user} (limit ${limit})… this can take a minute.`)
  const res = await fetch(
    'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?timeout=280',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${user}/`],
        resultsType: 'posts',
        resultsLimit: limit,
        addParentData: false,
      }),
    },
  )
  if (!res.ok) {
    console.error(`Apify returned HTTP ${res.status}:`, (await res.text()).slice(0, 400))
    process.exit(1)
  }
  return res.json()
}

async function saveImage(url, code) {
  // Instagram CDN links expire and block hotlinking, so keep a local copy.
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const type = r.headers.get('content-type') || ''
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('svg') ? 'svg' : 'jpg'
    await mkdir(path.join(root, 'images/instagram'), { recursive: true })
    await writeFile(path.join(root, `images/instagram/${code}.${ext}`), Buffer.from(await r.arrayBuffer()))
    return `/images/instagram/${code}.${ext}`
  } catch (e) {
    console.warn(`  image for ${code} not saved (${e.message})`)
    return null
  }
}

const raw = await fetchDataset()
const items = (Array.isArray(raw) ? raw : []).filter((i) => i && i.shortCode && !i.error)
if (!items.length) {
  console.error('No posts in the dataset. Is the account public, and is the Actor input correct?')
  console.error(JSON.stringify(raw).slice(0, 300))
  process.exit(1)
}
items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

const posts = []
for (const p of items.slice(0, limit)) {
  const image = p.displayUrl ? await saveImage(p.displayUrl, p.shortCode) : null
  posts.push({
    id: String(p.id ?? p.shortCode),
    shortCode: p.shortCode,
    url: p.url || `https://www.instagram.com/p/${p.shortCode}/`,
    type: p.type || 'Image', // Image | Video | Sidecar
    caption: p.caption || '',
    image: image || p.displayUrl || '/images/placeholder.svg',
    likes: p.likesCount ?? null,
    comments: p.commentsCount ?? null,
    timestamp: p.timestamp || null,
  })
}

await mkdir(path.join(root, 'data'), { recursive: true })
await writeFile(
  path.join(root, 'data/instagram.json'),
  JSON.stringify({ account: user, profileUrl: `https://www.instagram.com/${user}/`, updatedAt: new Date().toISOString(), sample: false, posts }, null, 2) + '\n',
)
console.log(`Saved ${posts.length} posts to data/instagram.json`)
