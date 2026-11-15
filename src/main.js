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

// Teammates added here are kept in settings; everyone on the list can pick their name.
async function whoScreen(adding) {
  let team = [];
  try { const { data } = await db.from('settings').select('value').eq('key', 'coaches').maybeSingle(); if (data && Array.isArray(data.value)) team = data.value; } catch (_) {}
  const names = [...new Set(['Harsh', 'Shrutika', ...team])];
  const safe = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  app.innerHTML = shell(`
    <h1>Who's using the portal?</h1><p class="muted">Your changes are logged under this name. You can switch it later.</p>
    ${names.map((n, i) => `<button ${i ? 'class="ghost" ' : ''}data-w="${safe(n)}">${safe(n)}</button>`).join('')}
    ${adding ? `<form id="addMate" class="addmate"><label for="mateName">Teammate's first name</label><input id="mateName" autocomplete="off" maxlength="24" placeholder="e.g. Aditi">
        <p class="err" id="mateErr" role="alert"></p><button type="submit">Add teammate</button><button type="button" class="link" id="mateNo">Cancel</button>
        <p class="muted small">They get the same set-up as Shrutika: their own sheets, Dashboard and place in the team chat.</p></form>`
      : `<button type="button" class="link" id="mateAdd">+ Add teammate</button>`}`);
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { setWho(b.dataset.w); render(); });
  const add = document.getElementById('mateAdd'); if (add) add.onclick = () => whoScreen(true);
  const no = document.getElementById('mateNo'); if (no) no.onclick = () => whoScreen(false);
  const form = document.getElementById('addMate');
  if (form) {
    document.getElementById('mateName').focus();
    form.onsubmit = async e => {
      e.preventDefault();
      const err = document.getElementById('mateErr'), raw = document.getElementById('mateName').value.trim().replace(/\s+/g, ' ');
      const name = raw ? raw[0].toUpperCase() + raw.slice(1) : '';
      if (!/^[A-Za-z][A-Za-z .'-]{1,23}$/.test(name)) { err.textContent = 'Type a first name, letters only.'; return; }
      if (names.some(n => n.toLowerCase() === name.toLowerCase())) { err.textContent = name + ' is already on the team.'; return; }
      const { error } = await db.from('settings').upsert({ key: 'coaches', value: [...team, name] });
      if (error) { err.textContent = 'Could not add: ' + error.message; return; }
      whoScreen(false);
    };
  }
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

// Deferred on purpose: Supabase waits for this callback, and render() itself asks Supabase for data, so running it inline would lock up.
db.auth.onAuthStateChange(() => { setTimeout(render, 0); });
render();
