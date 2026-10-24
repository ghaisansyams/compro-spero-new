// Spero admin / CMS shell: login, navigation, router.
import { h, st, api, guard, field } from './lib.js'
import { viewPages, viewPortfolio, viewUpdates, viewTeam, viewClients, viewContact } from './views-content.js'
import { viewDashboard, viewMenu, viewSite, viewTheme, viewHistory, viewMedia, viewUsers, viewActivity, viewAccount } from './views-site.js'

const app = document.getElementById('app')
const GROUPS = [
  [null, [['dashboard', 'Dashboard']]],
  ['Konten', [['pages', 'Halaman'], ['portfolio', 'Portofolio'], ['updates', 'Update'], ['team', 'Tim'], ['clients', 'Klien'], ['contact', 'Kontak']]],
  ['Tampilan', [['menu', 'Menu'], ['site', 'Situs & footer'], ['theme', 'Tema']]],
  ['Sistem', [['media', 'Media'], ['history', 'Riwayat versi'], ['users', 'Pengguna', 'admin'], ['activity', 'Aktivitas', 'admin'], ['account', 'Akun saya']]],
]
const VIEWS = { dashboard: viewDashboard, pages: viewPages, portfolio: viewPortfolio, updates: viewUpdates, team: viewTeam, clients: viewClients, contact: viewContact, menu: viewMenu, site: viewSite, theme: viewTheme, history: viewHistory, media: viewMedia, users: viewUsers, activity: viewActivity, account: viewAccount }

st.renderLogin = renderLogin
function renderLogin(msg = '') {
  const err = h('div', { class: 'err', role: 'alert' }, msg), u = h('input', { type: 'text', autocomplete: 'username', required: true, autofocus: true }), p = h('input', { type: 'password', autocomplete: 'current-password', required: true })
  const form = h('form', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = ''
    try { const r = await api('/login', 'POST', { username: u.value.trim(), password: p.value }); st.user = r.user; boot() } catch (x) { err.textContent = x.message; p.value = '' }
  } },
  h('div', { class: 'brand' }, h('img', { src: '/spero-icon.png', alt: '' }), h('div', {}, 'Spero Admin', h('small', {}, 'PT. Spero Mahakarya Nusantara'))),
  h('h1', {}, 'Masuk'), h('p', { class: 'hint', style: 'margin-bottom:18px' }, 'Gunakan akun admin atau editor.'), err,
  field('Username', u), field('Kata sandi', p), h('button', { class: 'btn primary', style: 'width:100%;justify-content:center', type: 'submit' }, 'Masuk'))
  app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'card' }, form)))
}

async function boot() {
  try { st.user = (await api('/me')).user } catch { return renderLogin() }
  try { st.schema = await api('/schema') } catch (e) { app.replaceChildren(h('p', { class: 'boot' }, e.message)); return }
  window.removeEventListener('hashchange', route); window.addEventListener('hashchange', route)
  route()
}
async function route() {
  if (!st.user) return
  const [v, sub = ''] = (location.hash.slice(1) || 'dashboard').split('/')
  st.view = VIEWS[v] ? v : 'dashboard'; st.sub = sub
  const adminOnly = GROUPS.flatMap(([, i]) => i).find(([k]) => k === st.view)?.[2]
  if (adminOnly && st.user.role !== adminOnly) st.view = 'dashboard'
  const main = h('main', { class: 'main' }, h('p', { class: 'boot' }, 'Memuat…'))
  app.replaceChildren(h('div', { class: 'shell' }, sidebar(), main))
  try { main.replaceChildren(...(await VIEWS[st.view](st.sub))) } catch (err) { main.replaceChildren(h('div', { class: 'empty' }, err.message)) }
  window.scrollTo(0, 0)
}
st.route = route
function sidebar() {
  return h('aside', { class: 'side' },
    h('div', { class: 'brand' }, h('img', { src: '/spero-icon.png', alt: '' }), h('div', {}, 'Spero Admin', h('small', {}, 'CMS website'))),
    GROUPS.map(([title, items]) => h('div', { class: 'ngroup' }, title ? h('div', { class: 'ntitle' }, title) : null,
      items.filter(([, , r]) => !r || r === st.user.role).map(([k, label]) => h('button', { class: 'nav', type: 'button', 'aria-current': st.view === k ? 'page' : null, onclick: () => { if (location.hash.slice(1) === k) route(); else location.hash = k } }, label)))),
    h('a', { class: 'nav', href: '/', target: '_blank', rel: 'noopener' }, 'Lihat situs ↗'),
    h('div', { class: 'spacer' }),
    h('div', { class: 'who' }, h('b', {}, st.user.name || st.user.username), st.user.role, ' · ', h('a', { href: '#', onclick: guard(async (e) => { e.preventDefault(); await api('/logout', 'POST', {}); st.user = null; renderLogin() }) }, 'Keluar')))
}
boot()
