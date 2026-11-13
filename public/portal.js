
/* Coach Portal, ported from the agreed demo (handover/reference/portal-demo.html).
   Data comes from Supabase through src/store.js, which keeps the demo's document interface. */
var XOPEN=false; // true while the Sheet (step 4) is open
let SYNC = new Date();
/* ---------- live data ----------
   clients/<id>  written by the sync (sheet, Typeform, Trainerize, Claude summaries). Coaches never edit these.
   edits/<id>    written by coaches in the portal: plan of action, extra notes, goal, nutrition, snoozes.
   feed/<day>    recent-updates items for that day.  meta/sync  last sync info.  settings/rules  tag thresholds. */
const CLIENTS=[];
const CK={},CKREAD={},TZW={},OBS={},PF={};const XCL=[];const ALLC=()=>CLIENTS.concat(XCL);
let RAW=[],EDITS={},FEEDDOC={},META={},LOADED=false,DB=null,USER=null,ME=null,PROF={};
const tzWeek=(c,n)=>{const z=TZW[c.id];if(z&&z.steps&&z.steps[n-1]!=null)return{steps:z.steps[n-1],done:z.done[n-1],planned:z.planned};return null};
let REPLIED={};
const ckOf=c=>(CK[c.id]||[]).map((k,i)=>{const d=k.date?new Date(k.date):(()=>{const x=new Date(c.start+'T00:00:00+05:30');x.setDate(x.getDate()+7*(i+1));return x})();return Object.assign({},k,{date:d,n:k.n||i+1})});
const needsReply=c=>{const k=ckOf(c);const l=k[k.length-1];return !!(l&&l.guidance&&!l.replied)};
const GOAL_LIST=['Fat Loss','Muscle Gain','Recomp','Recovery / Health'];
const gcls=g=>'g-'+String(g||'not').split(' ')[0].toLowerCase();
function setPhase(c,n){if(n===c.pnum)return;const o=c.pnum;writeEdit(c.id,{phase:n});logEvent({client:c.id,title:'Phase changed',detail:'Phase '+o+' → Phase '+n})}
function setGoal(c,g){const old=c.g;if(old===g)return;writeEdit(c.id,{goal:g});logEvent({client:c.id,title:'Goal changed',detail:old+' → '+g})}
const LEVEL={'Master Review':'master','Master Call':'master','Call needed':'support','Review needed':'new','Call Link Sent':'watch','Call Booked':'watch','Data Due':'watch','Same Week Repeat':'watch','Only Call Link':'watch','Marked Closed':'ok','On Hold':'hold','Skip':'skip','Not set':'none','On Track':'ok','Keep an Eye':'watch','Support Needed':'support','Master Support':'master','Commitment Week':'commit','New':'new'};
const RANK={'Master Review':0,'Master Call':0,'Call needed':1,'Review needed':2,'Data Due':3,'Call Link Sent':3,'Call Booked':3,'Same Week Repeat':3,'Only Call Link':3,'Skip':4,'Marked Closed':5,'Not set':6,'TBD':6,'On Hold':7};
const fmtD = d => d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
function dailyFrom(arr){const out=(arr||[]).map(p=>({t:new Date(p.d+'T07:00:00+05:30'),v:+p.v,m:!!p.m})).filter(p=>!isNaN(p.v)).sort((a,b)=>a.t-b.t);
  out.forEach((p,i)=>{let sum=0,k=0;for(let j=i;j>=0&&p.t-out[j].t<7*864e5;j--){sum+=out[j].v;k++}p.a=sum/k});return out}
function weekOf(start){if(!start)return 0;const s=new Date(start+'T00:00:00+05:30');return Math.max(0,Math.floor((Date.now()-s)/(7*864e5))+1)}
function rebuild(){
  [CK,CKREAD,TZW,OBS,PF].forEach(o=>Object.keys(o).forEach(k=>delete o[k]));
  CLIENTS.length=0;XCL.length=0;
  RAW.forEach(r=>{
    const e=EDITS[r.id]||{};
    if(e.ob)r=Object.assign({},r,e.ob);const ARC=!!(e.sheet&&e.sheet.archived);if(ARC&&e.sheet.expiredAt&&Date.now()-Date.parse(e.sheet.expiredAt)>365*864e5)return;r=mergeSheet(r,e);
    const c={id:r.id,name:e.name||r.name,coach:e.coach||r.coach,email:r.email||'',prog:r.form||'Form not set',status:r.status,start:r.start||'',end:r.end||'',
      comp:(!r.ciStatus||r.ciStatus==='Not set')?'TBD':r.ciStatus,sheet:r,notes:r.notes||[],w:[],kcal:r.kcal??null,p:null,c:null,f:null,target:e.target??r.target??null,formWeight:e.formWeight??r.formWeight??null,
      nsum:r.nsum||'',phase:r.status==='Active'?(r.end?'Ends '+fmtD(new Date(r.end)):'Active'):r.status==='New'?'Yet to start':'On hold'};
    c.week=weekOf(c.start);
    c.g=GOAL_LIST.includes(e.goal)?e.goal:(r.goal||'Not set');c.gsrc=e.goal?'Changed by coach':(r.goalSrc||'Not set yet');
    c.daily=dailyFrom(((r.tz&&r.tz.weights)||[]).concat(e.wt||[]));c.w=(r.tz&&r.tz.weekly)||[];
    c.phases=(r.phases||[]).slice().sort((a,b)=>a.n-b.n);if(e.psum)c.phases=c.phases.map(q=>e.psum[q.n]!=null?Object.assign({},q,{sum:e.psum[q.n]}):q);c.pn=c.phases.length?c.phases[c.phases.length-1]:null;c.pnum=+e.phase||(c.pn?c.pn.n:1);c.pset=!!e.phase;
    if(r.profile||e.pf)PF[c.id]=Object.assign({},r.profile||{},e.pf||{}); if(r.obs)OBS[c.id]=r.obs; c.obs=OBS[c.id]; if(r.checkins)CK[c.id]=r.checkins; if(r.read)CKREAD[c.id]=r.read; if(r.tz&&r.tz.steps)TZW[c.id]=r.tz;
    c.expired=ARC;c.expiredAt=ARC?(e.sheet.expiredAt||''):'';(ARC?XCL:CLIENTS).push(c);
  });
  if(META.at)SYNC=new Date(META.at);
  const sl=$('#syncLine');if(sl)sl.innerHTML=`<i></i>${META.at?'Last sync '+new Date(META.at).toLocaleString('en-IN',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}):'Not synced yet'} <span class="sample">${CLIENTS.length} clients · live</span>`;
  render();renderFeed();if(window.XS)XS.refresh();
  if(cur&&!$('#scrim').hidden&&!editing&&!EDITN&&!(Date.now()-HRQ<400)&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.hr'))){const id=cur.id;cur=ALLC().find(x=>x.id===id);if(cur){const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st}}
}

const SW=t=>String(t||'').replace(/^[^A-Za-z0-9]+/,'').trim();
function kcalFromDs(ds){const t=String(ds||'').replace(/,/g,'');let m=t.match(/^\s*(\d{3,4})\s*([-+])\s*(\d{2,4})\s*=\s*(\d{2,4})/);if(m)return m[2]==='-'?+m[3]:+m[4];m=t.match(/^\s*(\d{3,4})\s*(kcal)?\s*$/i);return m?+m[1]:null}
function dsWithKcal(ds,k){const t=String(ds||'');const m=t.replace(/,/g,'').match(/^\s*(\d{3,4})\s*([-+])\s*(\d{2,4})\s*=\s*(\d{2,4})(.*)$/);
  if(m){const a=+m[1],rest=m[5]||'';return k<=a?`${a}-${k}=${a-k}${rest}`:`${a}+${k-a}=${k}${rest}`}return String(k)}
function syncKcal(c,k,label){const r=(window.XS?XS.rows():[]).find(x=>x.id===c.id);const ds=r?r.ds:(c.sheet&&c.sheet.kcalText)||'';const nds=dsWithKcal(ds,k);
  if(window.XS){const res=XS.apply([{id:c.id,f:'ds',raw:nds,client:c.name,field:'deficit_surplus'}],label||'Calories updated');if(res.applied.length)return nds}
  writeEdit(c.id,{nut:Object.assign({},(EDITS[c.id]||{}).nut||{},{kcal:k})});return nds}
function mergeSheet(r,e){const s=e.sheet;if(!s)return r;const x=Object.assign({},r);const tb=v=>{const w=SW(v);return w==='TBD'?'':w};
  x.ciStatus=SW(s.st)||'Not set';x.ciAction=tb(s.act);x.support=SKEY(s.sup)==='none'?'':SW(s.sup);x.reminders=SW(s.rem);x.form=SW(s.form);x.programme=SW(s.wo);x.clientStatus=tb(s.cs);
  x.appCheckin=s.app===true?'True':s.app===false?'False':'';x.formIn=s.cf===true?'True':s.cf===false?'False':'';
  x.ciNotes=s.note||'';x.weeklyNote=s.wn||'';x.refeed=s.rf||'';x.kcalText=s.ds||'';x.kcal=s.ds===r.kcalText?r.kcal:kcalFromDs(s.ds);x.notes=(s.w||[]).slice();
  x.start=s.start||'';x.end=s.end||'';x.rosterStatus=s.rs;x.status=s.rs==='Yet to start'?'New':s.rs==='On hold'?'On hold':'Active';return x}
async function writeEditsBulk(map){const now=Date.now();Object.entries(map).forEach(([id,pt])=>{EDITS[id]=Object.assign({},EDITS[id]||{},pt,{updatedAt:now,by:ME||null})});rebuild();
  if(DB)for(const id of Object.keys(map)){try{await DB.doc('edits/'+id).set(EDITS[id])}catch(_){}}}
/* coach edits: one document per client, merged and written whole */
async function writeEdit(id,patch){
  const merged=Object.assign({},EDITS[id]||{},patch,{updatedAt:Date.now(),by:ME||null});
  EDITS[id]=merged;rebuild();
  if(!DB){try{localStorage.setItem('ttl-live-edits',JSON.stringify(EDITS))}catch(_){}return}
  try{await DB.doc('edits/'+id).set(merged)}catch(err){toast(err&&err.code==='invalid_argument'?'You can view this portal but not change it.':'Could not save. Check your connection and try again.')}
}
function toast(msg){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,3500)}

const nut=c=>{const e=(EDITS[c.id]||{}).nut||{},o=Object.assign({kcal:c.kcal,p:null,c:null,f:null},e);if(c.kcal!=null)o.kcal=c.kcal;return o};
const noteOf=(c,k)=>((EDITS[c.id]||{})[k])||{text:'',at:''};
function saveNote(c,k,text){writeEdit(c.id,{[k]:{text:text.trim(),at:fmtD(new Date())}});logEvent({client:c.id,title:k==='poa'?'Plan of action updated':'Extra notes updated',detail:text.trim().split('\n')[0].slice(0,90)})}
let EDITN=null,CKSEL=null;
/* ---------- helpers ---------- */
const dietCls=d=>{d=d.toLowerCase();return d.includes('egg')?'d-egg':d.startsWith('non')?'d-non':d.includes('vegan')?'d-vegan':'d-veg'};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const initials=n=>n.split(' ').map(x=>x[0]).slice(0,2).join('');
const delta=c=>c.w.length>1?+(c.w[c.w.length-1]-c.w[0]).toFixed(1):null;
function dcls(c,d){if(d==null)return'flat';const gain=c.prog==='Muscle Gain Method';const goodDir=gain?d>0:d<0;if(Math.abs(d)<.2)return'flat';return goodDir?'down':'up'}
function spark(c){
  if(c.w.length<2)return'';const W=96,H=30,p=3,mn=Math.min(...c.w),mx=Math.max(...c.w),rg=Math.max(mx-mn,.6);
  const pts=c.w.map((v,i)=>[p+i*(W-2*p)/(c.w.length-1),p+(mx-v)*(H-2*p)/rg]);
  const d=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' ');const l=pts[pts.length-1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="#AEC0EA" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${l[0]}" cy="${l[1]}" r="3" fill="#3F59A7"/></svg>`;
}

/* ---------- the brain: auto-tags ----------
   Layer 1 = these fixed rules, run in every sync. Thresholds are the coach's, set on the Rules panel.
   Layer 2 = Claude reads the tags with everything else and writes Trend / Take action (see check-ins). */
