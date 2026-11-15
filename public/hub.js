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
    <a class="th-tile" href="https://twicethelean.trainerize.com" target="_blank" rel="noopener"><span class="th-ic th-emo" aria-hidden="true">💪</span><b>Trainerize <span class="th-ext">${svg(I.ext,15)}</span></b><span class="th-d">Programmes and client app</span></a>
    <a class="th-tile" href="https://calendly.com/event_types/user/me" target="_blank" rel="noopener"><span class="th-ic th-emo" aria-hidden="true">🗓️</span><b>Calendly <span class="th-ext">${svg(I.ext,15)}</span></b><span class="th-d">Call links and bookings</span></a>
    <a class="th-tile" href="https://admin.typeform.com" target="_blank" rel="noopener"><span class="th-ic th-emo" aria-hidden="true">📝</span><b>Typeform <span class="th-ext">${svg(I.ext,15)}</span></b><span class="th-d">Onboarding and check-in forms</span></a>
  </nav>
  <p class="th-foot">Using as <b>${esc(WHO)}</b> · ${window.TTL_CAN_SWITCH?'<button type="button" class="linkbtn" id="thSwitch">Switch</button> · ':''}${WHO==='Harsh'?'<button type="button" class="linkbtn" id="thTeamBtn">Manage team</button> · ':''}<button type="button" class="linkbtn" id="thOut">Log out</button></p>
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
const team=()=>(window.TTL_STORE&&TTL_STORE.coaches?TTL_STORE.coaches():[...new Set(CLIENTS.map(c=>c.coach))]).filter(n=>n&&n!==WHO); // every teammate, including one added today with no clients yet
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
  const P=(name,stage,coach,payment)=>({name,stage,coach,payment});
  window.TTL_PIPE={onboarding:async()=>[P('Sample Client A','OB Call Booked','Harsh','Complete'),P('Sample Client B','Awaiting Submission Data','Shrutika','Invoice Due'),P('Sample Client C','Plan built','Harsh','Complete'),P('Sample Client D','Ready to Deliver','Shrutika','Complete')],
    renewal:async()=>[P('Sample Client E','Questionnaire Sent','Harsh','Payment Due'),P('Sample Client F','Goal setting call due','Shrutika','Complete'),P('Sample Client G','Loom Due','Harsh','Complete')]};
}
async function loadFeeds(){
  try{if(window.TTL_TASKS){TASKS=await TTL_TASKS.list(VIEW);SYNCED=new Date()}}catch(_){TASKS=null}
  try{if(window.TTL_CALLS)CALLS=(await TTL_CALLS.list(new Date(),7,VIEW)).map(c=>Object.assign({},c,{start:new Date(c.start),end:new Date(c.end)})).sort((a,b)=>a.start-b.start)}catch(_){CALLS=null}
  for(const k of ['onboarding','renewal']){try{PIPE[k]=window.TTL_PIPE?await TTL_PIPE[k](VIEW):null}catch(_){PIPE[k]=null}}
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
  if(!window.TTL_TASKS||!TASKS)return `<section class="td-card td-soon"><div class="td-h"><h2><span class="nt-emo">✅</span>Daily Tasks</h2><span class="td-tag">Connecting next</span></div><p>Your Notion tasks will show here, live: tick them done here and they update in Notion.</p></section>`;
  return `<section class="td-card td-tasks" data-pop="tasks"><div class="td-h td-th"><div class="td-tl"><h2><span class="nt-emo">✅</span>Daily Tasks${TEAM_ON()?' · '+esc(VIEW):''}</h2>${syncLine()}</div>${expandBtn('tasks','tasks')}</div>
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
/* Check-in status: where this week's check-ins stand, straight from the Sheet. */
function checkinHTML(){
  // The week's total: every client on the coach's sheet whose Check-in Status is anything except Skip or On Hold.
  const pool=CLIENTS.filter(c=>c.coach===VIEW&&!['skip','onhold'].includes(SKEY(c.comp))),all=pool.length,closed=pool.filter(c=>SKEY(c.comp)==='markedclosed').length;
  const pct=all?Math.round(closed/all*100):0;
  return `<section class="td-card td-ci"><div class="td-h"><h2>Check-in status</h2><span class="td-live"><i></i>Live now</span></div>
    <p class="td-sub">${TEAM_ON()?esc(VIEW)+"'s":'Your'} sheet this week</p>
    <div class="ci-big"><b>${closed}</b><span>closed out of ${all}</span><em>${pct}%</em></div>
    <div class="ci-bar" role="img" aria-label="${pct}% closed"><i style="width:${pct}%"></i></div></section>`;
}
/* Focus timer: counts up from 00:00. Keeps running across screens and refreshes (saved on this device). */
const TKEY='ttl-timer-'+WHO;let TM={run:false,start:0,acc:0};try{TM=Object.assign(TM,JSON.parse(localStorage.getItem(TKEY)||'{}'))}catch(_){}
const tmSave=()=>{try{localStorage.setItem(TKEY,JSON.stringify(TM))}catch(_){}};
const tmMs=()=>TM.acc+(TM.run?Date.now()-TM.start:0);
const tmFmt=ms=>{const t=Math.floor(ms/1000),h=Math.floor(t/3600),m=Math.floor(t%3600/60),x=t%60,p=n=>String(n).padStart(2,'0');return h?`${h}:${p(m)}:${p(x)}`:`${p(m)}:${p(x)}`};
function tmDo(a){if(a==='start'&&!TM.run){TM.run=true;TM.start=Date.now()}else if(a==='pause'&&TM.run){TM.acc=tmMs();TM.run=false}else if(a==='stop'){TM={run:false,start:0,acc:0}}tmSave();renderDash()}
setInterval(()=>{if(!TM.run||dash.hidden)return;dash.querySelectorAll('.tm-time').forEach(e=>e.textContent=tmFmt(tmMs()))},500);
function timerHTML(){const ms=tmMs(),st=TM.run?'Running':ms?'Paused':'Ready';
  return `<section class="td-card td-timer${TM.run?' run':''}"><div class="tm-top"><span>Focus timer</span><em>${st}</em></div>
    <div class="tm-time" aria-live="off">${tmFmt(ms)}</div>
    <div class="tm-btns"><button type="button" data-timer="start" ${TM.run?'disabled':''} aria-label="Start">${svg('<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',16)}<span>${ms&&!TM.run?'Resume':'Start'}</span></button>
      <button type="button" data-timer="pause" ${TM.run?'':'disabled'} aria-label="Pause">${svg('<path d="M8 5v14M16 5v14"/>',16)}<span>Pause</span></button>
      <button type="button" data-timer="stop" ${ms?'':'disabled'} aria-label="Stop and reset">${svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',16)}<span>Stop</span></button></div></section>`}
/* Expiring soon: the business rule is the check-in form, not the calendar. A client is ready for renewal once their weekly check-in form reaches week 10. */
const ciWeek=c=>Math.max(0,...ckOf(c).map(k=>+k.n||0));
function expiringHTML(){const from=(typeof RULES!=='undefined'&&RULES.renewFrom)||10,pool=IS_OWNER&&!TEAM_ON()?CLIENTS:CLIENTS.filter(c=>c.coach===VIEW);
  const rows=pool.map(c=>({c,w:ciWeek(c)})).filter(x=>x.w>=from).sort((a,b)=>b.w-a.w||a.c.name.localeCompare(b.c.name));
  const any=CLIENTS.some(c=>ciWeek(c)>0);let demo=false;
  if(SAMPLE&&!any){demo=true;[12,12,11,11,10,10,10].forEach((w,i)=>{if(pool[i*3])rows.push({c:pool[i*3],w})})} // test link only: made-up weeks so the tile can be seen filled
  return `<section class="td-card td-expg"><div class="td-h"><h2>⏳ Expiring soon <em>${rows.length}</em></h2></div>
    <p class="td-sub">Clients whose check-in form has reached week ${from} or later.${demo?' <b class="td-demo">Sample weeks for this demo</b>':''}</p>
    ${rows.length?`<div class="td-scroll td-ltwrap"><div class="td-lt"><div class="td-ltr td-lth"><span>Name</span><span>Check-in week</span><span>Coach</span></div>${rows.map(x=>`<button type="button" class="td-ltr" data-open="${x.c.id}"><span class="td-ltn"><span class="td-ini">${ini(x.c)}</span><b>${esc(x.c.name)}</b></span><span><i class="td-lv wk${Math.min(12,x.w)}">Week ${x.w}</i></span><span class="td-ltc">${esc(x.c.coach)}</span></button>`).join('')}</div></div>`
      :`<p class="td-empty">${any?'Nobody has reached week '+from+' yet.':'Fills in once the weekly Typeform check-ins are connected. Nothing is worked out from dates.'}</p>`}</section>`}

/* Onboarding and Next phase: the two Notion client boards. They fill once the Notion connection is switched on (window.TTL_PIPE). */
let PIPE={onboarding:null,renewal:null};
const PIPE_DEF={onboarding:['🤝','Onboarding','New clients moving through setup','Onboarding’s board in Notion','Onboarding Process'],renewal:['🚀','Next Phase','Renewals moving through the next-phase steps','The Next Phase / Accelerator board in Notion','Renewal Process']};
// Same colours as the status options in the two Notion boards.
const N_COL={green:['donenandclosed','doneandclosed','postdeliveryfollowupdone','deliverydone','markedclosed'],
  blue:['readytodeliver','workoutsdue','waitingforapproval','habitssetup','planbuilt','readytobuild','loomdue','deliverydue','workoutplandue','planready','reviewdue'],
  yellow:['awaitingsubmissiondata','obcallbooked','obcalldone','groupandquestionnairedone','goalsettingcalldue','questionnairedoneandgoalsettingbooked','questionnairesent']};
const nCol=t=>{const k=String(t||'').toLowerCase().replace(/[^a-z]/g,'');return Object.keys(N_COL).find(c=>N_COL[c].includes(k))||'gray'};
const N_ICON={name:'<path d="M4 18 9 6l5 12M6 14h6M17 10v8M17 12c2-2 4-1 4 1v5"/>',status:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2.5"/>',person:'<circle cx="12" cy="9" r="3.5"/><path d="M5 19c1.5-4 12.500-4 14 0"/>'};
function pipeHTML(k){const [emo,title,sub,src,prop]=PIPE_DEF[k],rows=PIPE[k];
  if(!window.TTL_PIPE||!rows)return `<section class="td-card td-soon"><div class="td-h"><h2>${emo} ${title}</h2><span class="td-tag">Connecting next</span></div><p>${sub}. Comes live from ${src}.</p></section>`;
  const open=rows.filter(r=>!/closed/i.test(r.stage||''));
  return `<section class="td-card td-pipe nt"><div class="nt-h"><h2><span class="nt-emo">${emo}</span>${title}</h2><span class="nt-n">${open.length}</span>${syncLine()}</div>
    ${open.length?`<div class="nt-wrap"><div class="nt-row nt-head"><span>${svg(N_ICON.name,14)}Name</span><span>${svg(N_ICON.status,14)}${prop}</span><span>${svg(N_ICON.person,14)}Assign</span></div>
      ${open.map(r=>`<div class="nt-row"><span class="nt-name">${esc(r.name)}</span><span><span class="npill n-${nCol(r.stage)}"><i></i>${esc(r.stage||'Not started')}</span></span><span class="nt-who">${r.coach?`<i>${esc(r.coach[0])}</i>${esc(r.coach)}`:''}</span></div>`).join('')}</div>`:'<p class="td-empty">Nothing open right now.</p>'}</section>`}

function needsHTML(){const {needs}=dashData();
  return `<section class="td-card td-needs" data-pop="needs"><div class="td-h"><h2>${TEAM_ON()?'Needs '+esc(VIEW):'Needs you'} today <em>${needs.length}</em></h2>${expandBtn('needs','Needs you today')}</div>
      <p class="td-sub">Master reviews, calls and reviews waiting on ${TEAM_ON()?esc(VIEW):'you'}. Tap a name for details.</p>
      <div class="td-names td-scroll">${needs.length?needs.map(person).join(''):'<p class="td-empty">Nobody is waiting on you right now.</p>'}</div></section>`}
function watchHTML(){const {tagged}=dashData();
  return `<section class="td-watch" data-pop="watch"><div class="td-h"><h2>Watch list</h2><span class="td-wsub"><span class="td-sub">Clients the tags picked up</span>${expandBtn('watch','Watch list')}</span></div>
    ${tagged.length?`<div class="td-tags">${tagged.map(x=>`<div class="td-card td-tg"><div class="td-tgh"><span class="td-dot t-${x.t.tone}"></span><b>${esc(x.t.label)}</b><em>${x.people.length}</em></div><div class="td-names td-scroll">${x.people.map(x=>person(x.c)).join('')}</div></div>`).join('')}</div>`
      :`<div class="td-card"><p class="td-empty">No clients tagged right now. Silent, Plateau, Regaining and the other tags fill in once Trainerize weights and weekly check-ins come into the portal.</p></div>`}
  </section>`}

/* ---------- Widgets: a 12-column grid each coach can rearrange and resize (wide screens). Saved on this device, per coach. ---------- */
const W_HTML={tasks:()=>tasksHTML(),ladder:()=>ladderHTML(),checkin:()=>checkinHTML(),timer:()=>timerHTML(),expiring:()=>expiringHTML(),onboarding:()=>pipeHTML('onboarding'),renewal:()=>pipeHTML('renewal'),calls:()=>callsHTML(),needs:()=>needsHTML(),watch:()=>watchHTML()};
const W_NAME={tasks:'Tasks',ladder:'Escalations',checkin:'Check-in status',timer:'Timer',expiring:'Expiring soon',onboarding:'Onboarding',renewal:'Next phase',calls:'Calls',needs:'Needs you today',watch:'Watch list'};
const W_DEF=[['checkin',3,6],['tasks',5,6],['ladder',4,6],['timer',2,4],['calls',4,4],['needs',6,4],['expiring',4,5],['onboarding',4,5],['renewal',4,5],['watch',12,4]];
const W_MIN={tasks:[4,4],ladder:[3,3],checkin:[2,3],timer:[2,3],expiring:[3,3],onboarding:[3,3],renewal:[3,3],calls:[3,4],needs:[3,3],watch:[4,3]};
const W_ROW=56,W_GAP=16,LKEY='ttl-dash-layout-v1-'+WHO;
const defLay=()=>W_DEF.map(([id,w,h])=>({id,w,h}));
// A saved layout is never rearranged by the portal. It is kept in the database per coach (same on every device and on the test link)
// with a copy on this device. Only a section that did not exist when the layout was saved is added, at the very end.
function loadLay(){let saved=window.TTL_STORE&&TTL_STORE.layout?TTL_STORE.layout(WHO):null;
  if(!saved)try{const s=JSON.parse(localStorage.getItem(LKEY)||'null');if(Array.isArray(s))saved=s}catch(_){}
  if(!Array.isArray(saved))return defLay();
  const ok=saved.filter(x=>x&&W_HTML[x.id]&&x.w>0&&x.h>0).map(x=>({id:x.id,w:+x.w,h:+x.h}));defLay().forEach(d=>{if(!ok.find(x=>x.id===d.id))ok.push(d)});return ok}
const saveLay=()=>{try{localStorage.setItem(LKEY,JSON.stringify(LAY))}catch(_){}if(window.TTL_STORE&&TTL_STORE.saveLayout)TTL_STORE.saveLayout(WHO,LAY.map(x=>({id:x.id,w:x.w,h:x.h}))).catch(()=>toast('Layout saved on this device only. Check your connection.'))};
let LAY=loadLay(),EDITL=false,DRAGW=null;
const GRIP='<path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/>';
// Moves the others out of the way smoothly: measure, change, then animate from the old place to the new one.
function flip(grid,change,skip){const els=[...grid.children],a=new Map(els.map(el=>[el,el.getBoundingClientRect()]));change();
  els.forEach(el=>{if(el===skip)return;const o=a.get(el),b=el.getBoundingClientRect(),dx=o.left-b.left,dy=o.top-b.top;if(dx||dy)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'})})}
function renderDash(){
  if(dash.hidden||DRAGW)return;
  const keep=[...dash.querySelectorAll('[data-keep]')].map(e=>[e.dataset.keep,e.scrollTop]);
  dash.innerHTML=`<div class="td-wrap">
  <button type="button" class="td-back" data-go="home">${svg(I.back,14)}Home</button>
  <header class="td-head">
    <div class="td-hi"><div class="th-date">${today()}</div><h1>${greet()}, ${esc(WHO)}</h1></div>
    <div class="td-tools">${EDITL?'<button type="button" class="td-edit ghost" data-layreset>Reset layout</button>':''}<button type="button" class="td-edit${EDITL?' on':''}" data-layedit>${EDITL?'Done':svg(GRIP,15)+'Edit layout'}</button>
    ${IS_OWNER&&team().length?`<div class="seg td-seg" role="group" aria-label="Whose day"><button type="button" data-team="0" aria-pressed="${!TEAM_ON()}">My day</button><button type="button" data-team="1" aria-pressed="${TEAM_ON()}">Team</button></div>`:''}</div>
  </header>
  ${TEAM_ON()?`<div class="td-team" role="group" aria-label="Team member"><span class="td-sub">Viewing</span>${team().map(n=>`<button type="button" class="td-coach" data-coach="${esc(n)}" aria-pressed="${n===VIEW}"><span class="td-ini">${esc(n[0])}</span>${esc(n)}<em>${CLIENTS.filter(c=>c.coach===n).length} clients</em></button>`).join('')}</div>`:''}
  ${EDITL?'<p class="td-edithint">Drag a section to move it. Drag its bottom-right corner to resize it. The others make room.</p>':''}
  <div class="td-grid${EDITL?' edit':''}">${LAY.map(w=>`<div class="tw" data-w="${w.id}" style="--w:${w.w};--h:${w.h}">${W_HTML[w.id]()}${EDITL?`<div class="tw-veil"><span class="tw-grip">${svg(GRIP,16)}${W_NAME[w.id]}</span></div><span class="tw-size" aria-hidden="true"></span>`:''}</div>`).join('')}</div>
</div>${popHTML()}`;
  POPNEW=false;
  dash.querySelectorAll('.td-tlist,.tc-list,.td-popb,.tw>section,.td-ltwrap').forEach((e,i)=>{e.dataset.keep=e.className+i});
  keep.forEach(([k,t])=>{const e=dash.querySelector(`[data-keep="${k}"]`);if(e)e.scrollTop=t});
  document.documentElement.style.overflow=POP?'hidden':'';
}
dash.addEventListener('pointerdown',e=>{
  if(!EDITL||e.button>0)return;const tw=e.target.closest('.tw'),grid=dash.querySelector('.td-grid');if(!tw||!grid)return;e.preventDefault();
  const id=tw.dataset.w,item=LAY.find(x=>x.id===id),r=tw.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,sizing=!!e.target.closest('.tw-size');
  DRAGW={id};document.body.classList.add('tw-busy');
  let ghost=null,last=null;
  if(!sizing){ghost=tw.cloneNode(true);ghost.classList.add('tw-ghost');Object.assign(ghost.style,{width:r.width+'px',height:r.height+'px',left:r.left+'px',top:r.top+'px'});dash.appendChild(ghost);tw.classList.add('drag')}
  else tw.classList.add('sizing');
  const move=ev=>{
    if(sizing){const g=grid.getBoundingClientRect(),col=(g.width+W_GAP)/12,mn=W_MIN[id]||[2,2];
      const w=Math.max(mn[0],Math.min(12,Math.round((ev.clientX-r.left+W_GAP)/col))),h=Math.max(mn[1],Math.min(16,Math.round((ev.clientY-r.top+W_GAP)/(W_ROW+W_GAP))));
      if(w!==item.w||h!==item.h)flip(grid,()=>{item.w=w;item.h=h;tw.style.setProperty('--w',w);tw.style.setProperty('--h',h)},tw);return}
    ghost.style.transform=`translate(${ev.clientX-sx}px,${ev.clientY-sy}px) scale(1.02)`;
    const over=document.elementsFromPoint(ev.clientX,ev.clientY).map(x=>x.closest&&x.closest('.td-grid>.tw')).find(x=>x&&x!==tw);
    if(!over){last=null;return}if(over===last)return;last=over;
    const from=LAY.indexOf(item),to=LAY.findIndex(x=>x.id===over.dataset.w);if(to<0)return;
    flip(grid,()=>{LAY.splice(from,1);LAY.splice(to,0,item);grid.insertBefore(tw,from<to?over.nextSibling:over)},null);
  };
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);document.body.classList.remove('tw-busy');saveLay();
    const done=()=>{if(ghost)ghost.remove();tw.classList.remove('drag','sizing');DRAGW=null};
    if(ghost){const b=tw.getBoundingClientRect();const an=ghost.animate([{transform:ghost.style.transform||'none'},{transform:`translate(${b.left-r.left}px,${b.top-r.top}px) scale(1)`}],{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'});an.onfinish=done;an.oncancel=done}else done()};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
});
const openPop=k=>{POP=k;POPNEW=true;if(k==='calls')CALDAY=0;renderDash()};
const closePop=()=>{POP=null;renderDash()};
dash.addEventListener('click',e=>{
  if(e.target.closest('[data-layedit]')){EDITL=!EDITL;POP=null;renderDash();return}
  if(e.target.closest('[data-layreset]')){if(confirm('Put every section back to the default place and size? Your saved layout will be replaced.')){LAY=defLay();saveLay();renderDash()}return}
  if(EDITL&&e.target.closest('.td-grid'))return;
  const tmb=e.target.closest('[data-timer]');if(tmb){tmDo(tmb.dataset.timer);return}
  const tb=e.target.closest('[data-ttab]');if(tb){TTAB=tb.dataset.ttab;renderDash();return}
  const ck=e.target.closest('[data-tdone]');if(ck&&TASKS){const t=TASKS.find(x=>String(x.id)===ck.dataset.tdone);if(!t)return;const was=t.status;t.status=was==='Done'?'Not started':'Done';renderDash();
    Promise.resolve(window.TTL_TASKS&&TTL_TASKS.setDone&&TTL_TASKS.setDone(t.id,t.status==='Done')).catch(()=>{t.status=was;renderDash();toast('Could not update Notion. Try again.')});return}
  if(e.target.closest('[data-popclose]')){closePop();return}
  const cd=e.target.closest('[data-calday]');if(cd){CALDAY=+cd.dataset.calday;renderDash();return}
  if(e.target.closest('.td-new')){toast('New tasks are added in Notion for now.');return}
  if(e.target.closest('.td-name,.td-prow,.td-ltr[data-open]')){if(POP){POP=null;renderDash()}return} // profile opens (handler below)
  // Anywhere else on a section (or its expand button) opens it as the centre pop-up.
  const pb=e.target.closest('[data-pop]');if(pb&&!e.target.closest('.td-pop')&&(e.target.closest('.td-exp,.tc-open')||!e.target.closest('button,a,input,select'))){
    const k=pb.dataset.pop;if((k==='tasks'&&!TASKS)||(k==='calls'&&!CALLS))return;openPop(k)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&POP&&!dash.hidden)closePop()});

/* ---------- Quick chat: a message button in the top-right corner. The whole team talks here; it clears itself after 24 hours.
   @Name tags a teammate: their button rings and a banner tells them, on whichever screen they are. ---------- */
const QC_EMO=['😀','😂','🥹','😊','😍','😎','🤔','😅','😴','😤','🙏','👍','👎','👏','💪','🔥','✅','❌','⭐','🎉','❤️','💯','👀','🙌','🤝','📞','📸','🥗','🍎','🏋️','⏰','📌','⚠️','🚀','😬','🤷'];
const QC_COL=['#3F59A7','#E0559B','#1E9E6A','#D9822B','#7A5AF8','#0F9BB3'];
const qc=document.createElement('div');qc.className='qc-root';qc.hidden=true;app.appendChild(qc);
const qcRead=()=>(TTL_STORE.chatSeen&&TTL_STORE.chatSeen())||{}; // how far each coach has read, kept in the database so all their devices agree
let QC_OPEN=false,QC_TOLD=new Set(),QC_DRAFT='';
const qcTeam=()=>TTL_STORE.coaches?TTL_STORE.coaches():[WHO];
const qcMsgs=()=>(TTL_STORE.chat&&TTL_STORE.chat())||[];
const qcNew=()=>{const mine=qcRead()[WHO]||'';return qcMsgs().filter(m=>m.by!==WHO&&m.at>mine)};
const qcTags=()=>qcNew().filter(m=>(m.to||[]).includes(WHO));
const qcTime=at=>new Date(at).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
const qcCol=n=>QC_COL[Math.max(0,qcTeam().indexOf(n))%QC_COL.length];
// @Name becomes a bold tag; only real teammates (or @all) count.
function qcFind(text){const team=qcTeam(),to=new Set();String(text).replace(/@([A-Za-z][A-Za-z'-]*)/g,(m,n)=>{const k=n.toLowerCase();if(k==='all'||k==='team'||k==='everyone')team.forEach(x=>x!==WHO&&to.add(x));else{const hit=team.find(x=>x.toLowerCase()===k);if(hit&&hit!==WHO)to.add(hit)}return m});return [...to]}
const qcText=t=>esc(t).replace(/@([A-Za-z][A-Za-z'-]*)/g,(m,n)=>{const k=n.toLowerCase();return ['all','team','everyone'].includes(k)||qcTeam().some(x=>x.toLowerCase()===k)?`<b class="qc-at">${m}</b>`:m});
// Under your latest message, like a read receipt: who has seen it so far.
function qcSeenBy(m){const R=qcRead(),who=qcTeam().filter(n=>n!==WHO&&(R[n]||'')>=m.at);return who.length?`<b class="qc-seen">Seen by ${esc(who.length>2?who.slice(0,-1).join(', ')+' and '+who[who.length-1]:who.join(' and '))}</b>`:'Sent'}
function qcList(){const M=qcMsgs();if(!M.length)return `<div class="qc-empty"><span aria-hidden="true">💬</span><b>No messages yet</b><p>Say something to the team. Type @ and a name to get someone's attention.</p></div>`;
  const myLast=[...M].reverse().find(m=>m.by===WHO);
  return M.map((m,i)=>{const me=m.by===WHO,prev=M[i-1],first=!prev||prev.by!==m.by||Date.parse(m.at)-Date.parse(prev.at)>10*6e4,next=M[i+1],last=!next||next.by!==m.by||Date.parse(next.at)-Date.parse(m.at)>10*6e4,tag=(m.to||[]).includes(WHO);
    return `${first&&!me?`<div class="qc-who" style="--c:${qcCol(m.by)}">${esc(m.by)}</div>`:''}<div class="qc-line${me?' me':''}${last?' last':''}${tag?' tag':''}">${!me?`<i class="qc-av" style="--c:${qcCol(m.by)}">${last?esc(m.by[0]):''}</i>`:''}<div class="qc-b" ${me?'':`style="--c:${qcCol(m.by)}"`}>${qcText(m.t)}</div></div>${last?`<div class="qc-t${me?' me':''}">${qcTime(m.at)}${me&&m===myLast?' · '+qcSeenBy(m):''}</div>`:''}`}).join('')}
function qcBadge(){const btn=qc.querySelector('.qc-btn');if(!btn)return;const n=qcNew().length,t=qcTags().length,em=btn.querySelector('em');em.hidden=!n||QC_OPEN;em.textContent=t?'@':n;btn.classList.toggle('new',!!n&&!QC_OPEN);btn.classList.toggle('tag',!!t&&!QC_OPEN);
  btn.setAttribute('aria-label',t?'Quick chat: someone tagged you':n?`Quick chat: ${n} new message${n===1?'':'s'}`:'Quick chat')}
function qcSeen(){const M=qcMsgs();if(M.length&&TTL_STORE.setSeen)TTL_STORE.setSeen(M[M.length-1].at).catch(()=>{});qcBadge();qcBanner(null)}
function qcBanner(m){let b=qc.querySelector('.qc-ban');if(!m){if(b)b.remove();return}if(!b){b=document.createElement('button');b.type='button';b.className='qc-ban';qc.appendChild(b)}
  b.innerHTML=`<i class="qc-av" style="--c:${qcCol(m.by)}">${esc(m.by[0])}</i><span><b>${esc(m.by)} tagged you</b><span>${esc(m.t.length>90?m.t.slice(0,90)+'…':m.t)}</span></span>`}
function qcPaint(keepScroll){const box=qc.querySelector('.qc-msgs');if(!box)return;const atEnd=box.scrollHeight-box.scrollTop-box.clientHeight<60;box.innerHTML=qcList();if(!keepScroll||atEnd)box.scrollTop=box.scrollHeight}
function qcRender(){qc.innerHTML=`<button type="button" class="qc-btn" aria-expanded="false" aria-label="Quick chat"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.48 3 2 6.58 2 11c0 2.38 1.3 4.5 3.36 5.96-.14 1.2-.62 2.3-1.36 3.2-.2.24 0 .6.3.56 2.02-.24 3.6-.94 4.72-1.72.94.24 1.94.38 2.98.38 5.52 0 10-3.58 10-8.38S17.52 3 12 3Z"/></svg><em hidden></em></button>
  <section class="qc-panel" role="dialog" aria-label="Quick chat"><header class="qc-h"><div><b>Quick chat</b><span>${qcTeam().map(esc).join(', ')} · clears every night at 12 am</span></div><button type="button" class="qc-x" aria-label="Close chat">${svg(X_IC,13)}</button></header>
    <div class="qc-msgs" aria-live="polite"></div>
    <div class="qc-ats">${qcTeam().filter(n=>n!==WHO).map(n=>`<button type="button" data-at="${esc(n)}">@${esc(n)}</button>`).join('')}${qcTeam().length>2?'<button type="button" data-at="all">@all</button>':''}</div>
    <div class="qc-emo" hidden>${QC_EMO.map(x=>`<button type="button" data-emo="${x}">${x}</button>`).join('')}</div>
    <form class="qc-form"><button type="button" class="qc-eb" aria-label="Emoji" aria-expanded="false">😊</button><textarea class="qc-in" rows="1" maxlength="1000" placeholder="Message the team" aria-label="Message"></textarea><button type="submit" class="qc-send" aria-label="Send" disabled><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6"/></svg></button></form></section>`;
  qcPaint();qcBadge()}
function qcSet(open){QC_OPEN=open;const p=qc.querySelector('.qc-panel'),b=qc.querySelector('.qc-btn');if(!p)return;p.classList.toggle('open',open);b.setAttribute('aria-expanded',open);
  if(open){qcPaint();qcSeen();const inp=qc.querySelector('.qc-in');inp.value=QC_DRAFT;qcGrow(inp);if(matchMedia('(hover:hover)').matches)setTimeout(()=>inp.focus(),120)}else qcBadge()}
function qcGrow(inp){inp.style.height='auto';inp.style.height=Math.min(120,inp.scrollHeight)+'px';qc.querySelector('.qc-send').disabled=!inp.value.trim()}
function qcSend(){const inp=qc.querySelector('.qc-in'),text=inp.value.trim();if(!text)return;qc.querySelector('.qc-emo').hidden=true;inp.value='';QC_DRAFT='';qcGrow(inp);
  TTL_STORE.sendChat(text,qcFind(text)).catch(()=>toast('Message not sent. Check your connection.'));qcPaint();qcSeen();inp.focus()}
qc.addEventListener('click',e=>{if(e.target.closest('.qc-btn')||e.target.closest('.qc-ban')){qcSet(!QC_OPEN||!!e.target.closest('.qc-ban'));return}if(e.target.closest('.qc-x')){qcSet(false);return}
  const eb=e.target.closest('.qc-eb');if(eb){const p=qc.querySelector('.qc-emo');p.hidden=!p.hidden;eb.setAttribute('aria-expanded',!p.hidden);return}
  const em=e.target.closest('[data-emo]');if(em){const inp=qc.querySelector('.qc-in'),a=inp.selectionStart??inp.value.length,b=inp.selectionEnd??a;inp.value=inp.value.slice(0,a)+em.dataset.emo+inp.value.slice(b);const c=a+em.dataset.emo.length;QC_DRAFT=inp.value;qcGrow(inp);inp.focus();inp.setSelectionRange(c,c);return}
  const a=e.target.closest('[data-at]');if(a){const inp=qc.querySelector('.qc-in');inp.value=(inp.value&&!/\s$/.test(inp.value)?inp.value+' ':inp.value)+'@'+a.dataset.at+' ';QC_DRAFT=inp.value;qcGrow(inp);inp.focus()}});
qc.addEventListener('submit',e=>{e.preventDefault();qcSend()});
qc.addEventListener('input',e=>{if(e.target.classList.contains('qc-in')){QC_DRAFT=e.target.value;qcGrow(e.target)}});
qc.addEventListener('keydown',e=>{if(e.target.classList&&e.target.classList.contains('qc-in')&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();qcSend()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&QC_OPEN&&!qc.hidden)qcSet(false)});
document.addEventListener('pointerdown',e=>{if(QC_OPEN&&!qc.contains(e.target))qcSet(false)});
// New messages arrive every few seconds. A tag shows a banner once and keeps the button ringing until the chat is opened.
setInterval(async()=>{if(qc.hidden||document.visibilityState!=='visible'||!TTL_STORE.refreshChat)return;const sig=()=>qcMsgs().map(m=>m.id).join(),before=sig(),rb=JSON.stringify(qcRead());await TTL_STORE.refreshChat().catch(()=>null);
  if(sig()===before){if(QC_OPEN&&JSON.stringify(qcRead())!==rb)qcPaint(true);qcBadge();if(!qcTags().length)qcBanner(null);return}
  if(QC_OPEN){qcPaint(true);qcSeen()}else{qcBadge();const t=qcTags().filter(m=>!QC_TOLD.has(m.id));if(t.length){t.forEach(m=>QC_TOLD.add(m.id));qcBanner(t[t.length-1])}}},4000);

/* ---------- Manage team (head coach only): remove a coach, with two confirmations ---------- */
const mt=document.createElement('div');mt.className='mt-root';mt.hidden=true;app.appendChild(mt);
let MT={step:0,name:''};
function mtRender(){const list=TTL_STORE.coaches().filter(n=>n!==OWNER),n=MT.name,cnt=n?TTL_STORE.clientsOf(n):0;let body;
  if(MT.step===0)body=`<h2 id="mtT">Manage team</h2><p class="mt-sub">Only you can remove a coach. New coaches are added by creating their login in Supabase.</p>
    <div class="mt-list">${list.length?list.map(x=>`<div class="mt-row"><span class="td-ini">${esc(x[0])}</span><span class="mt-n"><b>${esc(x)}</b><em>${TTL_STORE.clientsOf(x)} active clients</em></span><button type="button" class="mt-del" data-mtdel="${esc(x)}">Delete</button></div>`).join(''):'<p class="mt-sub">There are no other coaches.</p>'}</div>
    <div class="mt-f"><button type="button" class="mt-b" data-mtclose>Close</button></div>`;
  else if(MT.step===1&&cnt>0)body=`<h2 id="mtT">${esc(n)} still has ${cnt} active client${cnt===1?'':'s'}</h2><p class="mt-sub">Move ${cnt===1?'that client':'those clients'} to another coach on the Sheet first, or move them to Expired and hold. Then come back and delete ${esc(n)}.</p>
    <div class="mt-f"><button type="button" class="mt-b" data-mtback>Back</button></div>`;
  else if(MT.step===1)body=`<h2 id="mtT">Delete ${esc(n)}?</h2><p class="mt-sub">${esc(n)} will be removed from the Sheet, the Dashboard, the team chat and every coach list, and their saved Dashboard layout is deleted. Client records are not touched.</p>
    <div class="mt-f"><button type="button" class="mt-b" data-mtback>Cancel</button><button type="button" class="mt-b warn" data-mtnext>Continue</button></div>`;
  else body=`<h2 id="mtT">Are you sure?</h2><p class="mt-sub">This is the final step. Type <b>${esc(n)}</b> below to delete this coach.</p>
    <input class="mt-in" id="mtIn" autocomplete="off" aria-label="Type the coach's name to confirm" placeholder="${esc(n)}">
    <div class="mt-f"><button type="button" class="mt-b" data-mtback>Cancel</button><button type="button" class="mt-b danger" data-mtgo disabled>Delete ${esc(n)}</button></div>`;
  mt.innerHTML=`<div class="mt-scrim" data-mtclose></div><div class="mt-box" role="dialog" aria-modal="true" aria-labelledby="mtT">${body}</div>`;
  const inp=mt.querySelector('#mtIn');if(inp)inp.focus()}
const mtOpen=()=>{if(!IS_OWNER)return;MT={step:0,name:''};mt.hidden=false;mtRender()},mtClose=()=>{mt.hidden=true;mt.innerHTML=''};
mt.addEventListener('click',e=>{const t=e.target;if(t.closest('[data-mtclose]'))return mtClose();if(t.closest('[data-mtback]')){MT={step:0,name:''};return mtRender()}
  const d=t.closest('[data-mtdel]');if(d){MT={step:1,name:d.dataset.mtdel};return mtRender()}
  if(t.closest('[data-mtnext]')){MT.step=2;return mtRender()}
  if(t.closest('[data-mtgo]')){const n=MT.name;TTL_STORE.removeCoach(n).then(()=>{toast(n+' deleted. Remove their login in Supabase too, under Authentication → Users.');if(window.XS)XS.refresh();if(qc.firstChild)qcRender()}).catch(()=>toast('Could not delete '+n+'. Check your connection.'));mtClose()}});
mt.addEventListener('input',e=>{if(e.target.id==='mtIn')mt.querySelector('[data-mtgo]').disabled=e.target.value.trim().toLowerCase()!==MT.name.toLowerCase()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!mt.hidden)mtClose()});
home.addEventListener('click',e=>{if(e.target.id==='thTeamBtn')mtOpen()});

/* ---------- Routing: #home, #portal, #dashboard, #sheet ---------- */
let FROM='home';
function show(r){
  if(r==='sheet'){qc.hidden=true;if(!XOPEN)XS.open();return}
  if(XOPEN)XS.close();
  home.hidden=r!=='home';dash.hidden=r!=='dashboard';qc.hidden=false;if(!qc.firstChild){qcRender();const t=qcTags();if(t.length){t.forEach(m=>QC_TOLD.add(m.id));qcBanner(t[t.length-1])}}wrap.style.display=r==='portal'?'':'none';
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
    const o=!EDITL&&e.target.closest('.td-name,.td-prow,.td-ltr[data-open]');if(o){openP(o.dataset.open);return}}
  if(e.target.id==='thSwitch'||e.target.id==='whoSwitch'){e.stopImmediatePropagation();try{localStorage.setItem('ttl-pick','1')}catch(_){}location.replace(location.pathname)}
},true);
document.getElementById('thOut').onclick=()=>document.getElementById('logOut').click();

// Home link in the portal header line.
const wl=document.querySelector('.wholine');
if(wl)wl.insertAdjacentHTML('afterbegin','<button type="button" class="linkbtn" data-go="home">← Home</button> · ');

// Re-draw the dashboard when fresh data arrives.
if(window.TTL_STORE)TTL_STORE.collection('edits').onSnapshot(()=>setTimeout(renderDash,0));
route();
})();
