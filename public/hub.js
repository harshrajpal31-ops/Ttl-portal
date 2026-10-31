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

/* ---------- Dashboard ----------
   Tasks and calls come from providers that the Notion and calendar connections will set:
     window.TTL_TASKS = { list: async () => [{id, title, client, status: 'Not started'|'In progress'|'Done', due: 'Today'|'Tomorrow'|'This week'|'Later'}],
                          setDone: async (id, done) => {} }
     window.TTL_CALLS = { list: async (from, days) => [{start: Date|ISO, end: Date|ISO, kind, client}] }
   Without a provider the section shows "Connecting next". */
const dash=document.createElement('section');dash.className='ttl-dash';dash.hidden=true;app.appendChild(dash);
let TEAM=false,TTAB='Today',CALOPEN=false,CALDAY=0,CALANIM=false,TASKS=null,CALLS=null;
const ST_TASK={'Not started':'ns','In progress':'ip','Done':'dn'};
const CALL_KIND={'Check-in call':['ci','Calendly'],'Master check-in':['ms','Master'],'Goal-setting call':['gs','New client'],'Renewal call':['rn','Renewal']};
const DUE=['Today','Tomorrow','This week','Later'];
const istDay=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const tFmt=d=>new Date(d).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}).replace(' ',' ').toLowerCase();
const days7=()=>Array.from({length:7},(_,i)=>{const d=new Date(Date.now()+i*864e5);return{key:istDay(d),dow:d.toLocaleDateString('en-IN',{weekday:'short',timeZone:'Asia/Kolkata'}).toUpperCase(),
  d:d.toLocaleDateString('en-IN',{day:'numeric',timeZone:'Asia/Kolkata'}),long:d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Kolkata'})}});
const CONFETTI='<svg width="120" height="78" viewBox="0 0 120 78" aria-hidden="true"><circle cx="60" cy="44" r="20" fill="#EDF0F9"/><path d="M52 52 60 30l8 22z" fill="#3F59A7"/><path d="M60 30c-2-6 3-10 7-8" fill="none" stroke="#3F59A7" stroke-width="2" stroke-linecap="round"/><rect x="22" y="18" width="7" height="3" rx="1.5" fill="#E0A100" transform="rotate(-30 25 19)"/><rect x="92" y="14" width="7" height="3" rx="1.5" fill="#E0507F" transform="rotate(25 95 15)"/><rect x="14" y="48" width="7" height="3" rx="1.5" fill="#2E9B48" transform="rotate(40 17 49)"/><rect x="100" y="46" width="7" height="3" rx="1.5" fill="#3F8FE0" transform="rotate(-20 103 47)"/><circle cx="40" cy="10" r="2.5" fill="#2E9B48"/><circle cx="82" cy="6" r="2.5" fill="#E5771F"/><circle cx="30" cy="66" r="2.5" fill="#3F59A7"/><circle cx="92" cy="70" r="2.5" fill="#E0A100"/></svg>';
async function loadFeeds(){
  try{if(window.TTL_TASKS)TASKS=await TTL_TASKS.list()}catch(_){TASKS=null}
  try{if(window.TTL_CALLS)CALLS=(await TTL_CALLS.list(new Date(),7)).map(c=>Object.assign({},c,{start:new Date(c.start),end:new Date(c.end)})).sort((a,b)=>a.start-b.start)}catch(_){CALLS=null}
  renderDash();
}
function tasksHTML(){
  if(!window.TTL_TASKS||!TASKS)return `<section class="td-card td-soon"><div class="td-h"><h2>${svg(I.tasks,18)} My tasks</h2><span class="td-tag">Connecting next</span></div><p>Your Notion tasks will show here, live: tick them done here and they update in Notion.</p></section>`;
  const n=k=>TASKS.filter(t=>t.due===k).length,list=TASKS.filter(t=>t.due===TTAB);
  return `<section class="td-card td-tasks"><div class="td-h td-th"><div class="td-tl"><h2>${svg(I.tasks,18)} My tasks</h2><span class="td-sync"><i></i>Synced with Notion</span></div>
    <div class="td-tabs" role="tablist">${DUE.map(k=>`<button type="button" role="tab" data-ttab="${k}" aria-selected="${k===TTAB}">${k} <em>${n(k)}</em></button>`).join('')}</div></div>
    <div class="td-thead"><span></span><span>Task</span><span>Status</span><span>Due</span></div>
    ${list.length?list.map(t=>{const done=t.status==='Done';return `<div class="td-task${done?' done':''}"><button type="button" class="td-chk" data-tdone="${esc(t.id)}" aria-pressed="${done}" aria-label="Mark ${esc(t.title)} done">${done?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>':''}</button>
      <span class="td-tt"><b>${esc(t.title)}</b>${t.client?`<span class="td-tc">${esc(t.client)}</span>`:''}</span><span><span class="td-ts s-${ST_TASK[t.status]||'ns'}"><i></i>${esc(t.status)}</span></span><span class="td-td">${esc(t.due)}</span></div>`}).join('')
      :`<p class="td-empty td-pad">Nothing due ${TTAB==='Later'?'later':TTAB.toLowerCase()}.</p>`}
    <button type="button" class="td-new">+ New task</button></section>`;
}
function callRow(c,big){const k=CALL_KIND[c.kind]||['ci',c.kind||'Call'];
  return big?`<div class="tc-item"><span class="tc-time">${tFmt(c.start)}<em>${Math.round((c.end-c.start)/6e4)} min</em></span><span class="tc-bar k-${k[0]}"></span><span class="tc-main"><b>${esc(c.kind)}</b><span class="tc-cl">${esc(c.client||'')}</span></span><span class="tc-tag k-${k[0]}">${esc(k[1])}</span></div>`
    :`<div class="tc-row"><span class="tc-bar k-${k[0]}"></span><span class="tc-main"><b>${esc(c.kind)} · ${esc(c.client||'')}</b><span>${tFmt(c.start)} – ${tFmt(c.end)}</span></span><span class="tc-tag k-${k[0]}">${esc(k[1])}</span></div>`}
function callsHTML(){
  if(!window.TTL_CALLS||!CALLS)return `<section class="td-card td-soon td-cal"><div class="td-h"><h2>${svg(I.cal,18)} Calls</h2><span class="td-tag">Connecting next</span></div><p>Today's calls from your calendar, with a full calendar for the next 7 days.</p></section>`;
  const D=days7(),on=k=>CALLS.filter(c=>istDay(c.start)===k),td=on(D[0].key),tm=on(D[1].key),sel=D[CALDAY],sc=on(sel.key);
  return `<section class="td-card td-cal tc"><div class="tc-head"><div class="tc-date"><span>${D[0].long.split(',')[0].toUpperCase()}</span><b>${D[0].d}</b></div>
      <div class="tc-acts"><span>${td.length} call${td.length===1?'':'s'}</span><button type="button" class="tc-open" data-calopen>${svg(I.cal,15)} Full calendar</button></div></div>
    ${td.length?`<div class="tc-list">${td.map(c=>callRow(c)).join('')}<div class="tc-pad"></div></div>`:`<div class="tc-none">${CONFETTI}<b>No calls today</b><span>A clear day. Good time to catch up on reviews.</span></div>`}
    <div class="tc-foot"><span>${td.length>3?`${svg('<path d="M12 5v14M6 13l6 6 6-6"/>',12)} Scroll for ${td.length-3} more`:''}</span><span>Tomorrow: ${tm.length?tm.length+' call'+(tm.length===1?'':'s'):'no calls'}</span></div>
    <div class="tc-scrim${CALOPEN&&!CALANIM?' on':''}" data-calclose></div>
    <div class="tc-sheet${CALOPEN&&!CALANIM?' on':''}" role="dialog" aria-modal="true" aria-label="Calendar"><div class="tc-grab"><span></span></div>
      <div class="tc-sh"><div><b>Calls</b><span>Next 7 days</span></div><button type="button" class="tc-x" data-calclose aria-label="Close calendar">${svg('<path d="M6 6l12 12M18 6 6 18"/>',13)}</button></div>
      <div class="tc-days">${D.map((d,i)=>`<button type="button" data-calday="${i}" class="${i===CALDAY?'sel':''}${i===0?' today':''}" aria-label="${d.long}"><span>${d.dow}</span><b>${d.d}</b><i>${on(d.key).slice(0,3).map(()=>'<u></u>').join('')}</i></button>`).join('')}</div>
      <div class="tc-dh"><b>${sel.long}</b><span>${sc.length?sc.length+' call'+(sc.length===1?'':'s'):''}</span></div>
      <div class="tc-dl">${sc.length?sc.map(c=>callRow(c,true)).join(''):`<div class="tc-none">${CONFETTI}<b>No calls this day</b><span>A clear day. Good time to catch up on reviews.</span></div>`}</div></div>
  </section>`;
}
function renderDash(){
  if(dash.hidden)return;
  const pool=TEAM?CLIENTS:mine();
  const needs=pool.filter(c=>rk(c)<=2).sort((a,b)=>rk(a)-rk(b)||a.name.localeCompare(b.name));
  const tags=TAGDEF.filter(t=>t.id!=='renew').map(t=>({t,people:pool.filter(c=>tagsOf(c).some(x=>x.id===t.id))}));
  const tagged=tags.filter(x=>x.people.length);
  const person=c=>`<button type="button" class="td-name" data-open="${c.id}"><span class="td-ini">${esc(c.name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</span>${esc(c.name)}${TEAM?`<em>${c.coach==='Shrutika'?'S':'H'}</em>`:''}</button>`;
  dash.innerHTML=`<div class="td-wrap">
  <button type="button" class="td-back" data-go="home">${svg(I.back,14)}Home</button>
  <header class="td-head">
    <div class="td-hi"><div class="th-date">${today()}</div><h1>${greet()}, ${esc(WHO)}</h1></div>
    <div class="seg td-seg" role="group" aria-label="Whose clients"><button type="button" data-team="0" aria-pressed="${!TEAM}">My day</button><button type="button" data-team="1" aria-pressed="${TEAM}">Team</button></div>
  </header>
  ${tasksHTML()}
  <div class="td-row">
    ${callsHTML()}
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
dash.addEventListener('click',e=>{
  const tb=e.target.closest('[data-ttab]');if(tb){TTAB=tb.dataset.ttab;renderDash();return}
  const ck=e.target.closest('[data-tdone]');if(ck&&TASKS){const t=TASKS.find(x=>String(x.id)===ck.dataset.tdone);if(!t)return;const was=t.status;t.status=was==='Done'?'Not started':'Done';renderDash();
    Promise.resolve(window.TTL_TASKS&&TTL_TASKS.setDone&&TTL_TASKS.setDone(t.id,t.status==='Done')).catch(()=>{t.status=was;renderDash();toast('Could not update Notion. Try again.')});return}
  // The calendar sheet slides up from the bottom and back down (class toggled after render so it animates).
  if(e.target.closest('[data-calopen]')){CALOPEN=true;CALDAY=0;CALANIM=true;renderDash();CALANIM=false;requestAnimationFrame(()=>requestAnimationFrame(()=>dash.querySelectorAll('.tc-sheet,.tc-scrim').forEach(x=>x.classList.add('on'))));return}
  if(e.target.closest('[data-calclose]')){dash.querySelectorAll('.tc-sheet,.tc-scrim').forEach(x=>x.classList.remove('on'));setTimeout(()=>{CALOPEN=false;renderDash()},380);return}
  const cd=e.target.closest('[data-calday]');if(cd){CALDAY=+cd.dataset.calday;renderDash();return}
  if(e.target.closest('.td-new')){toast('New tasks are added in Notion for now.');return}
});

/* ---------- Routing: #home, #portal, #dashboard, #sheet ---------- */
let FROM='home';
function show(r){
  if(r==='sheet'){if(!XOPEN)XS.open();return}
  if(XOPEN)XS.close();
  home.hidden=r!=='home';dash.hidden=r!=='dashboard';wrap.style.display=r==='portal'?'':'none';
  if(r==='home'){document.getElementById('thDate').textContent=today();document.getElementById('thHi').textContent=greet()+', '+WHO;document.getElementById('thCount').textContent=mine().length+' of your clients · '+CLIENTS.length+' in total'}
  if(r==='dashboard'){renderDash();loadFeeds()}
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