const RULES_DEF={silentDays:7,plateauWeeks:3,plateauKg:0.5,regainWeeks:3,regainKg:1.0,workDrop:1,discWeeks:3,renewFrom:10,thriveWeeks:4};
let RULES=Object.assign({},RULES_DEF);
const RULE_FIELDS=[['silentDays','Silent: days with no Trainerize activity','days'],['plateauWeeks','Plateau: weeks','weeks'],['plateauKg','Plateau: moved less than','kg'],['regainWeeks','Regaining: across','weeks'],['regainKg','Regaining: up at least','kg'],['workDrop','Workouts slipping: below their usual by','sessions'],['discWeeks','Discipline falling: check-ins in a row','check-ins'],['renewFrom','Renewal window: once coach notes are done till week','of 12'],['thriveWeeks','Thriving: check-ins in a row','check-ins']];
const TAGDEF=[
 {id:'silent',label:'Silent',tone:'red'},{id:'missing',label:'Missing check-in',tone:'red'},
 {id:'regain',label:'Regaining',tone:'amber'},{id:'plateau',label:'Plateau',tone:'amber'},
 {id:'work',label:'Workouts slipping',tone:'amber'},{id:'disc',label:'Discipline falling',tone:'amber'},
 {id:'renew',label:'Renewal window',tone:'blue'},{id:'thrive',label:'Thriving',tone:'green'}];

