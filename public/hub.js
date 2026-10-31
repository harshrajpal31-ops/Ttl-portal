/* Coach Hub: the Home screen with four doors (Hub, Sheet, Dashboard, Portal) and the Dashboard.
   Runs after portal.js and sheet.js and uses their globals (CLIENTS, rk, tagsOf, TAGDEF, openP, XS, esc, toast). */
(function(){
const HUB_URL='https://twicethelean.com/hub';
const WHO=window.TTL_WHO||'';
const app=document.getElementById('app');
const wrap=document.querySelector('main.wrap');
const I={
  hub:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
  sheet:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  dash:'<rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5"/>',
  portal:'<path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19"/><circle cx="10" cy="7.5" r="3.5"/><path d="M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  go:'<path d="m9 6 6 6-6 6"/>',
  back:'<path d="m15 6-6 6 6 6"/>',
  tasks:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'
};
const svg=(p,s=20)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const greet=()=>{const h=+new Date().toLocaleString('en-IN',{hour:'numeric',hour12:false,timeZone:'Asia/Kolkata'});return h<12?'Good morning':h<17?'Good afternoon':'Good evening'};
const today=()=>new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Kolkata'});
const mine=()=>CLIENTS.filter(c=>c.coach===WHO);

/* ---------- Home ---------- */
const home=document.createElement('section');home.className='ttl-home';home.hidden=true;
home.innerHTML=`<div class="th-wrap">
  <header class="th-head"><div class="logo" aria-hidden="true"><img alt="" src="/logo_white.png"></div>
    <div><div class="th-date" id="thDate"></div><h1 id="thHi"></h1></div></header>
  <nav class="th-grid" aria-label="Open">
    <a class="th-tile" href="${HUB_URL}" target="_blank" rel="noopener"><span class="th-ic th-emo" aria-hidden="true">🏠</span><b>Hub <span class="th-ext">${svg(I.ext,15)}</span></b><span class="th-d">Twice the Lean hub</span></a>
    <button class="th-tile" type="button" data-go="sheet"><span class="th-ic th-emo" aria-hidden="true">📊</span><b>Sheet</b><span class="th-d">Check-in, Progress, Dates, Expired</span></button>
    <button class="th-tile" type="button" data-go="dashboard"><span class="th-ic th-emo" aria-hidden="true">📅</span><b>Dashboard</b><span class="th-d">Your day at a glance</span></button>
    <button class="th-tile" type="button" data-go="portal"><span class="th-ic th-emo" aria-hidden="true">🚀</span><b>Portal</b><span class="th-d" id="thCount">Clients and profiles</span></button>
  </nav>
  <p class="th-foot">Using as <b>${esc(WHO)}</b> · <button type="button" class="linkbtn" id="thSwitch">Switch</button> · <button type="button" class="linkbtn" id="thOut">Log out</button></p>
</div>`;
app.appendChild(home);

/* ---------- Dashboard ---------- */
const dash=document.createElement('section');dash.className='ttl-dash';dash.hidden=true;app.appendChild(dash);
let TEAM=false;
function renderDash(){
  if(dash.hidden)return;
  const pool=TEAM?CLIENTS:mine();
  const needs=pool.filter(c=>rk(c)<=2).sort((a,b)=>rk(a)-rk(b)||a.name.localeCompare(b.name));
  const tags=TAGDEF.filter(t=>t.id!=='renew').map(t=>({t,people:pool.filter(c=>tagsOf(c).some(x=>x.id===t.id))}));
  const tagged=tags.filter(x=>x.people.length);
  const person=c=>`<button type="button" class="td-name" data-open="${c.id}"><span class="td-ini">${esc(c.name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</span>${esc(c.name)}${TEAM?`<em>${c.coach==='Shrutika'?'S':'H'}</em>`:''}</button>`;
  dash.innerHTML=`<div class="td-wrap">
  <header class="td-head">
    <button type="button" class="td-back" data-go="home">${svg(I.back,14)}Home</button>
    <div class="td-hi"><div class="th-date">${today()}</div><h1>${greet()}, ${esc(WHO)}</h1></div>
    <div class="seg td-seg" role="group" aria-label="Whose clients"><button type="button" data-team="0" aria-pressed="${!TEAM}">My day</button><button type="button" data-team="1" aria-pressed="${TEAM}">Team</button></div>
  </header>

  <section class="td-card td-soon"><div class="td-h"><h2>${svg(I.tasks,18)} My tasks</h2><span class="td-tag">Connecting next</span></div>
    <p>Your Notion tasks will show here, live: tick them done here and they update in Notion.</p></section>

  <div class="td-row">
    <section class="td-card td-soon td-cal"><div class="td-h"><h2>${svg(I.cal,18)} Calls</h2><span class="td-tag">Connecting next</span></div>
      <p>Today's calls from your calendar, with a full calendar for the next 7 days.</p></section>

    <section class="td-card td-needs"><div class="td-h"><h2>Needs you today <em>${needs.length}</em></h2><button type="button" class="linkbtn" data-go="portal">See all</button></div>
      <p class="td-sub">Master reviews, calls and reviews waiting on ${TEAM?'the team':'you'}. Tap a name for details.</p>
      <div class="td-names">${needs.length?needs.map(person).join(''):'<p class="td-empty">Nobody is waiting on you right now.</p>'}</div></section>
  </div>

  <section class="td-watch"><div class="td-h"><h2>Watch list</h2><span class="td-sub">Clients the tags picked up</span></div>
    ${tagged.length?`<div class="td-tags">${tagged.map(x=>`<div class="td-card td-tg"><div class="td-tgh"><span class="td-dot t-${x.t.tone}"></span><b>${esc(x.t.label)}</b><em>${x.people.length}</em></div><div class="td-names">${x.people.map(person).join('')}</div></div>`).join('')}</div>`
      :`<div class="td-card"><p class="td-empty">No clients tagged right now. Silent, Plateau, Regaining and the other tags fill in once Trainerize weights and weekly check-ins come into the portal.</p></div>`}
  </section>
</div>`;
}

/* ---------- Routing: #home, #portal, #dashboard, #sheet ---------- */
let FROM='home';
function show(r){
  if(r==='sheet'){if(!XOPEN)XS.open();return}
  if(XOPEN)XS.close();
  home.hidden=r!=='home';dash.hidden=r!=='dashboard';wrap.style.display=r==='portal'?'':'none';
  if(r==='home'){document.getElementById('thDate').textContent=today();document.getElementById('thHi').textContent=greet()+', '+WHO;document.getElementById('thCount').textContent=mine().length+' of your clients · '+CLIENTS.length+' in total'}
  if(r==='dashboard')renderDash();
  if(r!=='sheet')FROM=r;
  window.scrollTo(0,0);
}
const route=()=>{const r=(location.hash||'#home').slice(1);show(['home','portal','dashboard','sheet'].includes(r)?r:'home')};
const go=r=>{if(location.hash==='#'+r)route();else location.hash=r};
window.addEventListener('hashchange',route);

// The Sheet's own Back button returns to where it was opened from.
const close0=XS.close.bind(XS);
XS.close=function(){close0();if(location.hash==='#sheet')location.replace('#'+(FROM||'home'))};
// The portal's Sheet button and the Sheet itself keep the address in step.
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-go]');if(g&&!XOPEN){e.preventDefault();go(g.dataset.go);return}
  if(e.target.closest('#openSheet')&&location.hash!=='#sheet')history.pushState(null,'','#sheet');
  if(!dash.hidden){const t=e.target.closest('[data-team]');if(t){TEAM=t.dataset.team==='1';renderDash();return}
    const o=e.target.closest('.td-name');if(o){openP(o.dataset.open);return}}
  if(e.target.id==='thSwitch'||e.target.id==='whoSwitch'){e.stopImmediatePropagation();try{localStorage.setItem('ttl-who','')}catch(_){}location.replace(location.pathname)}
},true);
document.getElementById('thOut').onclick=()=>document.getElementById('logOut').click();

// Home link in the portal header line.
const wl=document.querySelector('.wholine');
if(wl)wl.insertAdjacentHTML('afterbegin','<button type="button" class="linkbtn" data-go="home">← Home</button> · ');

// Re-draw the dashboard when fresh data arrives.
if(window.TTL_STORE)TTL_STORE.collection('edits').onSnapshot(()=>setTimeout(renderDash,0));
route();
})();
