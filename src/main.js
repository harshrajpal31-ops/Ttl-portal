import { db, getWho, setWho } from './supabase.js';
import { createStore } from './store.js';
import portalHTML from './portal.html?raw';
import './portal.css';
import './hub.css';
import './style.css';

const app = document.getElementById('app');
const shell = (inner, cls = '') => `<div class="auth ${cls}"><div class="card"><div class="auth-logo"><img src="/logo_white.png" alt=""></div>${inner}</div></div>`;

function loginScreen() {
  app.innerHTML = shell(`
    <h1>Coach Portal</h1><p class="muted">Twice the Lean</p>
    <form id="f">
      <label for="e">Email</label><input id="e" type="email" autocomplete="username" required>
      <label for="p">Password</label><input id="p" type="password" autocomplete="current-password" required>
      <button>Log in</button><div class="err" id="err"></div>
    </form>`, 'login');
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault();
    const { error } = await db.auth.signInWithPassword({ email: document.getElementById('e').value.trim(), password: document.getElementById('p').value });
    const err = document.getElementById('err'); // gone already if the login worked
    if (err) err.textContent = !error ? '' : error.message === 'Invalid login credentials' ? 'Wrong email or password.' : 'Login failed: ' + error.message;
  };
}

// Each coach has their own login. Their name is the first word of their email: shrutika@... is Shrutika.
const OWNER = 'Harsh';
const nameOf = email => { const w = String(email || '').split('@')[0].split(/[^A-Za-z]/)[0]; return w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''; };
let LOGIN = '';
// Only the head coach can look at the portal as someone else (for testing and checking). Everyone else goes straight in as themselves.
const whoNow = () => (LOGIN === OWNER && getWho()) || LOGIN;
const picking = () => LOGIN === OWNER && localStorage.getItem('ttl-pick') === '1';

async function whoScreen() {
  let team = [];
  try { const { data } = await db.from('settings').select('value').eq('key', 'coaches').maybeSingle(); if (data && Array.isArray(data.value)) team = data.value; } catch (_) {}
  const names = [...new Set([OWNER, 'Shrutika', ...team])];
  const safe = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  app.innerHTML = shell(`
    <h1>View the portal as</h1><p class="muted">Only you see this screen. Changes are logged under the name you pick.</p>
    ${names.map((n, i) => `<button ${i ? 'class="ghost" ' : ''}data-w="${safe(n)}">${safe(n)}</button>`).join('')}`);
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { setWho(b.dataset.w === OWNER ? '' : b.dataset.w); localStorage.removeItem('ttl-pick'); render(); });
}

let started = false;
async function portal() {
  if (started) return;
  started = true;
  const who = whoNow();
  app.innerHTML = shell(`<h1>Loading clients…</h1><p class="muted">Twice the Lean</p>`);
  const store = createStore(who);
  try { await store.load(); }
  catch (err) {
    started = false;
    app.innerHTML = shell(`<h1>Could not load the portal</h1><p class="muted">${String(err.message || err).replace(/</g, '&lt;')}</p><button id="again">Try again</button>`);
    document.getElementById('again').onclick = () => portal();
    return;
  }
  window.TTL_STORE = store;
  window.TTL_WHO = who;
  document.title = 'Coach Portal';
  app.innerHTML = portalHTML;
  document.getElementById('whoName').textContent = who;
  window.TTL_CAN_SWITCH = LOGIN === OWNER;
  const sw = document.getElementById('whoSwitch');
  if (window.TTL_CAN_SWITCH) sw.onclick = () => { localStorage.setItem('ttl-pick', '1'); location.reload(); };
  else { if (sw.nextSibling && sw.nextSibling.nodeType === 3) sw.nextSibling.remove(); sw.remove(); }
  if (store.coaches && !store.coaches().includes(who)) store.addCoach(who).catch(() => {}); // a new login joins the team lists the first time they open the portal
  document.getElementById('logOut').onclick = async () => { await db.auth.signOut(); location.reload(); };

  // Excel export for the Sheet; the library loads only when someone exports.
  window.TTL_EXPORT = async (tabs, fileName) => {
    const { default: writeExcelFile } = await import('write-excel-file/browser');
    await writeExcelFile(tabs.map(t => ({ sheet: t.sheet, stickyRowsCount: 1, stickyColumnsCount: 1,
      data: [t.header.map(h => ({ value: h, fontWeight: 'bold' })), ...t.rows.map(r => r.map(v => v === '' ? null : v))] }))).toFile(fileName);
  };

  // The portal and the Sheet are the demo's own scripts (public/), loaded in order.
  const load = src => new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.body.appendChild(s); });
  await load('/portal.js');
  await load('/sheet.js');
  store.fireAll();
  await load('/hub.js'); // Home screen + Dashboard, on top of the portal and the Sheet

  // Pick up the other coach's changes when coming back to the tab, and every 5 minutes.
  const refresh = () => { if (document.visibilityState === 'visible') store.reload().catch(() => {}); };
  document.addEventListener('visibilitychange', refresh);
  setInterval(refresh, 5 * 60e3);
}

async function render() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { if (started) location.reload(); return loginScreen(); }
  LOGIN = nameOf(session.user.email);
  if (!LOGIN) { app.innerHTML = shell(`<h1>This login has no name</h1><p class="muted">The email must start with the coach's first name, like shrutika@…</p>`); return; }
  if (picking() && !started) return whoScreen();
  portal();
}

// Deferred on purpose: Supabase waits for this callback, and render() itself asks Supabase for data, so running it inline would lock up.
db.auth.onAuthStateChange(() => { setTimeout(render, 0); });
render();
