import { db, getWho, setWho } from './supabase.js';

const app = document.getElementById('app');
const shell = inner => `<div class="center"><div class="card"><div class="logo"><img src="/logo_white.png" alt=""></div>${inner}</div></div>`;

function loginScreen() {
  app.innerHTML = shell(`
    <h1>Coach Portal</h1><p class="muted">Twice the Lean</p>
    <form id="f">
      <label for="e">Email</label><input id="e" type="email" autocomplete="username" required>
      <label for="p">Password</label><input id="p" type="password" autocomplete="current-password" required>
      <button>Log in</button><div class="err" id="err"></div>
    </form>`);
  document.getElementById('f').onsubmit = async ev => {
    ev.preventDefault();
    const { error } = await db.auth.signInWithPassword({ email: document.getElementById('e').value.trim(), password: document.getElementById('p').value });
    document.getElementById('err').textContent = error ? 'Wrong email or password.' : '';
  };
}

function whoScreen() {
  app.innerHTML = shell(`
    <h1>Who's using the portal?</h1><p class="muted">Your changes are logged under this name. You can switch it later.</p>
    <button data-w="Harsh">Harsh</button><button class="ghost" data-w="Shrutika">Shrutika</button>`);
  app.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { setWho(b.dataset.w); render(); });
}

async function portal() {
  // Step 3 ports the demo portal here. For now: prove the database connection.
  const { count, error } = await db.from('clients').select('*', { count: 'exact', head: true }).is('expired_at', null);
  app.innerHTML = shell(`
    <h1>Hi ${getWho()}</h1>
    <p class="muted">${error ? 'Database error: ' + error.message : count + ' active clients in the database.'}</p>
    <button class="ghost" id="sw">Switch person</button><button class="ghost" id="out">Log out</button>`);
  document.getElementById('sw').onclick = () => { setWho(''); render(); };
  document.getElementById('out').onclick = () => db.auth.signOut();
}

async function render() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return loginScreen();
  if (!getWho()) return whoScreen();
  portal();
}

db.auth.onAuthStateChange(() => render());
render();