const lastMon=()=>{const ist=new Date(SYNC.getTime()+5.5*36e5),dw=(ist.getUTCDay()+6)%7;return new Date(Date.UTC(ist.getUTCFullYear(),ist.getUTCMonth(),ist.getUTCDate()-dw)-5.5*36e5)};
const median=a=>{const b=a.slice().sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
const kg=v=>(+v).toFixed(1).replace(/\.0$/,'');
function rawTags(c){
  if(c.status!=='Active')return[];
  const R=RULES,out={},ks=ckOf(c),w=c.w,z=TZW[c.id],fl=c.g==='Fat Loss';
  const lastCk=ks.length?ks[ks.length-1].date:null,lastLog=c.daily.length?c.daily[c.daily.length-1].t:null;
  const dsCk=lastCk?Math.floor((SYNC-lastCk)/DAY):99,dsLog=lastLog?Math.floor((SYNC-lastLog)/DAY):99;
  const hasData=ks.length>0||c.daily.length>0; /* no Typeform or Trainerize data pulled yet: nothing to judge */
  if(hasData&&dsCk>=14&&dsLog>=R.silentDays)out.silent=`Last check-in ${dsCk} days ago, nothing on Trainerize for ${dsLog} days`;
  else if(lastCk&&lastCk<lastMon())out.missing=`No check-in for Mon ${fmtS(lastMon())}; last one was ${fmtS(lastCk)}`;
  if(fl&&w.length>R.regainWeeks){const win=w.slice(-(R.regainWeeks+1)),mn=Math.min(...win),up=w[w.length-1]-mn;if(up>=R.regainKg)out.regain=`Weekly average up ${kg(up)} kg over the last ${R.regainWeeks} weeks`}
  if(fl&&!out.regain&&w.length>R.plateauWeeks){const win=w.slice(-(R.plateauWeeks+1)),rg=Math.max(...win)-Math.min(...win);if(rg<R.plateauKg)out.plateau=`Weekly average within ${kg(rg)} kg for ${R.plateauWeeks} weeks (${kg(Math.min(...win))} to ${kg(Math.max(...win))} kg)`}
  if(z&&z.done.length>=4){const us=median(z.done.slice(0,-2)),l2=z.done.slice(-2);if(l2.every(v=>v<=us-R.workDrop))out.work=`${l2.join(' and ')} workouts the last two weeks; usual is ${us}`}
  if(ks.length>R.discWeeks){const d=ks.slice(-(R.discWeeks+1)).map(k=>k.disc);if(d.every((v,i)=>!i||v<=d[i-1])&&d[d.length-1]<d[0])out.disc=`Their rating went ${d.join(' → ')} out of 5`}
  {const nn=(c.notes||[]).map(n=>String(n||'').trim());const upTo=nn.reduce((m,n,i)=>n?i+1:m,0);if(nn[R.renewFrom-1]&&upTo>=R.renewFrom)out.renew=`Coach notes done till week ${upTo}: time for the next-phase conversation`;}
  if(c.comp==='On Track'&&ks.length>=R.thriveWeeks&&!out.work&&!out.plateau&&!out.regain){const l=ks.slice(-R.thriveWeeks);if(l.every(k=>k.disc>=4&&!k.cheat))out.thrive=`Discipline 4+ and no cheat meals for ${R.thriveWeeks} check-ins in a row`}
  if(out.silent){delete out.work;delete out.disc} /* silence explains the rest; keep the tile readable */
  return TAGDEF.filter(t=>out[t.id]).map(t=>Object.assign({why:out[t.id]},t));
}
const isSnoozed=(c,t)=>(((EDITS[c.id]||{}).snooze||{})[t.id]||0)>Date.now();
const tagsOf=c=>rawTags(c).filter(t=>!isSnoozed(c,t));
function snooze(c,id){const t=TAGDEF.find(x=>x.id===id);const sz=Object.assign({},(EDITS[c.id]||{}).snooze||{},{[id]:Date.now()+14*DAY});writeEdit(c.id,{snooze:sz});logEvent({client:c.id,title:'Tag snoozed for 2 weeks',detail:t.label})}
const tagPill=(t,sm)=>`<span class="btag t-${t.tone}${sm?' sm':''}">${esc(t.label)}</span>`;
let TAGOPEN=null;
/* exact labels + colours from the coaches' Numbers sheets (conditional formatting) */
const SKEY=t=>String(t||'').toLowerCase().replace(/[^a-z]/g,'');
const SHEET_ST={tbd:['TBD','#919191','#000'],skip:['Skip','#B41700','#000'],onlycalllink:['Only Call Link','#FFBE99','#000'],datadue:['Data Due','rgba(238,113,158,.9)','#000'],sameweekrepeat:['Same Week Repeat','rgba(255,252,152,.9)','#000'],noshow:['No Show','#B41700','#FEFFFE'],onhold:['On Hold','rgba(255,140,58,.9)','#000'],recheckin:['Recheck-in','rgba(152,239,234,.9)','#000'],audioreview:['💬 Audio Review','#56C1FE','#000'],callneeded:['📞 Call needed','#FF40FF','#000'],calllinksent:['📞 Call Link Sent','#D696F8','#000'],callbooked:['📞 Call Booked','#006B65','#FEFFFE'],mastercall:['📞 Master Call','#4E88DE','#000'],reviewneeded:['🔵 Review needed','rgba(136,204,255,.9)','#000'],markedclosed:['✅ Marked Closed','rgba(175,228,137,.9)','#000'],masterreview:['🔴 Master Review','#FFFFFF','#000'],masterform:['Master Form','rgba(199,87,226,.9)','#000']};
const SHEET_ACT={ontrack:['✅ On Track','rgba(175,228,137,.9)','#000'],supportneeded:['🟡 Support Needed','#F2C230','#000'],mastersupport:['🟠 Master Support','#F08A24','#000'],commitmentweek:['🔴 Commitment Week','#E5342A','#000'],finalcall:['🚨 Final Call','#8E1200','#FEFFFE'],dailycheckins:['🟡 Daily Check-ins','rgba(255,252,152,.9)','#000'],mealpictures:['🟠 Meal Pictures','rgba(255,211,138,.9)','#000'],flagged:['🔴 Flagged','rgba(255,151,129,.9)','#000'],redalert:['🚨 Red Alert','#B41700','#FEFFFE'],keepaneye:['👀 Keep an eye','#F7A3E3','#000'],recheckin:['🔃 Recheckin','rgba(170,148,226,.9)','#000'],movingslow:['🐢 Moving Slow','#99E3D9','#000']};
function sPill(t,kind,coach){const k=SKEY(t);let m=(kind==='act'?SHEET_ACT:SHEET_ST)[k];
  if(m&&kind==='act'&&k==='keepaneye'&&coach==='Harsh')m=[m[0],'#FF40FF','#000'];
  if(!m)m=[t,'var(--fill)','var(--label)'];
  const col=m[1]==='#FFFFFF'?'#E5342A':m[1];const word=m[0].replace(/^[^A-Za-z]+/,'');
  return `<span class="spill" style="--c:${col}"><i></i>${esc(word)}</span>`}
const rk=c=>c.status==='On hold'?8:(RANK[c.comp]??6);
const VIEWS=[['all','All clients'],['att','Needs attention'],['closed','Check-in closed'],['skip','Skipping this week'],['new','Yet to start'],['hold','On hold']];
function tagCounts(){const cnt={};CLIENTS.filter(c=>F.coach==='all'||c.coach===F.coach).forEach(c=>tagsOf(c).filter(t=>t.id!=='renew').forEach(t=>cnt[t.id]=(cnt[t.id]||0)+1));return cnt}
function renderTagChips(){
  const act=[];
  if(F.st)act.push(['st',SHEET_ST[F.st][0].replace(/^[^A-Za-z]+/,'')]);if(F.act)act.push(['act',SHEET_ACT[F.act][0].replace(/^[^A-Za-z]+/,'')]);
  if(F.tag)act.push(['tag',TAGDEF.find(t=>t.id===F.tag).label]);if(F.exp)act.push(['exp','Expired clients']);
  $('#activeF').innerHTML=act.map(([k,l])=>`<button class="af" data-clr="${k}">${esc(l)}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`).join('');
  const nf=(F.st?1:0)+(F.act?1:0)+(F.exp?1:0),fc=$('#fcount');fc.hidden=!nf;fc.textContent=nf;const tc=$('#tcount');tc.hidden=!F.tag;tc.textContent=1;
}
function renderFilters(){
  const cnt=tagCounts();
  const row=(attr,val,label,on,extra='')=>`<button class="frow2 ${on?'on':''}" ${attr}="${val}"><span>${label}</span>${extra}<svg class="ck" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg></button>`;
  const base=CLIENTS.filter(c=>F.coach==='all'||c.coach===F.coach);
  const dot=(col)=>`<i class="tdot" style="background:${col}"></i>`;
  if(FM==='tags'){$('#filtersT').textContent='Tags';
    $('#filtersBody').innerHTML=`${row('data-pt','',`Everything`,!F.tag,`<em>${base.length}</em>`)}${TAGDEF.filter(t=>t.id!=='renew').map(t=>row('data-pt',t.id,`<i class="tdot t-${t.tone}"></i>${t.label}`,F.tag===t.id,`<em>${cnt[t.id]||0}</em>`)).join('')}
    <button class="edit-btn rlink" id="rulesBtn">Edit tag rules</button>`;return}
  $('#filtersT').textContent='Filter';
  const sc=k=>base.filter(c=>SKEY(c.comp)===k).length,ac=k=>base.filter(c=>SKEY(c.sheet.ciAction)===k).length;
  const sw=k=>SHEET_ST[k][0].replace(/^[^A-Za-z]+/,''),aw=k=>SHEET_ACT[k][0].replace(/^[^A-Za-z]+/,'');
  const scol=k=>SHEET_ST[k][1]==='#FFFFFF'?'#E5342A':SHEET_ST[k][1];
  $('#filtersBody').innerHTML=`<h3 class="fsec">Check-in status</h3>${row('data-fs','',`Everything`,!F.st,`<em>${base.length}</em>`)}${ST_ORDER.map(k=>{const n=sc(k);return n?row('data-fs',k,`${dot(scol(k))}${sw(k)}`,F.st===k,`<em>${n}</em>`):''}).join('')}
    <hr class="fdiv">
    <h3 class="fsec">Check-in action</h3>${row('data-fa','',`Everything`,!F.act,`<em>${base.length}</em>`)}${ACT_ORDER.map(k=>{const n=ac(k);return n?row('data-fa',k,`${dot(SHEET_ACT[k][1])}${aw(k)}`,F.act===k,`<em>${n}</em>`):''}).join('')}<hr class="fdiv"><h3 class="fsec">Expired</h3>${row('data-fx','1',`${dot('#C0392B')}Show expired clients`,F.exp,`<em>${XCL.filter(c=>F.coach==='all'||c.coach===F.coach).length}</em>`)}<p class="fnote">Expired clients stay here with their history for 1 year, then they are removed.</p>`;
}
function openRules(){
  $('#rulesBody').innerHTML=RULE_FIELDS.map(([k,l,u])=>`<label class="rl"><span>${l}</span><span class="ri"><input id="r-${k}" type="number" step="${k.endsWith('Kg')?0.1:1}" min="0" value="${RULES[k]}"><em>${u}</em></span></label>`).join('');
  $('#rules').hidden=false;
}

/* ---------- grid ---------- */
let F={view:'all',coach:'all',q:'',tag:null,st:null,act:null,exp:false};let FM='filter';
const ST_ORDER=['masterreview','mastercall','callneeded','reviewneeded','audioreview','calllinksent','callbooked','datadue','sameweekrepeat','onlycalllink','recheckin','noshow','skip','markedclosed','onhold','tbd'];
const ACT_ORDER=['ontrack','keepaneye','supportneeded','mastersupport','commitmentweek','finalcall','dailycheckins','mealpictures','movingslow','recheckin','flagged','redalert'];
function renderCoachSeg(){const n=k=>CLIENTS.filter(c=>k==='all'||c.coach===k).length;
  $('#coachSeg').innerHTML=[['all','All'],['Harsh','Harsh'],['Shrutika','Shrutika']].map(([k,l])=>`<button data-pc="${k}" aria-pressed="${F.coach===k}">${l}<em>${n(k)}</em></button>`).join('')}
function render(){
  renderCoachSeg();
  let list=(F.exp?XCL:CLIENTS).filter(c=>{
    if(F.view==='att'&&!(c.status==='Active'&&RANK[c.comp]<=2))return false;
    if(F.view==='closed'&&c.comp!=='Marked Closed')return false;
    if(F.view==='hold'&&c.status!=='On hold'&&c.comp!=='On Hold')return false;
    if(F.view==='skip'&&c.comp!=='Skip')return false;
    if(F.view==='new'&&c.status!=='New')return false;
    if(F.view==='reply'&&!needsReply(c))return false;
    if(F.coach!=='all'&&c.coach!==F.coach)return false;
    if(F.tag&&!tagsOf(c).some(t=>t.id===F.tag))return false;
    if(F.st&&SKEY(c.comp)!==F.st)return false;
    if(F.act&&SKEY(c.sheet.ciAction)!==F.act)return false;
    if(F.q&&!(c.name+' '+c.email+' '+c.g).toLowerCase().includes(F.q))return false;
    return true;
  }).sort((a,b)=>rk(a)-rk(b)||a.name.localeCompare(b.name));
  const GRP=c=>{if(c.expired)return ['Expired · hidden from the main view',9];const r=rk(c);return r<=2?['Needs you',0]:r===3?['In progress',1]:r===4?['Skipping this week',2]:r===5?['Check-in closed',3]:r===6?['TBD',4]:['On hold',5]};
  let lastG=null;
  $('#grid').innerHTML=list.length?list.map(c=>{
    const g=GRP(c);let head='';if(g[0]!==lastG){lastG=g[0];head=`<div class="gh"><span>${g[0]}</span><em>${list.filter(x=>GRP(x)[0]===g[0]).length}</em></div>`}
    const lv=LEVEL[c.comp]||'none';
    const sig=[];const ca=c.sheet.ciAction;if(ca)sig.push({label:ca,tone:/red alert|flagged|master support|commitment|final call/i.test(ca)?'red':/on track/i.test(ca)?'green':'amber'});if(needsReply(c))sig.push({label:'Needs reply',tone:'red'});tagsOf(c).filter(t=>t.id!=='renew').forEach(t=>sig.push(t));
    const more=sig.length-(ca?1:0);
    return head+`<button class="tile tl" data-id="${c.id}">
      <div class="tl-top"><strong class="tl-name">${esc(c.name)}${c.demo?' <span class="demo">Demo</span>':''}</strong><span class="tl-coach">${c.coach==='Shrutika'?'S':'H'}</span></div>
      <div class="tl-pills">${c.expired?`<span class="spill" style="--c:#C0392B"><i></i>Expired${c.expiredAt?' '+esc(fmtD(new Date(c.expiredAt))):''}</span>`:''}${c.expired?'':sPill(c.comp,'st')}${ca&&SKEY(ca)!=='tbd'?sPill(ca,'act',c.coach):''}${c.sheet.support?`<span class="spill sup"><i></i>${esc(c.sheet.support)}</span>`:''}${more>0?`<span class="tl-more">+${more}</span>`:''}</div>${ladderMark(c)}</button>`;
  }).join(''):`<div class="empty">${LOADED?(CLIENTS.length?"No clients match this view.":"No clients yet. The first sync fills this page."):"Loading clients…"}</div>`;
  renderTagChips();
}

/* ---------- profile ---------- */
let cur=null,tab='overview';
const DAY=864e5,ymd=d=>d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),fmtS=d=>d.toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
let MODE='avg',RANGE={k:'3M'},VIEW=[],G=null,editing=false;
function rangePts(c){
  const all=c.daily,last=all[all.length-1].t;let from=all[0].t,to=last;
  if(RANGE.k==='1M')from=new Date(last-30*DAY);
  if(RANGE.k==='3M')from=new Date(last-90*DAY);
  if(RANGE.k==='Custom'){from=RANGE.from||new Date(Math.max(all[0].t,last-42*DAY));to=RANGE.to||last}
  return all.filter(p=>p.t>=from&&p.t<new Date(+to+DAY));
}
function trendSVG(c,pts){
  if(pts.length<2)return'<p class="foot">Not enough weigh-ins in this range. Try a wider one.</p>';
  const W=640,H=250,L=40,R=14,T=16,B=30,K=MODE==='avg'?'a':'v';
  const t0=+pts[0].t,span=Math.max(+pts[pts.length-1].t-t0,DAY);
  const vs=pts.map(p=>p[K]);let mn=Math.min(...vs)-.4,mx=Math.max(...vs)+.4;
  const gIn=c.target&&c.target>mn-1.2&&c.target<mx+1.2;if(gIn){mn=Math.min(mn,c.target-.3);mx=Math.max(mx,c.target+.3)}
  const rg=mx-mn,step=rg>8?2:rg>3?1:.5;
  const x=t=>L+(t-t0)/span*(W-L-R),y=v=>T+(mx-v)/rg*(H-T-B);
  let g='';for(let v=Math.ceil(mn/step)*step;v<=mx;v+=step)g+=`<line x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="gl"/><text x="${L-7}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${+v.toFixed(1)}</text>`;
  for(let i=0;i<4;i++){const t=t0+span*i/3;g+=`<text x="${x(t).toFixed(1)}" y="${H-9}" text-anchor="${i===0?'start':i===3?'end':'middle'}">${fmtS(new Date(t))}</text>`}
  const line=pts.map((p,i)=>(i?'L':'M')+x(+p.t).toFixed(1)+' '+y(p[K]).toFixed(1)).join(' ');
  const area=line+` L${x(+pts[pts.length-1].t).toFixed(1)} ${H-B} L${L} ${H-B} Z`;
  const goal=gIn?`<line x1="${L}" x2="${W-R}" y1="${y(c.target).toFixed(1)}" y2="${y(c.target).toFixed(1)}" class="goal"/><text x="${W-R}" y="${(y(c.target)-6).toFixed(1)}" text-anchor="end" class="goalt">Goal ${c.target} kg</text>`:'';
  const lp=pts[pts.length-1];
  G={W,H,L,R,T,B,t0,span,x,y,K};
  const body=MODE==='avg'
    ?`<path d="${area}" class="tarea"/><path id="avgLine" d="${line}" class="tline"/>`
    :`<path id="avgLine" d="${line}" class="tline thin"/><g class="tdots">${pts.map(p=>`<circle cx="${x(+p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3"/>`).join('')}</g>`;
  const spk=ckOf(c).filter(k=>k.spike&&k.spike!=='No'&&+k.date>=t0&&+k.date<=t0+span).map((k,i)=>({i,x:x(+k.date),date:k.date,cond:k.cond,n:k.n}));
  G.spk=spk;
  const sp=spk.map(k=>{const X=k.x.toFixed(1);return `<g class="spk" id="spk${k.i}"><line x1="${X}" x2="${X}" y1="${T}" y2="${H-B}"/><path d="M${X-5} ${T-2} L${+X+5} ${T-2} L${X} ${T+6} Z"/></g>`}).join('');
  return `<svg class="tchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${MODE==='avg'?'7-day average':'Daily'} weight from ${fmtS(pts[0].t)} to ${fmtS(lp.t)}">${g}${goal}${sp}${body}
    <circle cx="${x(+lp.t).toFixed(1)}" cy="${y(lp[K]).toFixed(1)}" r="5" class="tend"/>
    <line id="sl" class="sl" x1="0" x2="0" y1="${T}" y2="${H-B}" visibility="hidden"/><circle id="sd" class="sd" r="5" cx="0" cy="0" visibility="hidden"/>
    <rect id="hit" x="${L}" y="0" width="${W-L-R}" height="${H}" fill="transparent"/></svg><div class="tip" id="tip" hidden></div>${spk.length?'<p class="foot spk-key"><span></span>Scale spike reported in a check-in. Hover or tap the line to see the reason.</p>':''}`;
}
function drawTrend(anim){
  const c=cur,box=$('#trend');if(!box||!c.daily.length)return;
  VIEW=rangePts(c);box.innerHTML=trendSVG(c,VIEW);
  const td=$('#tdelta'),K=MODE==='avg'?'a':'v';
  if(td&&VIEW.length>1){const d=+(VIEW[VIEW.length-1][K]-VIEW[0][K]).toFixed(1);td.innerHTML=`<b class="${dcls(c,d)}">${d>0?'+':d<0?'−':'±'}${Math.abs(d).toFixed(1)} kg</b> · ${VIEW.length} weigh-ins`}else if(td)td.textContent='';
  const pl=$('#avgLine');
  if(anim&&pl&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const len=pl.getTotalLength();pl.style.strokeDasharray=len;pl.style.strokeDashoffset=len;pl.getBoundingClientRect();
    pl.style.transition='stroke-dashoffset .7s cubic-bezier(.3,.7,.2,1)';pl.style.strokeDashoffset=0;
    box.classList.remove('in');void box.offsetWidth;box.classList.add('in');
  }
}
function scrub(e){
  const svg=$('.tchart');if(!svg||!G||!VIEW.length)return;
  const r=svg.getBoundingClientRect(),vx=(e.clientX-r.left)/r.width*G.W;
  const t=G.t0+(vx-G.L)/(G.W-G.L-G.R)*G.span;
  document.querySelectorAll('.spk.on').forEach(g=>g.classList.remove('on'));
  const hitS=(G.spk||[]).find(k=>Math.abs(k.x-vx)<9);
  if(hitS){const tip=$('#tip');$('#sl').setAttribute('visibility','hidden');$('#sd').setAttribute('visibility','hidden');$('#spk'+hitS.i)?.classList.add('on');
    tip.hidden=false;tip.classList.add('tip-spk');tip.innerHTML=`<b>Scale spike reported</b><span>Week ${hitS.n} · ${fmtS(hitS.date)}</span><em>${esc(hitS.cond)}</em>`;
    tip.style.left=Math.min(Math.max(hitS.x/G.W*100,18),82)+'%';tip.style.top=(G.T/G.H*100+12)+'%';return}
  $('#tip').classList.remove('tip-spk');
  let i=0,best=Infinity;VIEW.forEach((p,k)=>{const dd=Math.abs(p.t-t);if(dd<best){best=dd;i=k}});
  const p=VIEW[i],val=p[G.K],px=G.x(+p.t),py=G.y(val);
  const sl=$('#sl'),sd=$('#sd'),tip=$('#tip');
  sl.setAttribute('x1',px);sl.setAttribute('x2',px);sl.setAttribute('visibility','visible');
  sd.setAttribute('cx',px);sd.setAttribute('cy',py);sd.setAttribute('visibility','visible');
  tip.hidden=false;tip.innerHTML=`<b>${val.toFixed(1)} kg</b><span>${G.K==='a'?'7-day avg · ':''}${fmtS(p.t)}</span>`;
  const left=Math.min(Math.max(px/G.W*100,14),86);tip.style.left=left+'%';tip.style.top=(py/G.H*100)+'%';
}
function unscrub(){document.querySelectorAll('.spk.on').forEach(g=>g.classList.remove('on'));['#sl','#sd'].forEach(s=>$(s)?.setAttribute('visibility','hidden'));const t=$('#tip');if(t)t.hidden=true}
function numsHTML(c){
  const n=nut(c),d=c.daily,cw=d.length?d[d.length-1]:null,st=d.length?d[0]:null;
  const num=(l,v,sub,cls='')=>`<div class="num"><small>${l}</small><b class="${cls}">${v}</b><span>${sub}</span></div>`;
  let wt;
  if(cw){const dd=+(cw.v-st.v).toFixed(1);
    wt=num('Current weight',cw.v.toFixed(1)+' kg',`${cw.m?'Coach entry':'Trainerize'}, ${fmtS(cw.t)}`)+num('Start weight',st.v.toFixed(1)+' kg',`First log, ${fmtS(st.t)}`)
      +num('Change',(dd>0?'+':dd<0?'−':'±')+Math.abs(dd).toFixed(1)+' kg',`In ${Math.round((cw.t-st.t)/DAY)} days`,dcls(c,dd))
      +num('Goal weight',c.target?c.target+' kg':'—',c.target?`${Math.abs(cw.v-c.target).toFixed(1)} kg to go`:'Set at onboarding call');
  }else wt=num('Current weight','—','No Trainerize logs yet')+num('At onboarding',c.formWeight?c.formWeight+' kg':'—',c.formWeight?'From the form':'Form not matched yet')+num('Change','—','After first weigh-in')+num('Goal weight',c.target?c.target+' kg':'—',c.target?'Set by coach':'Set at onboarding call');
  let nu;
  if(editing)nu=`<form class="nut-form" id="nutForm">
      <label>Calories<input id="nk" type="number" inputmode="numeric" min="800" max="6000" value="${n.kcal??''}"></label>
      <label>Protein (g)<input id="np" type="number" inputmode="numeric" min="0" max="500" value="${n.p??''}"></label>
      <label>Carbs (g)<input id="nc" type="number" inputmode="numeric" min="0" max="900" value="${n.c??''}"></label>
      <label>Fat (g)<input id="nf" type="number" inputmode="numeric" min="0" max="300" value="${n.f??''}"></label>
      <p class="nut-check" id="nutCheck"></p>
      <div class="nut-actions"><button type="button" class="btn" id="nutCancel">Cancel</button><button type="submit" class="btn btn-p">Save</button></div></form>`;
  else{const has=n.kcal!=null,hm=n.p!=null||n.c!=null||n.f!=null,G=v=>v!=null?v+' g':'—',K=(v,m)=>v!=null?v*m+' kcal':'';
    nu=`<div class="nums n4">${num('Calories',has?n.kcal.toLocaleString('en-IN'):'—',has?'kcal per day':'Not set yet')}${num('Protein',G(n.p),K(n.p,4))}${num('Carbs',G(n.c),K(n.c,4))}${num('Fat',G(n.f),K(n.f,9))}</div>${hm?`<p class="foot">Macros add up to ${((n.p||0)*4+(n.c||0)*4+(n.f||0)*9).toLocaleString('en-IN')} kcal${has?` · ${(EDITS[c.id]||{}).nut?'updated by coach':'from the sheet'}`:''}</p>`:''}`}
  return `<div class="ngroup"><div class="ng-h"><h3>Weight</h3></div><div class="nums n4">${wt}</div></div>
    <div class="ngroup ndiv"><div class="ng-h"><h3>Nutrition</h3>${editing?'':'<button class="edit-btn" id="editNut">Edit</button>'}</div>${nu}${c.sheet.kcalText&&!editing?`<p class="foot">Sheet: ${esc(c.sheet.kcalText)}${c.sheet.refeed?' · Refeed / diet break: '+esc(c.sheet.refeed):''}</p>`:''}</div>`;
}
function nutCheck(){
  const k=+$('#nk').value,t=(+$('#np').value)*4+(+$('#nc').value)*4+(+$('#nf').value)*9,diff=t-k;
  $('#nutCheck').innerHTML=`Macros add up to <b>${t.toLocaleString('en-IN')} kcal</b>${Math.abs(diff)>50?` · ${Math.abs(diff)} kcal ${diff>0?'over':'under'} the calorie target`:' · matches the calorie target'}`;
}
/* Check-in ladder: the business SOP. Levels are set by coaches only; the portal keeps the history and prompts. */
const LADDER=['ontrack','keepaneye','supportneeded','mastersupport','commitmentweek','finalcall'];
const LNAME=['On Track','Keep an Eye','Support Needed','Master Support','Commitment Week','Final Call'];
const LDO=['','Audio review','Call with the coach','Call with both coaches','Commitment week agreed on a call','Final call with the head coach'];
const lvOf=t=>LADDER.indexOf(SKEY(t));
function ladderOf(c){
  const all=window.TTL_STORE&&TTL_STORE.weekly?TTL_STORE.weekly(c.id):[];
  const d=new Date(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const thisMon=d.toISOString().slice(0,10);
  const from=c.start?new Date(Date.parse(c.start)-6*864e5).toISOString().slice(0,10):'';
  const past=all.filter(w=>w.week_of<thisMon&&w.week_of>=from).map(w=>{const lv=lvOf(w.act||w.peak);return {wk:w.wk,of:w.week_of,lv,label:lv>=0?LNAME[lv]:(w.act||''),st:w.st||'',sup:w.sup||''}});
  const cur=all.find(w=>w.week_of===thisMon);
  const now=lvOf(c.sheet.ciAction),nowPeak=now;
  const seq=past.map(w=>w.lv).concat([nowPeak]);
  let times=0;seq.forEach((v,i)=>{if(v>=2&&(i===0||seq[i-1]<2))times++});
  const peak=Math.max(-1,...seq),above=seq.filter(v=>v>=2).length;
  let last=null;if(now<2)for(let i=past.length-1;i>=0;i--)if(past[i].lv>=2){last={label:past[i].label,lv:past[i].lv,ago:past.length-i};break}
  const prev=past[past.length-1]||null;
  return {past,now,nowPeak,times,peak,above,last,prev,on:!!(window.TTL_STORE&&TTL_STORE.weeklyOn&&TTL_STORE.weeklyOn())};
}
const agoTxt=n=>n===1?'last week':n+' weeks ago';
function ladderMark(c){if(c.expired)return '';const L=ladderOf(c);return L.last?`<div class="tl-hist" title="Escalated earlier in this phase">↩ ${esc(L.last.label)} ${agoTxt(L.last.ago)}</div>`:''}
function ladderBlock(c){const L=ladderOf(c),now=L.now;
  const node=(lv,label,cap)=>`<div class="ld-n l${lv<0?'x':lv}"><span>${esc(cap)}</span><b>${esc(label||'Not set')}</b></div>`;
  const steps=LNAME.map((n,i)=>`<li class="${i===now?'on':''}${i<now?' done':''} l${i}"><i></i><span>${n}</span></li>`).join('');
  let hint='';
  if(now>=2)hint=`<p class="ld-hint"><b>${LNAME[now]}:</b> ${LDO[now]}. This level is always a call, never only an audio.</p>`;
  if(L.prev&&L.prev.lv>=2&&now===L.prev.lv&&now<5)hint+=`<p class="ld-hint warn"><b>Last week was also ${LNAME[now]}.</b> If nothing has changed, the next step is ${LNAME[now+1]}. You decide.</p>`;
  const tl=L.past.length?`<div class="ld-tl">${L.past.map(w=>node(w.lv,w.label,w.wk?'Wk '+w.wk:fmtD(new Date(w.of)))).join('<em>→</em>')}<em>→</em>${node(L.nowPeak,L.nowPeak>=0?LNAME[L.nowPeak]:(c.sheet.ciAction||''),'Now')}</div>`
    :`<p class="foot">${L.on?'History starts building from the next “Start a new week”. Every week is then kept here for good, even after the client is back On Track.':'History is not switched on yet (one small database step is pending).'}</p>`;
  return `<section class="block ladder"><div class="ng-h"><h3>Check-in ladder</h3><span class="sdate">Set by the coach on the Sheet</span></div>
    <ol class="ld-steps">${steps}</ol>${c.sheet.support?`<p class="ld-sup">Extra support: <b>${esc(c.sheet.support)}</b></p>`:''}${hint}
    ${L.past.length?`<div class="nums n3 ld-nums"><div class="num"><small>Highest level this phase</small><b>${L.peak>=0?LNAME[L.peak]:'—'}</b></div><div class="num"><small>Times escalated</small><b>${L.times}</b></div><div class="num"><small>Weeks at Support Needed or above</small><b>${L.above}</b></div></div>`:''}
    <h4 class="ld-h4">Week by week</h4>${tl}</section>`}
function sheetWeek(c){const r=c.sheet,yn=v=>v==='True'?'Yes':v==='False'?'No':(v||'—');
  return `<section class="block"><div class="ng-h"><h3>This week</h3><span class="sdate">${c.coach}'s check-in sheet</span></div>
    <div class="ckcore c4"><div><small>Check-in status</small><b>${sPill(c.comp,'st')}</b></div><div><small>App check-in</small><b>${yn(r.appCheckin)}</b></div><div><small>Check-in form</small><b>${yn(r.formIn)}</b></div><div><small>Reminder</small><b>${esc(r.reminders||'—')}</b></div></div>
    ${r.ciAction||r.ciNotes||r.programme?`<dl class="kv">${r.ciAction?`<dt>Action</dt><dd>${esc(r.ciAction)}</dd>`:''}${r.support?`<dt>Extra support</dt><dd>${esc(r.support)}</dd>`:''}${r.ciNotes?`<dt>Note</dt><dd>${esc(r.ciNotes)}</dd>`:''}${r.programme?`<dt>Workout programme</dt><dd>${esc(r.programme)}</dd>`:''}</dl>`:''}</section>`}
function wkActPill(c,n){let a=n===c.week?c.sheet.ciAction:'';if(!a||SKEY(a)==='tbd'){const w=(window.TTL_STORE&&TTL_STORE.weekly?TTL_STORE.weekly(c.id):[]).filter(x=>x.wk===n&&(!c.start||x.week_of>=new Date(Date.parse(c.start)-6*864e5).toISOString().slice(0,10))).pop();a=w?(w.act||w.peak||''):''}return a&&SKEY(a)!=='tbd'?' '+sPill(a,'act',c.coach):''}
function sheetNotes(c){const wk=c.notes.map((n,i)=>({n,i})).filter(x=>x.n).reverse();
  return `<section class="block"><div class="ng-h"><h3>Weekly coach notes</h3><span class="sdate">Progress sheet · ${wk.length} of 12 weeks</span></div>${wk.length?`<div class="timeline">${wk.map(({n,i})=>`<div class="note"><span class="wn">Week ${i+1}${wkActPill(c,i+1)}</span><p>${esc(n)}</p></div>`).join('')}</div>`:'<p class="foot">No weekly notes on the sheet yet.</p>'}</section>`}
function dots(n,max=5){return `<span class="dots">${Array.from({length:max},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</span>`}
const CHEV='<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const phLabel=p=>`Phase ${p.n} · ${p.type}`;
function phHead(p,c){const last=c.pn&&p.n===c.pn.n;return `<summary><span class="pn">P${p.n}</span><span class="pt"><b>${esc(p.type)}${last?' <span class="cur">· current</span>':''}</b><span>${new Date(p.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})} · ${esc(p.form)}</span></span>${CHEV}</summary>`}
const HR_CATS=[['hist','Previous History',/tried to achieve these goals|did you make any progress|what progress did you make|elaborate your progress|gained the lost weight|reason of gaining|worked with the nutrition coach|main challenge/i],
 ['med','Medical Conditions',null],
 ['dig','Digestive Health',/digestive health|causes indigestion/i],
 ['bowel','Bowel Health',/bowel health/i],
 ['sleep','Sleep',/sleep|wake up feeling fresh|night time routine/i],
 ['stress','Stress',/stressed|stress levels|binge eat|last time you binged|therapeutic/i],
 ['disc','Discipline',/willing|prepared are you/i],
 ['social','Social Life / Travel',/social|outgoing|eat outside|ordering out|alcohol|travel/i],
 ['supp','Supplements / Meds',/meds|supplement|medicin/i],
 ['notes','Additional Notes',null]];
const HR_RES=['Yes','No','Applicable','Not applicable','Fine','Needs Attention','Low','Medium','High'];
const hrCls=(v,k)=>{v=v||'';if(k==='disc')return /high/i.test(v)?'ok':/low/i.test(v)?'bad':v?'set':'';if(k==='social')return /high/i.test(v)?'warn':/low/i.test(v)?'ok':v?'set':'';if(k==='hist'||k==='supp')return v?'set':'';return /needs attention|high/i.test(v)?'bad':/^(fine|no|not applicable|low)$/i.test(v)?'ok':v?'set':''};
function hrAns(c){const main=(c.phases||[]).find(p=>p.main)||(c.phases||[])[0];const m={};if(main)(main.secs||[]).forEach(s=>s[1].forEach(([t,v])=>{if(!(t in m))m[t]=v}));
  return re=>{for(const t in m)if(re.test(t)&&m[t])return String(m[t]).trim();return ''}}
const hrCut=(s,n=150)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1).replace(/[ ,.;]+\S*$/,'')+'…':s};
const hrNo=v=>!v||/^(no|none|nil|na|n\/a|-|none of the above)$/i.test(String(v).trim());
function hrForm(c,pf,k){const A=hrAns(c);let t='',a='';
  if(k==='med'){const L=(pf.flags||[]).concat((pf.med||[]).filter(m=>!/^none reported$/i.test(m))).filter(x=>!/^(binge eats when stressed|digestion:|medicines \/ supplements:)/i.test(x)).map(x=>x.replace(/^Current: /,''));(c.phases||[]).filter(p=>!p.main&&p.med&&p.med.length).forEach(p=>p.med.forEach(m=>L.push(`Phase ${p.n}: ${m.replace(/^Noticed: /,'')}`)));
    t=L.length?hrCut(L.join('; '),260):'Nothing reported';a=L.length?(L.some(x=>/heart|pregnan|blackout|dizzy|breathless|depress/i.test(x))?'Needs Attention':'Applicable'):'Not applicable'}
  else if(k==='hist'){const tried=A(/^have you ever tried to achieve/i),prog=A(/^did you make any progress/i),what=A(/^what progress did you make/i),kg=A(/how much kgs did you lose/i),tm=A(/how much time did it take/i),reg=A(/gained the lost weight back/i),co=A(/worked with the nutrition coach/i),wk=A(/what worked out best/i);
    if(!tried){t='Not answered'}else if(/^no/i.test(tried)){t='First attempt at this goal';a='No'}
    else{const P=['Tried before'];if(/^no/i.test(prog))P.push('little progress');else if(what)P.push(/wasn.t significant/i.test(what)?'only a few kg, nothing significant':/not much kilos but body changed/i.test(what)?'body changed though the scale barely moved':/lost 10\+/i.test(what)?'lost 10+ kg':/gained good amount of muscle/i.test(what)?'gained good muscle':what.replace(/^I have /i,'').replace(/\.$/,'').toLowerCase());if(kg)P.push(`lost ${String(kg).replace(/\s*kgs?/i,'')} kg${tm?' in '+tm:''}`);if(/^yes/i.test(reg))P.push('regained it');if(/^yes/i.test(co))P.push('had a nutrition coach before');if(wk&&!hrNo(wk))P.push('what worked: '+hrCut(wk,70));t=P.join('; ');a='Yes'}}
  else if(k==='dig'){const v=A(/^how is your digestive health$/i),d=A(/digestive health · detail/i),ind=A(/causes indigestion/i);
    if(hrNo(v)&&hrNo(ind)){t='Nothing reported';a='Not applicable'}else{const P=[];if(!hrNo(v))P.push(v.replace(/I have a bad Acidity\/Reflux issues/i,'Bad acidity/reflux').replace(/Acidity but less frequent/i,'Occasional acidity').replace(/ issues/gi,''));if(d)P.push(hrCut(d,120));if(!hrNo(ind))P.push('indigestion from '+hrCut(ind,60));t=P.join('. ');a=/bad acidity|reflux/i.test(v)?'Needs Attention':'Applicable'}}
  else if(k==='bowel'){const v=A(/^how is your bowel health$/i),d=A(/bowel health · detail/i);
    if(!v){t='Not answered'}else if(/completely normal/i.test(v)&&!d){t='Normal';a='Not applicable'}else{t=[v.replace(/I Feel Constipated Most of the Times/i,'Constipated most of the time').replace(/I am Not in Peace with it/i,'Not at peace with it').replace(/I poop 3 \/ more than 3 times a day/i,'3+ times a day').replace(/It is completely normal/i,'Normal'),d&&hrCut(d,120)].filter(Boolean).join('. ');a=/constipated most/i.test(v)?'Needs Attention':/completely normal/i.test(v)?'Not applicable':'Applicable'}}
  else if(k==='sleep'){const h=A(/how many hours do you sleep/i),am=A(/satisfied with the amount of sleep/i),q=A(/quality of your sleep/i),fr=A(/wake up feeling fresh/i),why=A(/possibilities of you not getting ample sleep/i);
    if(!h&&!am){t='Not answered'}else{let n=0;const P=[];if(h){P.push(h.replace(/Less Than 5/i,'under 5 hours'));if(/less|5-6/i.test(h))n++}if(/^no/i.test(am)){P.push('not enough');n++}if(/^no/i.test(q)){P.push('poor quality');n++}
      if(fr){if(/lethargic|tired|groggy/i.test(fr)){P.push('wakes '+(/lethargic/i.test(fr)?'lethargic':'tired'));n++}else if(/sluggish/i.test(fr))P.push('wakes sluggish');else P.push('wakes fresh')}
      if(why){P.push('reason: '+hrCut(why.replace(/\.,/g,',').replace(/\.$/,''),90).toLowerCase());if(/insomnia|trouble falling/i.test(why))n++}
      t=P.join(', ').replace(/^./,x=>x.toUpperCase());a=n>=3||/insomnia/i.test(why)?'Needs Attention':n?'Applicable':'Not applicable'}}
  else if(k==='stress'){const l=A(/how stressed are you/i),b=A(/binge eat when you are stressed/i),last=A(/last time you binged/i);
    if(!l&&!b){t='Not answered'}else{const P=[];if(l)P.push(l.replace(/Slight but managable/i,'Slight, manageable').replace(/No stress at all/i,'No stress'));if(/^yes/i.test(b))P.push('stress-eats'+(last?' (last binge: '+hrCut(last,40)+')':''));t=P.join('; ');
      a=/out of control/i.test(l)||(/too stressed/i.test(l)&&/^yes/i.test(b))?'Needs Attention':(/too stressed/i.test(l)||/^yes/i.test(b))?'Applicable':'Not applicable'}}
  else if(k==='disc'){const sc=parseInt(A(/how willing\/? ?prepared/i),10),w=A(/what are you willing to do/i);
    if(!isFinite(sc)&&!w){t='Not answered'}else{t=[isFinite(sc)?`Readiness ${sc}/10`:'',w&&hrCut(w,110)].filter(Boolean).join('. ');a=!isFinite(sc)?'':sc>=9?'High':sc>=6?'Medium':'Low'}}
  else if(k==='social'){const so=A(/how social\/? ?outgoing/i),out=A(/how frequently do you eat outside/i),al=A(/alcohol consumption/i),sm=A(/^do you smoke/i);
    if(!so&&!out){t='Not answered'}else{const P=[];if(so)P.push(/party/i.test(so)?'Party-goer':/very frequent/i.test(so)?'Goes out twice+ a week':/hardly/i.test(so)?'Hardly goes out':so);if(out)P.push(/not ordering/i.test(out)?'doesn’t eat out':'eats out '+out.toLowerCase());if(al&&!hrNo(al))P.push('alcohol: '+hrCut(al,50));if(/^yes/i.test(sm))P.push('smokes');t=P.join('; ');
      a=/party|very frequent/i.test(so)||/more than twice/i.test(out)?'High':/hardly/i.test(so)&&/not ordering|once/i.test(out||'once')?'Low':'Medium'}}
  else if(k==='supp'){const tk=A(/currently taking any medicines or supplements/i),wh=A(/which meds\/supplements/i);
    if(!tk&&!wh){t='Not answered'}else if(/^no/i.test(tk)&&!wh){t='None';a='No'}else{t=wh?hrCut(wh,160):'Yes, not specified';a='Yes'}}
  else t='';
  return {t,a}}
