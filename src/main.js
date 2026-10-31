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

function whoScreen() {
  app.innerHTML = shell(`
    <h1>Who's using the portal?</h1><p class="muted">Your changes are logged under this name. You can switch it later.</p>
    <button data-w="Harsh">Harsh</button><button class="ghost" data-w="Shrutika">Shrutika</button>`);
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { setWho(b.dataset.w); render(); });
}

let started = false;
async function portal() {
  if (started) return;
  started = true;
  const who = getWho();
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
  document.getElementById('whoSwitch').onclick = () => { setWho(''); location.reload(); };
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
  if (!getWho()) return whoScreen();
  portal();
}

db.auth.onAuthStateChange(() => render());
render();
