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
     window.TTL_TASKS = { list: async (coach) => [{id, title, client, status: 'Not started'|'In progress'|'Done', due: one of Notion's Due Date options}],
                          setDone: async (id, done) => {} }
     window.TTL_CALLS = { list: async (from, days, coach) => [{start: Date|ISO, end: Date|ISO, kind, client}] }
   Without a provider the section shows "Connecting next". */
const dash=document.createElement('section');dash.className='ttl-dash';dash.hidden=true;app.appendChild(dash);
// Due values are the Notion "Due Date" options, as they are in the Daily Tasks database.
const DUE=['Today','Tomorrow','Later This week','Next week','Undecided'];
// Only the head coach gets the Team view; every other coach sees just their own day.
// VIEW is whose day is on screen: the coach using the portal, or (head coach only) a team member picked under Team.
const OWNER='Harsh',IS_OWNER=WHO===OWNER;
let VIEW=WHO;
const team=()=>[...new Set(CLIENTS.map(c=>c.coach))].filter(c=>c&&c!==WHO).sort();
const TEAM_ON=()=>VIEW!==WHO;
const whose=()=>TEAM_ON()?VIEW+"'s":'My';
let TTAB='Today',POP=null,POPNEW=false,CALDAY=0,TASKS=null,CALLS=null,SYNCED=null;
const ST_TASK={'Not started':'ns','In progress':'ip','Done':'dn'};
const CALL_KIND={'Check-in call':['ci','Calendly'],'Master check-in':['ms','Master'],'Goal-setting call':['gs','New client'],'Renewal call':['rn','Renewal']};
const istDay=d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const tFmt=d=>new Date(d).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}).replace(' ',' ').toLowerCase();
const days7=()=>Array.from({length:7},(_,i)=>{const d=new Date(Date.now()+i*864e5);return{key:istDay(d),dow:d.toLocaleDateString('en-IN',{weekday:'short',timeZone:'Asia/Kolkata'}).toUpperCase(),
  d:d.toLocaleDateString('en-IN',{day:'numeric',timeZone:'Asia/Kolkata'}),long:d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Kolkata'})}});
const CONFETTI='<svg width="120" height="78" viewBox="0 0 120 78" aria-hidden="true"><circle cx="60" cy="44" r="20" fill="#EDF0F9"/><path d="M52 52 60 30l8 22z" fill="#3F59A7"/><path d="M60 30c-2-6 3-10 7-8" fill="none" stroke="#3F59A7" stroke-width="2" stroke-linecap="round"/><rect x="22" y="18" width="7" height="3" rx="1.5" fill="#E0A100" transform="rotate(-30 25 19)"/><rect x="92" y="14" width="7" height="3" rx="1.5" fill="#E0507F" transform="rotate(25 95 15)"/><rect x="14" y="48" width="7" height="3" rx="1.5" fill="#2E9B48" transform="rotate(40 17 49)"/><rect x="100" y="46" width="7" height="3" rx="1.5" fill="#3F8FE0" transform="rotate(-20 103 47)"/><circle cx="40" cy="10" r="2.5" fill="#2E9B48"/><circle cx="82" cy="6" r="2.5" fill="#E5771F"/><circle cx="30" cy="66" r="2.5" fill="#3F59A7"/><circle cx="92" cy="70" r="2.5" fill="#E0A100"/></svg>';
const X_IC='<path d="M6 6l12 12M18 6 6 18"/>',EXP_IC='<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>';
const expandBtn=(k,label)=>`<button type="button" class="td-exp" data-pop="${k}" aria-label="Open ${label} larger">${svg(EXP_IC,15)}</button>`;
// Test version only (the screen-changes branch link): sample tasks and calls so the Dashboard can be clicked through
// before Notion and the calendar are connected. Never runs on the live portal.
const SAMPLE=/^screen-changes--/.test(location.hostname);
if(SAMPLE&&!window.TTL_TASKS){
  const names=()=>CLIENTS.filter(c=>c.coach===VIEW).slice(0,8).map(c=>c.name),T=(i,what,status,due)=>({id:i,title:(names()[i%Math.max(names().length,1)]||'Client')+' – '+what,status,due});
  const mem={};
  window.TTL_TASKS={list:async coach=>mem[coach]||(mem[coach]=[T(0,'Send revised meal plan','In progress','Today'),T(1,'Record Loom for Plan of Action','Not started','Today'),T(2,'Review progress photos','Not started','Today'),
    T(3,'Update Trainerize programme','Done','Today'),T(4,'Swap leg day exercises','Not started','Today'),T(5,'Check blood report','Not started','Today'),
    T(6,'Prepare Accelerator pitch','Not started','Tomorrow'),T(7,'Refeed week plan','Not started','Tomorrow'),T(0,'Renewal call notes','Not started','Later This week'),T(1,'Ask for blood reports','Not started','Next week')].map((t,i)=>Object.assign(t,{id:i}))),
    setDone:async()=>{}};
  const at=(d,h,m,min)=>{const s=new Date();s.setDate(s.getDate()+d);s.setHours(h,m,0,0);return{start:s,end:new Date(s.getTime()+min*6e4)}},C=(d,h,m,min,kind,i)=>Object.assign(at(d,h,m,min),{kind,client:names()[i%Math.max(names().length,1)]||'Client'});
  window.TTL_CALLS={list:async()=>[C(0,9,30,30,'Check-in call',0),C(0,11,0,45,'Master check-in',1),C(0,13,0,30,'Renewal call',2),C(0,16,0,30,'Check-in call',3),C(0,17,30,45,'Goal-setting call',4),
    C(2,10,0,30,'Check-in call',5),C(2,15,0,45,'Master check-in',6),C(3,11,0,45,'Goal-setting call',7),C(4,9,0,30,'Check-in call',0),C(5,12,0,45,'Master check-in',1)]};
}
async function loadFeeds(){
  try{if(window.TTL_TASKS){TASKS=await TTL_TASKS.list(VIEW);SYNCED=new Date()}}catch(_){TASKS=null}
  try{if(window.TTL_CALLS)CALLS=(await TTL_CALLS.list(new Date(),7,VIEW)).map(c=>Object.assign({},c,{start:new Date(c.start),end:new Date(c.end)})).sort((a,b)=>a.start-b.start)}catch(_){CALLS=null}
  renderDash();
}
// A Notion task is one line: "Client – what to do". If a separate client comes through, it goes in front, never underneath.
const taskTitle=t=>t.client&&!String(t.title).toLowerCase().startsWith(String(t.client).toLowerCase())?t.client+' – '+t.title:t.title;
function tasksInner(){
  const n=k=>TASKS.filter(t=>t.due===k).length,list=TASKS.filter(t=>t.due===TTAB);
  return `<div class="td-tabs" role="tablist">${DUE.map(k=>`<button type="button" role="tab" data-ttab="${k}" aria-selected="${k===TTAB}">${k} <em>${n(k)}</em></button>`).join('')}</div>
    <div class="td-thead"><span></span><span>Task</span><span>Status</span><span>Due</span></div>
    <div class="td-tlist">${list.length?list.map(t=>{const done=t.status==='Done';return `<div class="td-task${done?' done':''}"><button type="button" class="td-chk" data-tdone="${esc(t.id)}" aria-pressed="${done}" aria-label="Mark done: ${esc(taskTitle(t))}">${done?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>':''}</button>
      <span class="td-tt"><b>${esc(taskTitle(t))}</b></span><span><span class="td-ts s-${ST_TASK[t.status]||'ns'}"><i></i>${esc(t.status)}</span></span><span class="td-td">${esc(t.due)}</span></div>`}).join('')
      :`<p class="td-empty td-pad">Nothing under ${esc(TTAB)}.</p>`}</div>`;
}
const syncLine=()=>`<span class="td-sync"><i></i>${SAMPLE?'Sample tasks for testing, not from Notion':'Synced with Notion'+(SYNCED?' at '+tFmt(SYNCED):'')}</span>`;
function tasksHTML(){
  if(!window.TTL_TASKS||!TASKS)return `<section class="td-card td-soon"><div class="td-h"><h2>${svg(I.tasks,18)} My tasks</h2><span class="td-tag">Connecting next</span></div><p>Your Notion tasks will show here, live: tick them done here and they update in Notion.</p></section>`;
  return `<section class="td-card td-tasks" data-pop="tasks"><div class="td-h td-th"><div class="td-tl"><h2>${svg(I.tasks,18)} ${esc(whose())} tasks</h2>${syncLine()}</div>${expandBtn('tasks','tasks')}</div>
    ${tasksInner()}<button type="button" class="td-new">+ New task</button></section>`;
}
function callRow(c,big){const k=CALL_KIND[c.kind]||['ci',c.kind||'Call'];
  return big?`<div class="tc-item"><span class="tc-time">${tFmt(c.start)}<em>${Math.round((c.end-c.start)/6e4)} min</em></span><span class="tc-bar k-${k[0]}"></span><span class="tc-main"><b>${esc(c.kind)}</b><span class="tc-cl">${esc(c.client||'')}</span></span><span class="tc-tag k-${k[0]}">${esc(k[1])}</span></div>`
    :`<div class="tc-row"><span class="tc-bar k-${k[0]}"></span><span class="tc-main"><b>${esc(c.kind)} · ${esc(c.client||'')}</b><span>${tFmt(c.start)} – ${tFmt(c.end)}</span></span><span class="tc-tag k-${k[0]}">${esc(k[1])}</span></div>`}
function callsHTML(){
  if(!window.TTL_CALLS||!CALLS)return `<section class="td-card td-soon td-cal"><div class="td-h"><h2>${svg(I.cal,18)} Calls</h2><span class="td-tag">Connecting next</span></div><p>Today's calls from your calendar, with a full calendar for the next 7 days.</p></section>`;
  const D=days7(),on=k=>CALLS.filter(c=>istDay(c.start)===k),td=on(D[0].key),tm=on(D[1].key);
  return `<section class="td-card td-cal tc" data-pop="calls"><div class="tc-head"><div class="tc-date"><span>${D[0].long.split(',')[0].toUpperCase()}</span><b>${D[0].d}</b></div>
      <div class="tc-acts"><span>${TEAM_ON()?esc(VIEW)+' · ':''}${td.length} call${td.length===1?'':'s'}</span><button type="button" class="tc-open" data-pop="calls">${svg(I.cal,15)} Full calendar</button></div></div>
    ${td.length?`<div class="tc-list">${td.map(c=>callRow(c)).join('')}<div class="tc-pad"></div></div>`:`<div class="tc-none">${CONFETTI}<b>No calls today</b><span>A clear day. Good time to catch up on reviews.</span></div>`}
    <div class="tc-foot"><span>${td.length>3?`${svg('<path d="M12 5v14M6 13l6 6 6-6"/>',12)} Scroll for ${td.length-3} more`:''}</span><span>Tomorrow: ${tm.length?tm.length+' call'+(tm.length===1?'':'s'):'no calls'}</span></div>
  </section>`;
}
function calendarInner(){
  const D=days7(),on=k=>CALLS.filter(c=>istDay(c.start)===k),sel=D[CALDAY],sc=on(sel.key);
  return `<div class="tc-days">${D.map((d,i)=>`<button type="button" data-calday="${i}" class="${i===CALDAY?'sel':''}${i===0?' today':''}" aria-label="${d.long}"><span>${d.dow}</span><b>${d.d}</b><i>${on(d.key).slice(0,3).map(()=>'<u></u>').join('')}</i></button>`).join('')}</div>
    <div class="tc-dh"><b>${sel.long}</b><span>${sc.length?sc.length+' call'+(sc.length===1?'':'s'):''}</span></div>
    <div class="tc-dl">${sc.length?sc.map(c=>callRow(c,true)).join(''):`<div class="tc-none">${CONFETTI}<b>No calls this day</b><span>A clear day. Good time to catch up on reviews.</span></div>`}</div>`;
}
function dashData(){
  const pool=CLIENTS.filter(c=>c.coach===VIEW);
  const needs=pool.filter(c=>rk(c)<=2).sort((a,b)=>rk(a)-rk(b)||a.name.localeCompare(b.name));
  const tagged=TAGDEF.filter(t=>t.id!=='renew').map(t=>({t,people:pool.map(c=>({c,tag:tagsOf(c).find(x=>x.id===t.id)})).filter(x=>x.tag)})).filter(x=>x.people.length);
  // Head coach only: who is at Accountability Call (Master Support for other coaches) or above now, and who was there earlier in this phase.
  const lpool=IS_OWNER&&!TEAM_ON()?CLIENTS:pool; // head coach sees everyone; every other coach sees only their own clients
  const esc2=lpool.map(c=>({c,L:ladderOf(c)}));
  const hot=esc2.filter(x=>x.L.now>=L_HOT).sort((a,b)=>b.L.now-a.L.now||a.c.name.localeCompare(b.c.name));
  const was=esc2.filter(x=>x.L.now<L_HOT&&x.L.peak>=L_HOT).sort((a,b)=>a.c.name.localeCompare(b.c.name));
  return {needs,tagged,hot,was};
}
const ladRow=(x,past)=>`<button type="button" class="td-prow" data-open="${x.c.id}"><span class="td-ini">${ini(x.c)}</span><span class="td-pn"><b>${esc(x.c.name)}</b><span>Coach ${esc(x.c.coach)}${x.c.week?' · Week '+x.c.week:''}${x.L.times>1?' · escalated '+x.L.times+' times':''}</span></span><span class="td-pst l${past?x.L.peak:x.L.now}">${past?'Was '+LN(x.c)[x.L.peak]:LN(x.c)[x.L.now]}</span>${past&&x.L.now>=0?`<span class="td-pst alt">Now ${LN(x.c)[x.L.now]}</span>`:''}</button>`;
const ladTable=(rows,past)=>`<div class="td-lt${past?' past':''}" role="table"><div class="td-ltr td-lth" role="row"><span role="columnheader">Name</span><span role="columnheader">Action</span><span role="columnheader">Coach</span></div>
  ${rows.map(x=>`<button type="button" class="td-ltr" role="row" data-open="${x.c.id}"><span class="td-ltn" role="cell"><span class="td-ini">${ini(x.c)}</span><b>${esc(x.c.name)}</b></span><span role="cell"><i class="td-lv l${past?x.L.peak:x.L.now}">${past?'Was '+LN(x.c)[x.L.peak]:LN(x.c)[x.L.now]}</i>${past&&x.L.now>=0?`<em>Now ${LN(x.c)[x.L.now]}</em>`:''}</span><span class="td-ltc" role="cell">${esc(x.c.coach)}</span></button>`).join('')}</div>`;
function ladderHTML(){const {hot,was}=dashData();
  return `<section class="td-card td-lad" data-pop="ladder"><div class="td-h"><h2>Escalations <em>${hot.length}</em></h2>${expandBtn('ladder','Escalations')}</div>
    <p class="td-sub">${TEAM_ON()?esc(VIEW)+"'s clients":IS_OWNER?'All clients':'Your clients'} at Accountability Call (Master Support for other coaches) or above. Tap a row for the history.</p>
    ${hot.length?`<div class="td-scroll td-ltwrap">${ladTable(hot)}</div>`:'<p class="td-empty">Nobody is at this level right now.</p>'}
    ${was.length?`<p class="td-sub td-was">Earlier this phase: ${was.length} client${was.length===1?'':'s'} reached this level and came back down. Expand to see them.</p>`:''}</section>`}
const ini=c=>esc(c.name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase());
const person=c=>`<button type="button" class="td-name" data-open="${c.id}"><span class="td-ini">${ini(c)}</span>${esc(c.name)}</button>`;
// Centre pop-up: one section opened large, clear of every edge of the screen.
function popHTML(){
  if(!POP)return '';
  const {needs,tagged}=dashData();let title='',sub='',body='';
  if(POP==='tasks'&&TASKS){title=esc(whose())+' tasks';sub=syncLine();body=`<div class="td-tasks td-inpop">${tasksInner()}<button type="button" class="td-new">+ New task</button></div>`}
  else if(POP==='calls'&&CALLS){title='Calls';sub='<span class="td-sub">Next 7 days</span>';body=calendarInner()}
  else if(POP==='needs'){title=`${TEAM_ON()?'Needs '+esc(VIEW):'Needs you'} today <em>${needs.length}</em>`;sub=`<span class="td-sub">Waiting on ${TEAM_ON()?esc(VIEW):'you'}. Tap a row to open the client.</span>`;
    body=needs.length?`<div class="td-plist">${needs.map(c=>`<button type="button" class="td-prow" data-open="${c.id}"><span class="td-ini">${ini(c)}</span><span class="td-pn"><b>${esc(c.name)}</b><span>Coach ${esc(c.coach)}${c.week?' · Week '+c.week:''}</span></span><span class="td-pst">${esc(c.comp)}</span>${c.sheet&&c.sheet.ciAction?`<span class="td-pst alt">${esc(c.sheet.ciAction)}</span>`:''}</button>`).join('')}</div>`:'<p class="td-empty td-pad">Nobody is waiting on you right now.</p>'}
  else if(POP==='watch'){title='Watch list';sub='<span class="td-sub">Clients the tags picked up, with the reason</span>';
    body=tagged.length?tagged.map(x=>`<div class="td-pgrp"><div class="td-tgh"><span class="td-dot t-${x.t.tone}"></span><b>${esc(x.t.label)}</b><em>${x.people.length}</em></div><div class="td-plist">${x.people.map(({c,tag})=>`<button type="button" class="td-prow" data-open="${c.id}"><span class="td-ini">${ini(c)}</span><span class="td-pn"><b>${esc(c.name)}</b><span>${esc(tag.why||'')}</span></span></button>`).join('')}</div></div>`).join(''):'<p class="td-empty td-pad">No clients tagged right now.</p>'}
  else if(POP==='ladder'){const {hot,was}=dashData();title=`Escalations <em>${hot.length}</em>`;sub='<span class="td-sub">Accountability Call / Master Support and above, with who was there earlier in this phase</span>';
    body=(hot.length?`<div class="td-pgrp"><div class="td-tgh"><span class="td-dot t-red"></span><b>Now</b><em>${hot.length}</em></div><div class="td-ltpad">${ladTable(hot)}</div></div>`:'<p class="td-empty td-pad">Nobody is at this level right now.</p>')
      +(was.length?`<div class="td-pgrp"><div class="td-tgh"><span class="td-dot t-amber"></span><b>Earlier this phase</b><em>${was.length}</em></div><div class="td-ltpad">${ladTable(was,true)}</div></div>`:'')}
  else return '';
  return `<div class="td-scrim" data-popclose></div><div class="td-pop${POPNEW?' in':''}" role="dialog" aria-modal="true" aria-label="${title.replace(/<[^>]+>/g,'')}">
    <div class="td-poph"><div><h2>${title}</h2>${sub}</div><button type="button" class="tc-x" data-popclose aria-label="Close">${svg(X_IC,13)}</button></div><div class="td-popb">${body}</div></div>`;
}
function renderDash(){
  if(dash.hidden)return;
  const keep=[...dash.querySelectorAll('[data-keep]')].map(e=>[e.dataset.keep,e.scrollTop]);
  const {needs,tagged}=dashData();
  dash.innerHTML=`<div class="td-wrap">
  <button type="button" class="td-back" data-go="home">${svg(I.back,14)}Home</button>
  <header class="td-head">
    <div class="td-hi"><div class="th-date">${today()}</div><h1>${greet()}, ${esc(WHO)}</h1></div>
    ${IS_OWNER&&team().length?`<div class="seg td-seg" role="group" aria-label="Whose day"><button type="button" data-team="0" aria-pressed="${!TEAM_ON()}">My day</button><button type="button" data-team="1" aria-pressed="${TEAM_ON()}">Team</button></div>`:''}
  </header>
  ${TEAM_ON()?`<div class="td-team" role="group" aria-label="Team member"><span class="td-sub">Viewing</span>${team().map(n=>`<button type="button" class="td-coach" data-coach="${esc(n)}" aria-pressed="${n===VIEW}"><span class="td-ini">${esc(n[0])}</span>${esc(n)}<em>${CLIENTS.filter(c=>c.coach===n).length} clients</em></button>`).join('')}</div>`:''}
  ${tasksHTML()}
  ${ladderHTML()}
  <div class="td-row">
    ${callsHTML()}
    <section class="td-card td-needs" data-pop="needs"><div class="td-h"><h2>${TEAM_ON()?'Needs '+esc(VIEW):'Needs you'} today <em>${needs.length}</em></h2>${expandBtn('needs','Needs you today')}</div>
      <p class="td-sub">Master reviews, calls and reviews waiting on ${TEAM_ON()?esc(VIEW):'you'}. Tap a name for details.</p>
      <div class="td-names td-scroll">${needs.length?needs.map(person).join(''):'<p class="td-empty">Nobody is waiting on you right now.</p>'}</div></section>
  </div>
  <section class="td-watch" data-pop="watch"><div class="td-h"><h2>Watch list</h2><span class="td-wsub"><span class="td-sub">Clients the tags picked up</span>${expandBtn('watch','Watch list')}</span></div>
    ${tagged.length?`<div class="td-tags">${tagged.map(x=>`<div class="td-card td-tg"><div class="td-tgh"><span class="td-dot t-${x.t.tone}"></span><b>${esc(x.t.label)}</b><em>${x.people.length}</em></div><div class="td-names td-scroll">${x.people.map(x=>person(x.c)).join('')}</div></div>`).join('')}</div>`
      :`<div class="td-card"><p class="td-empty">No clients tagged right now. Silent, Plateau, Regaining and the other tags fill in once Trainerize weights and weekly check-ins come into the portal.</p></div>`}
  </section>
</div>${popHTML()}`;
  POPNEW=false;
  dash.querySelectorAll('.td-tlist,.tc-list,.td-popb').forEach((e,i)=>{e.dataset.keep=e.className+i});
  keep.forEach(([k,t])=>{const e=dash.querySelector(`[data-keep="${k}"]`);if(e)e.scrollTop=t});
  document.documentElement.style.overflow=POP?'hidden':'';
}
const openPop=k=>{POP=k;POPNEW=true;if(k==='calls')CALDAY=0;renderDash()};
const closePop=()=>{POP=null;renderDash()};
dash.addEventListener('click',e=>{
  const tb=e.target.closest('[data-ttab]');if(tb){TTAB=tb.dataset.ttab;renderDash();return}
  const ck=e.target.closest('[data-tdone]');if(ck&&TASKS){const t=TASKS.find(x=>String(x.id)===ck.dataset.tdone);if(!t)return;const was=t.status;t.status=was==='Done'?'Not started':'Done';renderDash();
    Promise.resolve(window.TTL_TASKS&&TTL_TASKS.setDone&&TTL_TASKS.setDone(t.id,t.status==='Done')).catch(()=>{t.status=was;renderDash();toast('Could not update Notion. Try again.')});return}
  if(e.target.closest('[data-popclose]')){closePop();return}
  const cd=e.target.closest('[data-calday]');if(cd){CALDAY=+cd.dataset.calday;renderDash();return}
  if(e.target.closest('.td-new')){toast('New tasks are added in Notion for now.');return}
  if(e.target.closest('.td-name,.td-prow')){if(POP){POP=null;renderDash()}return} // profile opens (handler below)
  // Anywhere else on a section (or its expand button) opens it as the centre pop-up.
  const pb=e.target.closest('[data-pop]');if(pb&&!e.target.closest('.td-pop')&&(e.target.closest('.td-exp,.tc-open')||!e.target.closest('button,a,input,select'))){
    const k=pb.dataset.pop;if((k==='tasks'&&!TASKS)||(k==='calls'&&!CALLS))return;openPop(k)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&POP&&!dash.hidden)closePop()});

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
  if(!dash.hidden){const t=e.target.closest('[data-team]');if(t){VIEW=t.dataset.team==='1'?(team()[0]||WHO):WHO;TASKS=CALLS=null;TTAB='Today';renderDash();loadFeeds();return}
    const co=e.target.closest('[data-coach]');if(co){VIEW=co.dataset.coach;TASKS=CALLS=null;TTAB='Today';renderDash();loadFeeds();return}
    const o=e.target.closest('.td-name,.td-prow');if(o){openP(o.dataset.open);return}}
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