function hrHTML(c,pf){const H=(EDITS[c.id]||{}).hr||{};const nrev=HR_CATS.filter(([k])=>H[k]&&H[k].r).length;
  return `<section class="block hr"><div class="ng-h"><h3>Health review · coach copy</h3><span class="sdate">${nrev?nrev+' of '+HR_CATS.length+' confirmed by coach':'Auto-marked from the form · not confirmed yet'}</span></div>
  <p class="foot hr-hint">Results marked <i>Auto</i> come from the form. Pick a result to confirm or change it, and add your own note after the onboarding call.</p>
  <div class="hr-t"><div class="hr-h"><span>Category</span><span>Result</span><span>From the form</span><span>Coach notes</span></div>
  ${HR_CATS.map(([k,l])=>{const e=H[k]||{},f=hrForm(c,pf,k),eff=e.r||f.a,auto=!e.r&&!!f.a;return `<div class="hr-r"><b class="hr-c">${l}</b>
    <label class="hr-res ${hrCls(eff,k)}${auto?' auto':''}"><select data-hrr="${k}" aria-label="${l} result"><option value="">${f.a?'Auto · '+f.a:'Not reviewed'}</option>${HR_RES.map(o=>`<option ${o===e.r?'selected':''}>${o}</option>`).join('')}</select></label>
    <div class="hr-f">${f.t?`<p class="${/^(nothing reported|not answered|none|normal)$/i.test(f.t)?'mut':''}">${esc(f.t)}</p>`:'<span class="mut">—</span>'}</div>
    <textarea class="hr-n" data-hrn="${k}" rows="2" placeholder="Write what it really is…">${esc(e.n||'')}</textarea></div>`}).join('')}</div></section>`}
window.hrForm=hrForm;
function hrSave(c,k,patch){const E0=EDITS[c.id]||{},H=Object.assign({},E0.hr||{});const old=H[k]||{};H[k]=Object.assign({},old,patch,{at:Date.now()});writeEdit(c.id,{hr:H});
  const lab=(HR_CATS.find(x=>x[0]===k)||[])[1];logEvent({client:c.id,title:'Health review · '+lab,detail:patch.r!==undefined?(old.r||'Not reviewed')+' → '+(patch.r||'Not reviewed'):String(patch.n||'Note cleared').slice(0,90)})}
window.hrSave=hrSave;window.HR_CATS=HR_CATS;var HRQ=0;
function body(c){
  const d=delta(c);
  if(tab==='overview'){
    const pf=PF[c.id]||null;
    const rb=c.daily.length?`<div class="rangebar"><div class="seg" role="group" aria-label="Date range">${[['1M','1 month'],['3M','3 months'],['All','All'],['Custom','Custom']].map(([k,l])=>`<button data-r="${k}" aria-pressed="${RANGE.k===k}">${l}</button>`).join('')}</div></div>
      <div class="modebar"><div class="seg" role="group" aria-label="Show">${[['avg','7-day average'],['daily','Daily weigh-ins']].map(([k,l])=>`<button data-m="${k}" aria-pressed="${MODE===k}">${l}</button>`).join('')}</div><span class="tdelta" id="tdelta"></span></div>
      <div class="custom" id="customRow" ${RANGE.k==='Custom'?'':'hidden'}><label for="rFrom">From</label><input type="date" id="rFrom" min="${ymd(c.daily[0].t)}" max="${ymd(c.daily[c.daily.length-1].t)}" value="${ymd(RANGE.from||new Date(Math.max(c.daily[0].t,c.daily[c.daily.length-1].t-42*DAY)))}"><label for="rTo">To</label><input type="date" id="rTo" min="${ymd(c.daily[0].t)}" max="${ymd(c.daily[c.daily.length-1].t)}" value="${ymd(RANGE.to||c.daily[c.daily.length-1].t)}"></div>
      <div class="trend-wrap" id="trend"></div>`:'<p class="foot">No Trainerize weigh-ins pulled yet. The graph starts from their first logged weight.</p>';
    const pfBlock=pf?null:`<section class="block"><div class="src ai">Profile · from onboarding form</div><p class="foot">Onboarding form not matched yet. The profile summary, medical, diet and food restrictions appear here once it is.</p>${c.sheet.nameCheck?`<p class="namechk">${esc(c.sheet.nameCheck)}</p>`:''}</section>`;
    if(pfBlock)return pfBlock+`<section class="block"><div class="blk-h"><div class="src tz">Weight trend · Trainerize</div></div>${rb}</section>
      <section class="block"><div class="bt"><h2>Body and nutrition</h2><span class="sdate">${c.start?'Client since '+fmtD(new Date(c.start)):'Not started yet'}</span></div><div id="nutBody">${numsHTML(c)}</div></section>`;
    const phs=c.phases.slice();
    const phBlock=phs.length?`<div class="phl">${phs.map((p,i)=>`<details class="phx ${i?'old':''}" data-dk="p${p.n}" ${i?'':'open'}>${phHead(p,c)}<div class="phb"><p class="psum">${esc(p.sum||'Summary not written yet.')}</p></div></details>`).join('')}</div>`:`<p class="who">${esc(pf.sum)}</p>`;
    return `<section class="block"><div class="ng-h"><div class="src ai">Profile · Claude summary</div><span class="phchip">Phase ${c.pnum}${c.pset?' · set by coach':''}</span></div>
        ${phBlock}
        <div class="src pfsrc">Health and food · ${c.phases.some(p=>p.med&&p.med.length)?'all forms, latest first':'from '+esc(c.sheet.obForm||'onboarding form')}</div>
        <div class="pf">
          <div class="pf-row"><small>Diet preference</small><div class="pf-v"><span class="cap diet ${dietCls(pf.diet)}">${esc(pf.diet)}</span></div></div>
          <div class="pf-row"><small>Food restrictions</small><div class="pf-v ${pf.allergy?'allergy':''}">${pf.allergy?'<b>Allergy · </b>':''}${esc(pf.food)}</div></div>
        </div></section>
      ${hrHTML(c,pf)}
      ${c.status==='New'?`<div class="newbox">This profile was created from the Typeform onboarding form. It becomes active as soon as ${esc(c.name.split(' ')[0])} is added to the Roster tab of the Google Sheet.</div>`:''}
      <section class="block"><div class="blk-h"><div class="src tz">Weight trend · Trainerize</div></div>${rb}</section>
      <section class="block"><div class="bt"><h2>Body and nutrition</h2><span class="sdate">${c.start?'Client since '+fmtD(new Date(c.start)):'Not on the roster yet'}</span></div><div id="nutBody">${numsHTML(c)}</div></section>`;
  }
  if(tab==='notes'){
    const poa=noteOf(c,'poa'),ex=noteOf(c,'extra');
    const box=(k,title,obj,empty,hint)=>{
      if(EDITN===k)return `<section class="block"><div class="ng-h"><h3>${title}</h3></div>
        <textarea id="nt" class="nt" rows="${k==='poa'?9:5}" placeholder="${hint}">${esc(obj.text)}</textarea>
        <div class="nut-actions"><button type="button" class="btn" id="ntCancel">Cancel</button><button type="button" class="btn btn-p" id="ntSave" data-k="${k}">Save</button></div></section>`;
      return `<section class="block"><div class="ng-h"><h3>${title}</h3>${obj.text?`<button class="edit-btn" data-ne="${k}">Edit</button>`:''}</div>
        ${obj.text?`<p class="ntext">${esc(obj.text)}</p>${obj.at?`<span class="nmeta">Updated ${esc(obj.at)}</span>`:''}`
          :`<p class="foot">${empty}</p><div><button class="btn btn-p" data-ne="${k}">Write ${title.toLowerCase()}</button></div>`}</section>`;
    };
    const weeks=c.notes.map((n,i)=>({n,i})).reverse();
    return box('poa','Plan of action · Phase '+c.pnum,poa,'No plan of action written for this phase yet.','Write the plan for this phase: targets, calories, training, habits, what to watch.')
      +`<section class="block"><div class="src ai">Summary of coach notes · Claude</div>${c.nsum?`<p class="nsum">${esc(c.nsum)}</p>`:'<p class="foot">Appears once weekly notes start coming in from the sheet.</p>'}</section>`
      +((c.sheet.clientStatus||c.sheet.weeklyNote)?`<section class="block"><div class="ng-h"><h3>Current action</h3><span class="sdate">Progress sheet</span></div>${c.sheet.clientStatus?`<span class="tag action-tag">${esc(c.sheet.clientStatus)}</span>`:''}${c.sheet.weeklyNote?`<p class="ntext">${esc(c.sheet.weeklyNote)}</p>`:''}</section>`:'')
      +box('extra','Extra notes',ex,'Anything worth remembering that is not part of the plan.','Preferences, context, things to keep in mind...');
  }
  if(tab==='checkins'){
    const ks=ckOf(c);
    if(!ks.length)return sheetWeek(c)+ladderBlock(c)+`<div class="block"><p class="foot">Typeform check-ins not matched yet. Each Monday's check-in will appear here as a week tile.</p></div>`+sheetNotes(c);
    const L=ks[ks.length-1],R=CKREAD[c.id]||{},prev=ks[ks.length-2];
    const flags=[];
    if(L.guidance)flags.push(['red',`Asked for guidance${L.discuss?' · wants a '+L.discuss.toLowerCase():''}`]);
    if(L.disc<=2)flags.push(['red',`Discipline ${L.disc}/5${L.disc<=Math.min(...ks.map(k=>k.disc))?', lowest of the phase':''}`]);
    let streak=0;for(let i=ks.length-1;i>=0&&ks[i].cheat;i--)streak++;
    if(streak>=2)flags.push(['amber',`Cheat meal ${streak} weeks in a row`]);
    if(L.spike&&L.spike!=='No')flags.push(['amber',`Scale spike reported · ${L.cond}`]);
    const replied=REPLIED[c.id+'-'+L.n];
    const latest=`<section class="block"><h3 class="lch">Latest check-in <span>· Mon ${fmtS(L.date)}</span></h3>
      <p class="nsum">${esc(R.text||'')}</p>
      ${flags.length?`<div class="flags">${flags.map(([t,f])=>`<span class="fl ${t}">${esc(f)}</span>`).join('')}</div>`:''}
      ${L.guidance?`<div class="ask ${replied?'done':''}"><small>${esc(c.name.split(' ')[0])} asked</small><p>“${esc(L.guidance)}”</p></div>`:''}
      ${R.trend?`<div class="sub"><h4>Trend</h4><p>${esc(R.trend)}</p></div>`:''}
      ${R.action?`<div class="act"><h4>Take action</h4><p>${esc(R.action)}</p></div>`:''}
      ${R.level?`<div class="sug"><span>Suggested level</span><span class="pill c-${LEVEL[R.level]}">${esc(R.level)}</span><span class="nmeta">${R.level===c.comp?'Same as current':'Current: '+esc(c.comp)}</span></div>`:''}
    </section>`;
    const cell=(k)=>k;
    const trends=`<section class="block"><div class="ng-h"><h3>Every week</h3><span class="sdate">Questions asked in every check-in</span></div>
      <div class="tr-wrap"><table class="tr"><thead><tr><th></th>${ks.map(k=>`<th>W${k.n}</th>`).join('')}</tr></thead><tbody>
      <tr><th>Discipline</th>${ks.map(k=>`<td><span class="db" style="--h:${k.disc*20}%" data-l="${k.disc<=2?'lo':k.disc===3?'mid':'hi'}"></span><b>${k.disc}</b></td>`).join('')}</tr>
      <tr><th>Cheat meal</th>${ks.map(k=>`<td>${k.cheat?'<span class="dot amber"></span>':'<span class="dash">–</span>'}</td>`).join('')}</tr>
      <tr><th>Scale spike</th>${ks.map(k=>`<td>${k.spike&&k.spike!=='No'?`<span class="dot amber"></span>`:'<span class="dash">–</span>'}</td>`).join('')}</tr>
      </tbody></table></div>
      <p class="foot">Discipline is the client's own weekly rating out of 5. Spikes are also marked on the weight graph.</p></section>`;
    if(CKSEL!=null){
      const i=ks.findIndex(k=>k.n===CKSEL),k=ks[i];if(!k){CKSEL=null;return body(c)}
      const wAt=t=>{if(!c.daily.length)return null;let b=null,bd=Infinity;c.daily.forEach(p=>{const dd=Math.abs(p.t-t);if(dd<bd){bd=dd;b=p}});return bd<4*DAY?b:null};
      const tz=tzWeek(c,k.n),w0=wAt(+k.date),wp=i>0?wAt(+ks[i-1].date):null,wd=w0&&wp?+(w0.a-wp.a).toFixed(1):null;
      const nav=`<div class="ckdnav"><button class="btn" id="ckBack"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg> All check-ins</button>
        <div class="ckpn"><button class="close" data-ck="${i>0?ks[i-1].n:''}" ${i>0?'':'disabled'} aria-label="Previous week"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 6-6 6 6 6"/></svg></button><button class="close" data-ck="${i<ks.length-1?ks[i+1].n:''}" ${i<ks.length-1?'':'disabled'} aria-label="Next week"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 6 6 6-6 6"/></svg></button></div></div>`;
      const lv=k.disc<=2?'lo':k.disc===3?'mid':'hi';
      return nav+`<section class="block ckhero"><span class="sdate">Mon ${fmtS(k.date)} · check-in ${k.n} of ${ks.length}</span><h2>Week ${k.n}</h2><p class="ckth">${esc(k.theme)}</p>
          <div class="ckcore c4">
            <div><small>Discipline</small><b class="dl-${lv}">${k.disc} / 5</b><span>Their own rating</span></div>
            <div><small>Cheat meal</small><b>${k.cheat?'Yes':'No'}</b></div>
            <div><small>Scale spike</small><b>${k.spike}</b></div>
            <div><small>Reason</small><b class="rsn">${k.spike!=='No'?esc(k.cond):'—'}</b></div>
          </div>
          <div class="tzrow"><span class="src tz">Trainerize · this week</span><div class="ckcore">
            <div><small>Weight (7-day avg)</small><b>${w0?w0.a.toFixed(1)+' kg':'—'}</b>${wd!=null?`<span class="${dcls(c,wd)}">${wd>0?'+':wd<0?'−':'±'}${Math.abs(wd).toFixed(1)} kg vs last week</span>`:''}</div>
            <div><small>Average steps</small><b>${tz?tz.steps.toLocaleString('en-IN'):'—'}</b><span>Daily average</span></div>
            <div><small>Workouts</small>${tz?`<span class="wdots" aria-label="${tz.done} workouts logged">${'<i class="on"></i>'.repeat(tz.done)}</span><span>${tz.done} logged</span>`:'<b>—</b>'}</div>
          </div></div></section>
        <section class="block"><div class="ng-h"><h3>Coach note</h3><span class="sdate">Google Sheet</span></div>${c.notes[k.n-1]?`<p class="ntext">${esc(c.notes[k.n-1])}</p>`:'<p class="foot">No note written for this week yet.</p>'}</section>
        <section class="block"><div class="ng-h"><h3>Compliance</h3></div>
          ${k.area?`<dl class="kv"><dt>Not compliant with</dt><dd>${esc(k.area)}</dd><dt>Why</dt><dd>${esc(k.why)}</dd><dt>How it felt</dt><dd>${esc(k.feel)}</dd>${k.cheat?`<dt>Cheat meal</dt><dd>${esc(k.cheat)}</dd>`:''}</dl>`:`<p class="foot">Fully compliant this week.${k.cheat?' Cheat meal: '+esc(k.cheat):''}</p>`}</section>
        <section class="block"><div class="ng-h"><h3>${esc(k.theme)}</h3><span class="sdate">This week's questions</span></div><dl class="kv">${k.qa.map(([q,a])=>`<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join('')}</dl></section>
        ${k.guidance?`<section class="block"><div class="ng-h"><h3>Asked the coach</h3></div><div class="ask"><p>“${esc(k.guidance)}”</p><span class="nmeta">Wants to discuss by ${esc(k.discuss).toLowerCase()}</span></div></section>`:''}`;
    }
    const weeks=`<section class="block"><div class="ng-h"><h3>All check-ins</h3><span class="sdate">${ks.length} received</span></div>
      <div class="ckgrid">${ks.slice().reverse().map(k=>{const lv=k.disc<=2?'lo':k.disc===3?'mid':'hi';return `<button class="cktile" data-ck="${k.n}">
        <div class="ckt-top"><b>Week ${k.n}</b><span class="dpill dl-${lv}">${k.disc}/5</span></div>
        <span class="ckt-d">${fmtS(k.date)}</span>${(()=>{const z=tzWeek(c,k.n);return z?`<span class="ckt-tz">${(z.steps/1000).toFixed(1)}k avg steps</span><span class="wdots sm" aria-label="${z.done} workouts logged">${'<i class="on"></i>'.repeat(z.done)}</span>`:''})()}<span class="ckt-th">${esc(k.theme)}</span>
        <div class="ckt-ic">${k.cheat?'<span class="ic amber" title="Cheat meal">Cheat</span>':''}${k.spike!=='No'?`<span class="ic amber" title="Scale spike">Spike</span>`:''}${k.guidance?'<span class="ic red" title="Asked for guidance">Asked</span>':''}${!k.cheat&&k.spike==='No'&&!k.guidance?'<span class="ic ok">Clean week</span>':''}</div></button>`}).join('')}</div></section>`;
    return sheetWeek(c)+ladderBlock(c)+latest+trends+weeks;
  }
  if(tab==='onboarding'){
    if(c.phases.length){const phs=c.phases.slice().reverse();
      return `<div class="ng-h"><div class="src tf">Typeform · ${phs.length} form${phs.length>1?'s':''}, one per phase</div><div class="phtools"><button class="edit-btn" id="obAll">Expand all</button></div></div><div class="phl">`+phs.map((p,i)=>`<details class="phx ${i?'old':''}" data-dk="p${p.n}" ${i?'':'open'}>${phHead(p,c)}<div class="phb">${p.sum?`<p class="psum">${esc(p.sum)}</p>`:''}${p.secs.map(([sec,rows],j)=>`<details class="obs" data-dk="p${p.n}s${j}"><summary>${esc(sec)}<small>${rows.length} answers</small>${CHEV}</summary><dl class="kv">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`).join('')}</div></details>`).join('')+'</div>';}
    if(!c.obs)return`<div class="block"><p class="foot">Onboarding form not matched yet.</p></div>`;
    return `<div class="src tf">Typeform · ${esc(c.sheet.obForm||'Onboarding form')}${c.sheet.obDate?' · submitted '+fmtD(new Date(c.sheet.obDate)):''}</div>`+c.obs.map(([sec,rows])=>`<section class="block"><h3 class="obh">${esc(sec)}</h3><dl class="kv">${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>`).join('');
  }
}
function openP(id){
  cur=ALLC().find(c=>c.id===id);if(!cur)return;tab='overview';DOPEN=null;RANGE={k:'3M'};editing=false;EDITN=null;CKSEL=null;TAGOPEN=null;paint();
  $('#scrim').hidden=false;document.body.style.overflow='hidden';$('#sheet').scrollTop=0;
  setTimeout(()=>$('.close')?.focus(),30);
}
let DOPEN=null;
function paint(){
  const c=cur,lv=LEVEL[c.comp]||'none';
  const prevOpen=DOPEN&&DOPEN.id===c.id+tab?DOPEN.keys:null;
  const tabs=[['overview','Profile'],['notes','Coach notes'],['checkins','Check-ins'],['onboarding','Onboarding']];
  $('#sheet').innerHTML=`<div class="s-head"><div class="s-head-in">
    <button class="close back" aria-label="Back to all clients"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>All clients</button>
    <div class="s-row"><span class="av ${c.coach==='Shrutika'?'s':''}">${initials(c.name)}</span>
      <div class="s-title"><h2 id="p-name">${esc(c.name)}${c.demo?' <span class="demo">Demo</span>':''}</h2>
      <div class="s-meta"><label class="phchip gsel" title="${c.pset?'Phase set by coach':'Phase from forms · tap to change'}"><span class="sr">Phase</span><select id="phSel">${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${i+1===c.pnum?'selected':''}>Phase ${i+1}</option>`).join('')}</select><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></label><span>${esc(c.prog)}</span><span>${esc(c.phase)}</span>${c.coach?`<span>Coach ${c.coach}</span>`:''}${c.week?`<span>Week ${c.week}${c.week<=12?' of 12':''}</span>`:''}</div>
      <div class="hp"><label class="cap gsel ${gcls(c.g)}" title="Change goal"><span class="sr">Goal</span><select id="goalSel">${GOAL_LIST.map(g=>`<option ${g===c.g?'selected':''}>${g}</option>`).join('')}${GOAL_LIST.includes(c.g)?'':'<option selected disabled>Goal not set</option>'}</select><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></label>${sPill(c.comp,'st')}${c.sheet.ciAction&&SKEY(c.sheet.ciAction)!=='tbd'?sPill(c.sheet.ciAction,'act',c.coach):''}</div>
      ${(()=>{const tg=tagsOf(c);if(!tg.length)return'';const o=tg.find(t=>t.id===TAGOPEN);return `<div class="ptags">${tg.map(t=>`<button class="btag t-${t.tone} ${TAGOPEN===t.id?'on':''}" data-tg="${t.id}">${esc(t.label)}</button>`).join('')}</div>${o?`<div class="tagwhy"><span><b>${esc(o.label)}.</b> ${esc(o.why)}</span><button class="edit-btn" data-snz="${o.id}">Snooze 2 weeks</button></div>`:''}`})()}</div>
      </div>
    ${c.expired?`<div class="xban"><div><b>Expired${c.expiredAt?' on '+esc(fmtD(new Date(c.expiredAt))):''}</b><span>History and notes are kept until ${c.expiredAt?esc((d=>{d.setFullYear(d.getFullYear()+1);return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})})(new Date(c.expiredAt))):'1 year after expiry'}, then removed everywhere.</span></div><button class="edit-btn" id="xReact">Move back · Reactivate</button></div>`:''}
    <div class="tabs" role="tablist" aria-label="Profile sections">${tabs.map(([k,l])=>`<button role="tab" data-t="${k}" aria-selected="${tab===k}">${l}</button>`).join('')}</div>
  </div></div><div class="s-body">${body(c)}</div>`;
  const ds=[...$('#sheet').querySelectorAll('details[data-dk]')];
  if(prevOpen)ds.forEach(d=>d.open=prevOpen.has(d.dataset.dk));
  const save=()=>{DOPEN={id:c.id+tab,keys:new Set(ds.filter(d=>d.open).map(d=>d.dataset.dk))}};save();
  ds.forEach(d=>d.addEventListener('toggle',save));
  const oa=$('#obAll');if(oa){const sync=()=>oa.textContent=ds.every(d=>d.open)?'Collapse all':'Expand all';sync();ds.forEach(d=>d.addEventListener('toggle',sync));
    oa.onclick=()=>{const o=!ds.every(d=>d.open);ds.forEach(d=>d.open=o);save();sync()}}
  if(tab==='overview')requestAnimationFrame(()=>drawTrend(true));
}
function closeP(){$('#scrim').hidden=true;document.body.style.overflow='';const t=document.querySelector(`.tile[data-id="${cur?.id}"]`);t?.focus()}

/* ---------- events ---------- */
document.addEventListener('click',e=>{if(XOPEN)return;if(e.target.closest('#xReact')&&cur){const id=cur.id;XS.open();XS.react(id);return}if(e.target.closest('#openSheet')){XS.open();return}if(e.target.closest('#refreshBtn')){(DB&&DB.reload?DB.reload():Promise.resolve()).then(()=>portalRefresh(true),()=>toast('Could not refresh. Check your connection.'));return}
  const t=e.target.closest('.tile');if(t)return openP(t.dataset.id);
  const s=e.target.closest('.chip[data-f]');if(s){F.view=s.dataset.f;document.querySelectorAll('.chip[data-f]').forEach(b=>b.setAttribute('aria-pressed',b===s));return render()}
  const tgb=e.target.closest('[data-tg]');if(tgb){TAGOPEN=TAGOPEN===tgb.dataset.tg?null:tgb.dataset.tg;const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;return}
  const sz=e.target.closest('[data-snz]');if(sz){snooze(cur,sz.dataset.snz);TAGOPEN=null;render();const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;return}
  const tcb=e.target.closest('[data-tag]');if(tcb){F.tag=F.tag===tcb.dataset.tag?null:tcb.dataset.tag;render();return}
  const dgb=e.target.closest('[data-dg]');if(dgb){F.tag=dgb.dataset.dg;render();if(VIEWM==='updates')document.querySelector('[data-v="clients"]').click();$('#grid').scrollIntoView({behavior:'smooth',block:'start'});return}
  if(e.target.closest('#filterBtn')){FM='filter';renderFilters();$('#filters').hidden=false;return}
  if(e.target.closest('#tagsBtn')){FM='tags';renderFilters();$('#filters').hidden=false;return}
  const fsb=e.target.closest('[data-fs]');if(fsb){F.st=fsb.dataset.fs||null;render();renderFilters();return}
  const fxb=e.target.closest('[data-fx]');if(fxb){F.exp=!F.exp;render();renderFilters();return}
  const fab=e.target.closest('[data-fa]');if(fab){F.act=fab.dataset.fa||null;render();renderFilters();return}
  if(e.target.closest('#filtersX')||e.target.id==='filters'||e.target.id==='filtersDone'){$('#filters').hidden=true;return}
  if(e.target.id==='filtersClear'){if(FM==='tags')F.tag=null;else{F.st=null;F.act=null;F.exp=false}render();renderFilters();return}
  const pfb=e.target.closest('[data-pf]');if(pfb){F.view=pfb.dataset.pf;render();renderFilters();return}
  const ptb=e.target.closest('[data-pt]');if(ptb){F.tag=!ptb.dataset.pt||F.tag===ptb.dataset.pt?null:ptb.dataset.pt;render();renderFilters();return}
  const pcb=e.target.closest('[data-pc]');if(pcb){F.coach=pcb.dataset.pc;render();if(!$('#filters')||!$('#filters').hidden)renderFilters();return}
  const clr=e.target.closest('[data-clr]');if(clr){const k=clr.dataset.clr;if(k==='view')F.view='all';if(k==='st')F.st=null;if(k==='act')F.act=null;if(k==='tag')F.tag=null;if(k==='exp')F.exp=false;if(k==='coach')F.coach='all';render();return}
  if(e.target.closest('#rulesBtn')){$('#filters').hidden=true;openRules();return}
  if(e.target.closest('#rulesX')||e.target.id==='rules'){$('#rules').hidden=true;return}
  if(e.target.id==='rulesReset'){RULES=Object.assign({},RULES_DEF);openRules();return}
  if(e.target.id==='rulesSave'){RULE_FIELDS.forEach(([k])=>{const v=parseFloat($('#r-'+k).value);if(Number.isFinite(v)&&v>=0)RULES[k]=v});if(DB)DB.doc('settings/rules').set(Object.assign({},RULES)).catch(()=>toast('Could not save the rules.'));$('#rules').hidden=true;logEvent({title:'Tag rules updated',detail:'Thresholds changed on the Rules panel'});render();return}
  const fo=e.target.closest('[data-open]');if(fo){openP(fo.dataset.open);return}
  const ffb=e.target.closest('[data-ff]');if(ffb){FF=ffb.dataset.ff;document.querySelectorAll('[data-ff]').forEach(b=>b.setAttribute('aria-pressed',b===ffb));renderFeed();return}
  if(e.target.id==='feedSeen'){markSeen();return}
  const vb=e.target.closest('[data-v]');if(vb){VIEWM=vb.dataset.v;document.querySelectorAll('[data-v]').forEach(b=>b.setAttribute('aria-selected',b===vb));document.querySelector('main.wrap').dataset.view=VIEWM;if(VIEWM==='updates')setTimeout(markSeen,1500);return}
  const ckb=e.target.closest('[data-ck]');if(ckb){if(ckb.dataset.ck){CKSEL=+ckb.dataset.ck;paint();$('#sheet').scrollTop=0}return}
  if(e.target.closest('#ckBack')){CKSEL=null;paint();$('#sheet').scrollTop=0;return}
  if(e.target.id==='markReplied'){const ks=ckOf(cur);REPLIED[cur.id+'-'+ks[ks.length-1].n]=1;try{localStorage.setItem('ttl-replied',JSON.stringify(REPLIED))}catch(_){}render();const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;return}
  const ne=e.target.closest('[data-ne]');if(ne){EDITN=ne.dataset.ne;const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;const t=$('#nt');if(t){t.focus();t.setSelectionRange(t.value.length,t.value.length)}return}
  if(e.target.id==='ntCancel'){EDITN=null;const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;return}
  if(e.target.id==='ntSave'){saveNote(cur,e.target.dataset.k,$('#nt').value);EDITN=null;render();const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;return}
  const mbt=e.target.closest('[data-m]');if(mbt){MODE=mbt.dataset.m;document.querySelectorAll('[data-m]').forEach(b=>b.setAttribute('aria-pressed',b===mbt));unscrub();drawTrend(true);return}
  const rbt=e.target.closest('[data-r]');if(rbt){RANGE.k=rbt.dataset.r;document.querySelectorAll('[data-r]').forEach(b=>b.setAttribute('aria-pressed',b===rbt));$('#customRow').hidden=RANGE.k!=='Custom';unscrub();drawTrend(true);return}
  if(e.target.id==='editNut'){editing=true;const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;nutCheck();$('#nk').focus();return}
  if(e.target.id==='nutCancel'){editing=false;const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;return}
  const cb=e.target.closest('.seg button[data-c]');if(cb){F.coach=cb.dataset.c;document.querySelectorAll('.seg button[data-c]').forEach(b=>b.setAttribute('aria-pressed',b===cb));return render()}
  const tb=e.target.closest('.tabs button');if(tb){tab=tb.dataset.t;EDITN=null;editing=false;CKSEL=null;paint();$('#sheet').scrollTop=0;return}
  if(e.target.closest('.close')||e.target.id==='scrim')closeP();
});
document.addEventListener('change',e=>{if(XOPEN)return;if(cur&&e.target.dataset&&e.target.dataset.hrr!==undefined){HRQ=Date.now();{const v=e.target.value,au=(e.target.options[0].text.match(/^Auto · (.+)$/)||[])[1]||'';e.target.parentElement.className='hr-res '+(v?hrCls(v,e.target.dataset.hrr):hrCls(au,e.target.dataset.hrr)+(au?' auto':''))}hrSave(cur,e.target.dataset.hrr,{r:e.target.value});return}if(cur&&e.target.dataset&&e.target.dataset.hrn!==undefined){const v=e.target.value.trim();if(v!==((((EDITS[cur.id]||{}).hr||{})[e.target.dataset.hrn]||{}).n||'')){HRQ=Date.now();hrSave(cur,e.target.dataset.hrn,{n:v})}return}if(e.target.id==='feedType'){FF=e.target.value;renderFeed();return}if(e.target.id==='phSel'&&cur){setPhase(cur,+e.target.value);render();const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st;return}if(e.target.id==='goalSel'&&cur){setGoal(cur,e.target.value);render();const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st}});
document.addEventListener('input',e=>{if(XOPEN)return;
  if(['nk','np','nc','nf'].includes(e.target.id))nutCheck();
  if(e.target.id==='rFrom'||e.target.id==='rTo'){const f=$('#rFrom').value,t=$('#rTo').value;if(f&&t&&f<=t){RANGE.from=new Date(f+'T00:00:00+05:30');RANGE.to=new Date(t+'T00:00:00+05:30');unscrub();drawTrend(true)}}
});
document.addEventListener('submit',e=>{if(e.target.id!=='nutForm')return;e.preventDefault();
  const v={kcal:+$('#nk').value,p:+$('#np').value,c:+$('#nc').value,f:+$('#nf').value};
  if(Object.values(v).some(x=>!Number.isFinite(x)||x<0)||v.kcal<800){$('#nutCheck').innerHTML='<b class="up">Enter calories of at least 800 and macros in grams.</b>';return}
  logEvent({client:cur.id,title:'Nutrition updated',detail:`${v.kcal} kcal · P ${v.p} · C ${v.c} · F ${v.f}`});
  writeEdit(cur.id,{nut:{p:v.p,c:v.c,f:v.f}});syncKcal(cur,v.kcal,'Nutrition updated in profile');
  editing=false;const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st});
document.addEventListener('pointermove',e=>{if(e.target.id==='hit')scrub(e)});
document.addEventListener('pointerdown',e=>{if(e.target.id==='hit')scrub(e)});
document.addEventListener('pointerout',e=>{if(e.target.id==='hit')unscrub()});
document.addEventListener('keydown',e=>{if(XOPEN)return;if(e.key==='Escape'&&!$('#rules').hidden){$('#rules').hidden=true;return}if(e.key==='Escape'&&!$('#filters').hidden){$('#filters').hidden=true;return}if(e.key==='Escape'&&!$('#scrim').hidden)closeP()});
$('#q').addEventListener('input',e=>{F.q=e.target.value.trim().toLowerCase();render()});
/* ---------- recent updates feed ----------
   Two kinds of events: those the nightly sync writes (forms in, check-ins, Trainerize/Sheet pulls, Claude summaries)
   and those coaches make in the portal (goal, nutrition, plan of action, notes). Demo keeps portal events in this browser;
   live version writes every event to the portal's shared store so all coaches see one feed. */
const IST=(d)=>new Date(d+'+05:30');
const SEED=[];
let SEEN=0;try{SEEN=+localStorage.getItem('ttl-feed-seen')||0}catch(e){}
let FF='all',VIEWM='clients';
function dayKey(d){return d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})}
function logEvent(e){const item=Object.assign({},e,{t:Date.now(),by:ME||null,kind:'coach',src:'portal'}),k=dayKey(new Date());
  const doc={day:k,items:[item].concat((FEEDDOC[k]||{}).items||[]).slice(0,300)};FEEDDOC[k]=doc;renderFeed();
  if(DB)DB.doc('feed/'+k).set(doc).catch(()=>{});}
function feedItems(){const out=[];Object.values(FEEDDOC).forEach(d=>(d.items||[]).forEach(x=>out.push(Object.assign({},x,{t:new Date(x.t)}))));return out}
async function resolveProfiles(){if(!USER)return;const ids=[...new Set(feedItems().map(x=>x.by).filter(Boolean))];if(!ids.length)return;try{PROF=await USER.profiles(ids);renderFeed()}catch(_){}}
const FICON={
 tf:['Typeform','<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'],
 sheet:['Google Sheet','<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16"/>'],
 tz:['Trainerize','<path d="M4 14h3l2-5 3 9 2-6 2 2h4"/>'],
 claude:['Claude','<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'],
 portal:['Portal','<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>']
};
function dayLabel(d){const n=new Date(),k=x=>x.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
  if(k(d)===k(n))return'Today';const y=new Date(n-864e5);if(k(d)===k(y))return'Yesterday';
  return d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Kolkata'})}
const tOf=d=>d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'});
function tagEvents(){const t=META.at?new Date(META.at):new Date(),cnt={},who=new Set();CLIENTS.forEach(c=>rawTags(c).filter(g=>g.id!=='renew').forEach(g=>{cnt[g.id]=(cnt[g.id]||0)+1;who.add(c.id)}));if(!who.size)return[];
  return[{t,kind:'tags',src:'claude',title:`Tagged ${who.size} clients`,detail:TAGDEF.filter(g=>cnt[g.id]).map(g=>`${g.label} ${cnt[g.id]}`).join(' · ')}]}
function digestHTML(){const cnt={};CLIENTS.forEach(c=>tagsOf(c).forEach(t=>cnt[t.id]=(cnt[t.id]||0)+1));const used=TAGDEF.filter(t=>cnt[t.id]);if(!used.length)return'';
  return `<div class="digest"><div class="dg-h"><b>Monday digest</b><span>${dayLabel((()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return d})())} · from the latest sync</span></div><div class="dg-g">${used.map(t=>`<button class="dg t-${t.tone}" data-dg="${t.id}"><b>${cnt[t.id]}</b><span>${t.label}</span></button>`).join('')}</div></div>`}
function renderFeed(){
  const all=feedItems().concat(tagEvents()).sort((a,b)=>b.t-a.t);
  const unread=all.filter(e=>+e.t>SEEN).length;
  const b=$('#vbadge');if(b){b.hidden=!unread;b.textContent=unread}
  const list=all.filter(e=>FF==='all'||e.kind===FF);
  let html='',last='';
  list.forEach(e=>{const dl=dayLabel(e.t);if(dl!==last){html+=`<h3 class="fday">${dl}</h3>`;last=dl}
    const c=e.client?CLIENTS.find(x=>x.id===e.client):null,ic=FICON[e.src]||FICON.portal;
    const tag=c?'button':'div';
    html+=`<${tag} class="fi ${+e.t>SEEN?'unread':''} ${e.flag?'flag':''} ${e.tone?'tg-'+e.tone:''}" ${c?`data-open="${c.id}"`:''}>
      <span class="fic s-${e.src}" title="${ic[0]}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic[1]}</svg></span>
      <span class="fb"><span class="ft">${esc(e.title)}${c?` · <b>${esc(c.name)}</b>`:''}</span>${e.detail?`<span class="fd">${esc(e.detail)}</span>`:''}
      <span class="fm">${tOf(e.t)} · ${ic[0]}${e.by?' · '+esc(e.by===ME?'You':((PROF[e.by]||{}).name||'A coach')):(e.who?' · '+esc(e.who):'')}</span></span></${tag}>`});
  $('#feedList').innerHTML=html||'<p class="foot">Nothing here yet.</p>';
  const ms=$('#feedSeen');if(ms)ms.hidden=!unread;
}
function markSeen(){SEEN=Date.now();try{localStorage.setItem('ttl-feed-seen',String(SEEN))}catch(_){}renderFeed()}

function portalRefresh(manual){editing=false;EDITN=null;rebuild();renderFeed();if(window.XS)XS.refresh();
  if(cur&&!$('#scrim').hidden){const id=cur.id;cur=ALLC().find(x=>x.id===id);if(cur){const st=$('#sheet').scrollTop;paint();$('#sheet').scrollTop=st}}
  if(manual){const b=$('#refreshBtn');if(b){b.classList.remove('spin');void b.offsetWidth;b.classList.add('spin')}toast('Portal refreshed')}}
window.portalRefresh=portalRefresh;
if(!window.XS)window.XS={open(){toast('The Sheet arrives in the next build step.')},react(){toast('Reactivate arrives with the Sheet in the next build step.')},refresh(){},rows(){return[]},
  apply(items,label){const r=DB&&DB.sheetApply?DB.sheetApply(items):{applied:[],skipped:items};r.applied.forEach(it=>logEvent({client:it.id,title:label||'Calories updated',detail:'Deficit / Surplus → '+it.raw}));return r}};
window.addEventListener('ttl-save-failed',e=>toast((e.detail)||'Could not save. Check your connection and try again.'));
function addClientDoc(r){if(DB&&DB.addClient)DB.addClient(r)} // used by the Sheet: Add client, Move back
async function boot(){
  render();renderFeed();
  DB=window.TTL_STORE||null;ME=window.TTL_WHO||null;USER={profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{name:i}]))};
  if(!DB){LOADED=true;rebuild();$('#syncLine').innerHTML='<i></i>Not connected';return}
  const fail=()=>toast('Lost connection to the portal data. Reload the page.');
  DB.collection('clients').onSnapshot(s=>{RAW=s.docs.map(d=>Object.assign({id:d.id},d.data()));LOADED=true;rebuild()},fail);
  DB.collection('edits').onSnapshot(s=>{EDITS={};s.docs.forEach(d=>EDITS[d.id]=d.data());if(LOADED)rebuild()},fail);
  DB.collection('feed').onSnapshot(s=>{FEEDDOC={};s.docs.forEach(d=>FEEDDOC[d.id]=d.data());renderFeed();resolveProfiles()},fail);
  DB.doc('meta/sync').onSnapshot(s=>{META=s.exists?s.data():{};if(LOADED)rebuild()},fail);
  DB.doc('settings/rules').onSnapshot(s=>{RULES=Object.assign({},RULES_DEF,s.exists?s.data():{});if(LOADED)rebuild()},fail);
}
boot();
