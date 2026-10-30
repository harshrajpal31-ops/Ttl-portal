(function(){
/* ---------- Brain: the portal's assistant ---------- */
const NOTION_TASKS='f2fb6aa7-3cb6-4dd0-839b-83f8e6c920f3';
const NOTION_PEOPLE={Harsh:'0c182b51-8a92-46cf-907e-32f949dea8bc',Shrutika:'d3103dd3-f183-48ee-857f-26ae2d050394'};
const ASSIGN=c=>c==='Both'?[NOTION_PEOPLE.Harsh,NOTION_PEOPLE.Shrutika]:c==='Shrutika'?[NOTION_PEOPLE.Shrutika]:[NOTION_PEOPLE.Harsh];
const CHANGE_STATUSES=['changesrequired','mealplanchanges','workoutchanges'];
const FIELD_KEYS={checkin_status:'st',checkin_action:'act',reminders:'rem',form:'form',workouts:'wo',app_checkin:'app',checkin_form:'cf',checkin_notes:'note',
  client_status:'cs',weekly_notes:'wn',refeed:'rf',deficit_surplus:'ds',roster_status:'rs',start_date:'start',end_date:'end'};
for(let i=1;i<=12;i++)FIELD_KEYS['week_'+i]='w'+i;
const PORTAL_FIELDS=['phase','goal','plan_of_action','extra_notes','add_note','profile_summary','medical','medical_add','medical_remove','diet','food_restrictions','allergy','calories','protein','carbs','fats','current_weight','goal_weight','onboarding_weight','client_name','coach','health_<category>_note','health_<category>_result','phase_N_summary (e.g. phase_2_summary)'];
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
const SWd=t=>String(t||'').replace(/^[^A-Za-z0-9]+/,'').trim();
const todayStr=()=>new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'});

function resolve(q){q=String(q||'').trim();if(!q)throw new Error('Name a client.');
  let c=CLIENTS.find(x=>x.id===q);if(c)return c;const n=norm(q);
  let hits=CLIENTS.filter(x=>norm(x.name)===n);if(hits.length===1)return hits[0];
  hits=CLIENTS.filter(x=>norm(x.name).includes(n)||n.split(' ').every(w=>norm(x.name).split(' ').some(p=>p.startsWith(w))));
  if(hits.length===1)return hits[0];
  if(!hits.length)throw new Error(`No client matches "${q}".`);
  throw new Error(`"${q}" matches ${hits.length} clients: ${hits.map(h=>h.name).join(', ')}. Ask which one.`)}
let RC=null;const rowsMap=()=>{if(!RC){RC=new Map(XS.rows().map(r=>[r.id,r]));setTimeout(()=>{RC=null},0)}return RC};
const sheetOf=id=>rowsMap().get(id)||{};
function brief(c){const s=sheetOf(c.id);const tg=(typeof tagsOf==='function'?tagsOf(c):[]).map(t=>t.label);
  return {name:c.name,coach:c.coach,checkin_status:SWd(s.st)||'TBD',checkin_action:SWd(s.act)||'TBD',week:c.week||null,phase:c.pnum,goal:c.g,roster_status:s.rs,tags:tg}}
function details(c){const s=sheetOf(c.id),pf=PF[c.id]||{},out=brief(c);
  Object.assign(out,{form:SWd(s.form),workouts:SWd(s.wo),reminders:SWd(s.rem),app_checkin:s.app,checkin_form:s.cf,checkin_notes:s.note||'',client_status:SWd(s.cs),
    weekly_notes:s.wn||'',refeed:s.rf||'',deficit_surplus:s.ds||'',start_date:s.start,end_date:s.end,
    coach_weekly_notes:(s.w||[]).map((t,i)=>t?`Week ${i+1}: ${t}`:'').filter(Boolean),
    plan_of_action:(noteOf(c,'poa')||{}).text||'',extra_notes:(noteOf(c,'extra')||{}).text||'',
    profile_summary:pf.sum||'',health_review:(()=>{const H=(EDITS[c.id]||{}).hr||{},o={};(window.HR_CATS||[]).forEach(([k,l])=>{const f=window.hrForm?hrForm(c,pf,k):{t:'',a:''};o[l]={from_form:f.t,result:(H[k]&&H[k].r)||(f.a?f.a+' (auto)':''),coach_note:(H[k]&&H[k].n)||''}});return o})(),medical:(pf.flags||[]).concat(pf.med||[]),diet:pf.diet||'',food_restrictions:pf.food||'',allergy:!!pf.allergy,nutrition:(()=>{const n=nut(c);return {calories:n.kcal,protein:n.p,carbs:n.c,fats:n.f}})(),body:(()=>{const d=c.daily||[],l=d[d.length-1];return {current_weight:l?l.v:null,current_weight_date:l?l.t.toISOString().slice(0,10):null,first_logged_weight:d[0]?d[0].v:null,onboarding_weight:c.formWeight,goal_weight:c.target}})(),
    phases:(c.phases||[]).map(p=>({phase:p.n,form:p.type,date:p.date,summary:p.sum,new_health_issues:p.med||[]}))});
  const j=JSON.stringify(out);if(j.length>14000){out.phases=out.phases.slice(-2);out.coach_weekly_notes=out.coach_weekly_notes.slice(-6)}return out}


const today=()=>new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
const short=v=>String(v??'').split('\n')[0].slice(0,90);
function portalEdit(c,fld,val){const E0=EDITS[c.id]||{},pf=Object.assign({},PF[c.id]||{}),txt=String(val??'').trim();
  const pfSet=(k,v,label)=>{const old=pf[k];writeEdit(c.id,{pf:Object.assign({},E0.pf||{},{[k]:v})});logEvent({client:c.id,title:'🧠 '+label+' updated',detail:(Array.isArray(old)?old.join('; '):short(old))+' → '+(Array.isArray(v)?v.join('; '):short(v))});return {ok:true,v:Array.isArray(v)?v:short(v)}};
  if(fld==='add_note'){if(!txt)return {why:'Empty note'};const o=noteOf(c,'extra').text;saveNote(c,'extra',(o?o+'\n':'')+`${today()}: ${txt}`);return {ok:true,v:'note added'}}
  if(fld==='profile_summary'){if(!txt)return {why:'Empty summary'};const p1=(c.phases||[])[0];writeEdit(c.id,{pf:Object.assign({},E0.pf||{},{sum:txt}),psum:p1?Object.assign({},E0.psum||{},{[p1.n]:txt}):E0.psum});logEvent({client:c.id,title:'🧠 Profile summary updated',detail:short(txt)});return {ok:true,v:'saved'}}
  if(fld==='diet')return pfSet('diet',txt,'Diet');
  if(fld==='food_restrictions')return pfSet('food',txt,'Food restrictions');
  if(fld==='allergy')return pfSet('allergy',val===true||/^(true|yes|y)$/i.test(txt),'Allergy');
  if(fld==='medical'){const list=txt?txt.split(/\n|;/).map(x=>x.trim()).filter(Boolean):[];writeEdit(c.id,{pf:Object.assign({},E0.pf||{},{med:list,flags:[]})});logEvent({client:c.id,title:'🧠 Medical updated',detail:list.join('; ').slice(0,90)||'Cleared'});return {ok:true,v:list}}
  if(fld==='medical_add'){if(!txt)return {why:'Empty'};const med=(pf.med||[]).filter(x=>!/no onboarding form matched|none stated|not stated/i.test(x)).concat([txt]);return pfSet('med',med,'Medical')}
  if(fld==='medical_remove'){const k=txt.toLowerCase();const f=(pf.flags||[]).filter(x=>!x.toLowerCase().includes(k)),m=(pf.med||[]).filter(x=>!x.toLowerCase().includes(k));
    if(f.length===(pf.flags||[]).length&&m.length===(pf.med||[]).length)return {why:`No medical item mentions "${txt}"`};
    writeEdit(c.id,{pf:Object.assign({},E0.pf||{},{flags:f,med:m})});logEvent({client:c.id,title:'🧠 Medical updated',detail:'Removed '+txt});return {ok:true,v:'removed '+txt}}
  if(fld==='calories'){const n=Math.round(parseFloat(txt));if(!(n>=500&&n<=6000))return {why:'Calories must be a number between 500 and 6000'};const ds=syncKcal(c,n,'🧠 Calories → '+n);return {ok:true,v:n+' kcal (sheet now '+ds+')'}}
  const KG=v=>{const n=parseFloat(String(v).replace(/kg/i,''));return n>=25&&n<=300?Math.round(n*10)/10:null};
  if(fld==='goal_weight'||fld==='onboarding_weight'){const n=KG(txt);if(n==null)return {why:'Weight must be in kg'};const k=fld==='goal_weight'?'target':'formWeight',o=c[k];writeEdit(c.id,{[k]:n});logEvent({client:c.id,title:'🧠 '+(k==='target'?'Goal weight':'Onboarding weight')+' updated',detail:(o??'—')+' → '+n+' kg'});return {ok:true,v:n+' kg'}}
  if(fld==='current_weight'){const m=txt.match(/(\d{2,3}(?:\.\d+)?)/);const n=m?KG(m[1]):null;if(n==null)return {why:'Weight must be in kg'};const dm=txt.match(/\d{4}-\d{2}-\d{2}/);const d=dm?dm[0]:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
    writeEdit(c.id,{wt:(E0.wt||[]).filter(x=>x.d!==d).concat([{d,v:n,m:1}])});logEvent({client:c.id,title:'🧠 Weigh-in added',detail:`${n} kg on ${d}`});return {ok:true,v:`${n} kg on ${d}`}}
  const NK={protein:'p',carbs:'c',fats:'f'};
  if(NK[fld]){const n=parseFloat(txt);if(!(n>0))return {why:'Needs a number'};writeEdit(c.id,{nut:Object.assign({},E0.nut||{},{[NK[fld]]:n})});logEvent({client:c.id,title:'🧠 Nutrition updated',detail:`${fld} → ${n}`});return {ok:true,v:n}}
  if(fld==='client_name'){if(txt.length<2)return {why:'Name too short'};const o=c.name;writeEdit(c.id,{name:txt});logEvent({client:c.id,title:'🧠 Name changed',detail:o+' → '+txt});return {ok:true,v:txt}}
  if(fld==='coach'){const k=/^s/i.test(txt)?'Shrutika':/^h/i.test(txt)?'Harsh':'';if(!k)return {why:'Coach must be Harsh or Shrutika'};const o=c.coach;writeEdit(c.id,{coach:k});logEvent({client:c.id,title:'🧠 Coach changed',detail:o+' → '+k});return {ok:true,v:k}}
  const hm=fld.match(/^health_([a-z]+)_(note|result)$/);if(hm){const cat=(window.HR_CATS||[]).find(x=>x[0]===hm[1]);if(!cat)return {why:'Unknown health category. Use: '+(window.HR_CATS||[]).map(x=>x[0]).join(', ')};
    if(hm[2]==='result'){const R=['Yes','No','Applicable','Not applicable','Fine','Needs Attention','Low','Medium','High'];const o=R.find(x=>x.toLowerCase()===txt.toLowerCase())||(txt===''?'':null);if(o===null)return {why:'Result must be one of '+R.join(', ')};hrSave(c,hm[1],{r:o});return {ok:true,v:o||'Not reviewed'}}
    hrSave(c,hm[1],{n:txt});return {ok:true,v:'saved'}}
  const pm=fld.match(/^phase_(\d+)_summary$/);if(pm){const n=+pm[1];if(!(c.phases||[]).some(q=>q.n===n))return {why:`${c.name} has no Phase ${n} form`};writeEdit(c.id,{psum:Object.assign({},E0.psum||{},{[n]:txt})});logEvent({client:c.id,title:`🧠 Phase ${n} summary updated`,detail:short(txt)});return {ok:true,v:'saved'}}
  return {}}
/* ---------- Typeform onboarding → profile ---------- */
const TF_ACCT='01GRXRVGPD0FDMKXDGYS4EGF1M';
const TF_FORMS={Harsh:[{id:'cxnxmVaA',t:"Harsh's onboarding form",fn:'xFJvpuljjCSl',ln:'iKV04aFFLE0q'}],
  Shrutika:[{id:'bdT7rElU',t:"Shrutika's onboarding form",fn:'RhkceWR7BCSk',ln:'2UiKXFiG5qEn'},{id:'N0XYQnhc',t:"Shrutika's onboarding form (old)",fn:'CFhK30AGQIBX',ln:'c6GRuPcHQdE3'}]};
const PENDING={};
function tfUnwrap(res){let p=res&&res.payload!==undefined?res.payload:res;
  if(p&&p.structuredContent)p=p.structuredContent;
  if(p&&Array.isArray(p.content)){const t=p.content.map(c=>c&&c.text||'').join('');try{p=JSON.parse(t)}catch(_){}}
  if(typeof p==='string'){try{p=JSON.parse(p)}catch(_){}}
  return p||{}}
const tfVal=a=>{let v=a.value;if(Array.isArray(v))v=v.join(', ');if(typeof v==='boolean')v=v?'Yes':'No';if(a.type==='date'&&v)v=String(v).slice(0,10);return v==null?'':String(v).trim()};
const tfT=t=>{t=String(t||'').replace(/\{\{[^}]+\}\}/g,'').replace(/\*/g,'').trim().replace(/^[\s?:\-"“”]+|[\s?:\-"“”]+$/g,'');return t.charAt(0).toUpperCase()+t.slice(1)};
const TF_SECS=[['Basics',/first name/i],['Goal and history',/primary goal/i],['Medical',/medical conditions/i],['Training',/been to a gym/i],['Food',/dietary preferences/i],['Lifestyle',/binge eat when you are stressed/i],['Sleep and stress',/satisfied with the amount of sleep/i],['Tech and commitment',/user\?|smart watch/i]];
function tfSections(answers){const out=[];let cur=null;
  for(const a of answers){const t=a.title,v=tfVal(a);
    for(const [name,re] of TF_SECS){if(re.test(t)&&!out.some(o=>o[0]===name)){cur=[name,[]];out.push(cur)}}
    if(!cur){cur=['Basics',[]];out.push(cur)}
    if(!v||/phone|date of birth|picture|upload/i.test(t))continue;
    let tt=tfT(t);if(/^(explain in detail|what changes)$/i.test(tt))tt=cur[1].length?cur[1][cur[1].length-1][0]+' · detail':'Detail';
    cur[1].push([tt,v])}
  return out.filter(s=>s[1].length)}
function tfExtract(answers){const m={};answers.forEach(a=>{const k=tfT(a.title).toLowerCase();if(!(k in m)||!m[k])m[k]=tfVal(a)});
  const pick=(...ks)=>{for(const k of ks)for(const t in m)if(t.includes(k)&&m[t])return m[t];return ''};const no=v=>!v||/^(no|none|na|n\/a|nil|nothing|-)$/i.test(v.trim());
  const med=[],flags=[];const cond=pick('medical conditions');if(cond&&!/none/i.test(cond))med.push(cond);
  const cur=pick('currently receiving medical treatment');if(cur&&!/none of the above/i.test(cur))med.push('Current: '+cur);
  const surg=pick('what type of surgeries');if(surg)med.push('Surgery: '+surg);
  const fam=pick('family history');if(fam&&!/none/i.test(fam))med.push('Family history: '+fam);
  const meds=pick('which meds/supplements');if(meds)med.push('Medicines / supplements: '+meds);
  const pain=pick('type of pain/discomfort/injury');if(pain)med.push('Pain / injury: '+pain);
  const dig=pick('digestive health');if(dig&&!/normal|none/i.test(dig))med.push('Digestion: '+dig);
  ['Feel Dizzy During Exercise','Blackouts more often','Breathlessness','Anxiety Issues / Clinical depression','Currently Pregnant or recently Given birth','Planning for a child','Heart Problems'].forEach(w=>{if((cond+' '+cur).toLowerCase().includes(w.toLowerCase()))flags.push(w.replace('Anxiety Issues / Clinical depression','Anxiety / depression reported'))});
  if(pick('binge eat when you are stressed')==='Yes')flags.push('Binge eats when stressed');
  let diet=pick('dietary preferences');diet=({'vegetarian but consume eggs':'Vegetarian + eggs','non vegetarian':'Non-vegetarian','vegetarian':'Vegetarian','vegan':'Vegan'})[diet.toLowerCase()]||diet;
  const food=[];let allergy=false;const al=pick('what food allergies');if(!no(al)){food.push('Allergy: '+al);allergy=true}
  const it=pick('what kind of food intolerances');if(!no(it))food.push('Intolerance: '+it);
  const ind=pick('which food causes indigestion');if(!no(ind))food.push('Indigestion: '+ind);
  const nc=pick('not comfortable eating');if(!no(nc))food.push('Avoids: '+nc);
  const goal=pick('primary goal');const g=/fat loss/i.test(goal)?'Fat Loss':/muscle gain/i.test(goal)?'Muscle Gain':/lifestyle|health|maintenance/i.test(goal)?'Recovery / Health':'';
  const wt=parseFloat(pick('weight (in kgs)'));
  return {med:med.length?med:['None reported'],flags,diet:diet||'Not stated',food:food.join('. ')||'None reported',allergy,goal:g,email:pick('e-mail'),formWeight:isFinite(wt)?wt:null}}
const nm=s=>String(s||'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
async function tfFind(c,signal){const mcp=await claude.use('mcp');if(!mcp)throw new Error('Typeform is not available on this page right now.');
  const call=args=>mcp.callTool('Typeform','insights-public_list_responses',Object.assign({account_id:TF_ACCT,filters:null,sort:{by:'submitted_at',order:'desc'}},args),{signal}).then(tfUnwrap);
  const order=(TF_FORMS[c.coach]||[]).concat(Object.entries(TF_FORMS).filter(([k])=>k!==c.coach).flatMap(([,v])=>v));
  const want=nm(c.name).split(' '),wf=want[0],wl=want.slice(1).join(' ');let best=null;
  for(const f of order){const d=await call({form_id:f.id,field_ids:[f.fn,f.ln],pagination:{cursor:null,page_size:500},time_range:{start:1,end:null}});
    for(const r of (d.data||d.items||[])){const A={};(r.answers||[]).forEach(a=>A[a.field_id]=tfVal(a));const fi=nm(A[f.fn]),la=nm(A[f.ln]);
      const full=nm(fi+' '+la);let sc=0;if(full===nm(c.name))sc=3;else if(fi===wf&&wl&&(la.startsWith(wl.split(' ')[0])||wl.startsWith(la)&&la))sc=2;else if(fi===wf&&!wl)sc=2;else if(fi===wf)sc=1;
      if(sc&&(!best||sc>best.sc||(sc===best.sc&&+r.submitted_at>+best.r.submitted_at)))best={sc,r,f,first:A[f.fn],cands:0};
      if(sc===1&&best&&best.f===f)best.cands++}
    if(best&&best.sc>=2)break}
  if(!best)return null;
  const ts=+best.r.submitted_at||Math.floor(Date.parse(best.r.submitted_at)/1000);
  const full=await call({form_id:best.f.id,field_ids:null,pagination:{cursor:null,page_size:5},time_range:{start:Math.max(1,ts-1),end:ts+1}});
  const row=(full.data||full.items||[]).find(r=>(r.answers||[]).some(a=>a.field_id===best.f.fn&&tfVal(a)===best.first))||(full.data||full.items||[])[0];
  if(!row)return null;return {form:best.f,row,ts,score:best.sc}}
function obOf(c,hit,summary){const answers=hit.row.answers||[],x=tfExtract(answers),date=new Date(hit.ts*1000).toISOString().slice(0,10);
  const p1={n:1,type:'Onboarding',form:hit.form.t,date,sum:summary||'',secs:tfSections(answers),med:[],main:true};
  const old=(c.phases||[]).filter(p=>!p.main).map(p=>Object.assign({},p));
  return {x,ob:{profile:{sum:summary||'',med:x.med,flags:x.flags,diet:x.diet,food:x.food,allergy:x.allergy},phases:[p1].concat(old.map((p,i)=>Object.assign(p,{n:i+2}))),obForm:hit.form.t,obDate:date,email:x.email,formWeight:x.formWeight}}}

let ACT=null;
const TOOLS=[
 {name:'find_clients',description:'List clients matching filters. Returns name, coach, check-in status and action, week, phase, goal and tags for each. Use for questions like "who needs a call" or "Shrutika\'s clients on Skip".',
  inputSchema:{type:'object',properties:{name:{type:'string',description:'Part of a client name'},coach:{type:'string',enum:['Harsh','Shrutika']},checkin_status:{type:'string'},checkin_action:{type:'string'},tag:{type:'string'},goal:{type:'string'},limit:{type:'number'}}},
  execute(i){let L=CLIENTS.slice();const k=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(i.name)L=L.filter(c=>norm(c.name).includes(norm(i.name)));if(i.coach)L=L.filter(c=>c.coach===i.coach);
    if(i.checkin_status)L=L.filter(c=>k(sheetOf(c.id).st)===k(i.checkin_status)||k(SWd(sheetOf(c.id).st))===k(i.checkin_status));
    if(i.checkin_action)L=L.filter(c=>k(SWd(sheetOf(c.id).act))===k(i.checkin_action));
    if(i.goal)L=L.filter(c=>k(c.g)===k(i.goal));
    if(i.tag)L=L.filter(c=>(tagsOf(c)||[]).some(t=>k(t.label).includes(k(i.tag))));
    act(`Looked up ${L.length} client${L.length===1?'':'s'}`);return {count:L.length,clients:L.slice(0,Math.min(+i.limit||60,90)).map(brief)}}},
 {name:'get_client',description:'Everything about one client: sheet columns, weekly coach notes, plan of action, profile summary, medical, diet, and every phase form summary. Use before answering detailed questions about a client.',
  inputSchema:{type:'object',properties:{client:{type:'string',description:'Client name'}},required:['client']},
  execute(i){const c=resolve(i.client);act(`Read ${c.name}'s profile`);return details(c)}},
 {name:'update_clients',description:'Change anything about one or many clients: sheet columns, notes, profile, medical, nutrition, phase, goal, name and coach. Every change is logged and can be undone. Fields: '+Object.keys(FIELD_KEYS).join(', ')+', '+PORTAL_FIELDS.join(', ')+'. Dropdown fields only take their listed options. Returns what changed and anything skipped.',
  inputSchema:{type:'object',properties:{updates:{type:'array',items:{type:'object',properties:{client:{type:'string'},field:{type:'string'},value:{type:['string','boolean','number']}},required:['client','field','value']}},summary:{type:'string',description:'Short label for the change log, e.g. "Moved 3 clients to Call needed"'}},required:['updates']},
  execute(i){const ups=Array.isArray(i.updates)?i.updates:[];const sheet=[],skipped=[],done=[];
    const BODY=/^(calories|protein|carbs|fats|current_weight|goal_weight|onboarding_weight|deficit_surplus)$/,PROF=/^(profile_summary|phase_\d+_summary)$/;const bodyFor=new Set();
    for(const u of ups){const f=String(u.field||'').toLowerCase().trim().replace(/\s+/g,'_');if(BODY.test(f))try{bodyFor.add(resolve(u.client).id)}catch(_){}}
    for(const u of ups){let c;try{c=resolve(u.client)}catch(e){skipped.push({client:u.client,reason:e.message});continue}
      if(bodyFor.has(c.id)&&PROF.test(String(u.field||'').toLowerCase().trim().replace(/\s+/g,'_'))){skipped.push({client:c.name,field:u.field,reason:'Calorie and weight changes only go to Body and nutrition; the profile summary is left as is'});continue}
      const fld=String(u.field||'').toLowerCase().trim().replace(/\s+/g,'_'),val=u.value;
      if(FIELD_KEYS[fld]){sheet.push({id:c.id,f:FIELD_KEYS[fld],raw:typeof val==='boolean'?String(val):String(val??''),client:c.name,field:fld});continue}
      if(fld==='phase'){const n=parseInt(val,10);if(!(n>=1&&n<=10)){skipped.push({client:c.name,field:fld,reason:'Phase must be 1 to 10'});continue}setPhase(c,n);done.push({client:c.name,field:'phase',value:n});continue}
      if(fld==='goal'){const g=GOAL_LIST.find(x=>x.toLowerCase()===String(val).toLowerCase()||x.toLowerCase().startsWith(String(val).toLowerCase()));if(!g){skipped.push({client:c.name,field:fld,reason:'Goal must be one of '+GOAL_LIST.join(', ')});continue}setGoal(c,g);done.push({client:c.name,field:'goal',value:g});continue}
      if(fld==='plan_of_action'||fld==='extra_notes'){saveNote(c,fld==='plan_of_action'?'poa':'extra',String(val||''));done.push({client:c.name,field:fld,value:'saved'});continue}
      const r2=portalEdit(c,fld,val);if(r2.ok){done.push({client:c.name,field:fld,value:r2.v});continue}
      skipped.push({client:c.name,field:u.field,reason:r2.why||'Unknown field'})}
    if(sheet.length){const r=XS.apply(sheet,'🧠 '+(i.summary||`Brain updated ${sheet.length} cell${sheet.length===1?'':'s'}`));
      r.applied.forEach(a=>done.push(a));r.skipped.forEach(s=>skipped.push(s))}
    act(`Changed ${done.length} value${done.length===1?'':'s'}${skipped.length?` · ${skipped.length} skipped`:''}`,'edit');
    return {changed:done,skipped}}},
 {name:'create_notion_task',description:'Add a task to Harsh\'s Notion "Daily Tasks" board. Returns the new task\'s link.',
  inputSchema:{type:'object',properties:{title:{type:'string'},assign:{type:'string',enum:['Harsh','Shrutika','Both'],description:'Harsh = Harsh\'s Tasks, Shrutika = Shrutika\'s Tasks, Both = Collaborated Tasks. If omitted: a client task goes to that client\'s coach; a generic team task goes to Both.'},due:{type:'string',enum:['Today','Tomorrow','Later This week','Next week','Undecided']},details:{type:'string'},client:{type:'string'}},required:['title']},
  async execute(i,ctx){const mcp=await claude.use('mcp');if(!mcp)throw new Error('Notion is not available on this page right now.');
    let content=i.details?String(i.details):'',who=['Harsh','Shrutika','Both'].includes(i.assign)?i.assign:null;if(i.client){try{const c=resolve(i.client);content=(content?content+'\n\n':'')+`Client: ${c.name} (coach ${c.coach})`;who=who||c.coach}catch(_){}}who=who||'Both';
    const res=await mcp.callTool('Notion','notion-create-pages',{parent:{type:'data_source_id',data_source_id:NOTION_TASKS},pages:[{properties:{Name:String(i.title).slice(0,200),'Due Date':i.due||'Today',Status:'Not started',Assign:ASSIGN(who)},content:content||undefined}]},{signal:ctx&&ctx.signal});
    act(`Created a Notion task for ${who==='Both'?'both (Collaborated)':who}: ${i.title}`,'notion');const p=res&&res.payload;let url='';try{const s=JSON.stringify(p);const m=s.match(/https:\/\/[^"\\\s]*notion[^"\\\s]*/);url=m?m[0]:''}catch(_){}return {created:true,title:i.title,due:i.due||'Today',url}}},
 {name:'progress_to_notion',description:'The "check my progress sheet and move tasks to Notion" routine for ONE coach. Finds that coach\'s clients whose Client Status is Changes required, Meal Plan Changes or Workout Changes, reads each Weekly Note (the change needed) and creates one Notion Daily Task per client (Harsh\'s clients assigned to Harsh only, Shrutika\'s clients to Shrutika only). Skips clients who already have an open (not Done) task with their name. Returns created and skipped.',
  inputSchema:{type:'object',properties:{coach:{type:'string',enum:['Harsh','Shrutika']},due:{type:'string',enum:['Today','Tomorrow','Later This week','Next week','Undecided']}},required:['coach']},
  async execute(i,ctx){const coach=i.coach==='Shrutika'?'Shrutika':'Harsh';const k=v=>String(v||'').toLowerCase().replace(/[^a-z]/g,'');
    const rows=XS.rows().filter(r=>!r.archived&&r.coach===coach&&CHANGE_STATUSES.includes(k(SWd(r.cs))));
    if(!rows.length){act(`No ${coach} clients on Changes required`,'notion');return {coach,found:0,created:[],skipped:[]}}
    const mcp=await claude.use('mcp');if(!mcp)throw new Error('Notion is not available on this page right now.');
    const created=[],skipped=[];
    for(const r of rows){if(ctx&&ctx.signal&&ctx.signal.aborted)break;
      const note=String(r.wn||'').trim(),status=SWd(r.cs),title=`${r.name} – ${note||status}`;
      try{const q=await mcp.callTool('Notion','notion-query-data-sources',{data:{mode:'rows',data_source_url:'collection://'+NOTION_TASKS,limit:5,filter:{type:'group',operator:'and',filters:[
          {type:'property',property:'Status',propertyType:'status',operator:'status_is_not',value:{type:'is_option',value:'Done'}},
          {type:'property',property:'Name',propertyType:'title',operator:'string_contains',value:{type:'exact',value:r.name}}]}}},{signal:ctx&&ctx.signal});
        const res=(q&&q.payload&&(q.payload.results||q.payload.structuredContent&&q.payload.structuredContent.results))||null;
        const txt=JSON.stringify(q&&q.payload||'');const has=Array.isArray(res)?res.length>0:/"results":\[\{/.test(txt)||/\\"results\\":\[\{/.test(txt);
        if(has){skipped.push({client:r.name,reason:'Open task already in Notion'});continue}}
      catch(e){if(e&&e.name==='AbortError')throw e;skipped.push({client:r.name,reason:'Could not check Notion for an existing task, so nothing was added'});continue}
      try{await mcp.callTool('Notion','notion-create-pages',{parent:{type:'data_source_id',data_source_id:NOTION_TASKS},pages:[{properties:{Name:title.slice(0,200),'Due Date':i.due||'Today',Status:'Not started',Assign:ASSIGN(coach)},content:note||undefined}]},{signal:ctx&&ctx.signal});
        created.push({client:r.name,change:note||'(no weekly note – status: '+status+')'})}
      catch(e){if(e&&e.name==='AbortError')throw e;skipped.push({client:r.name,reason:'Notion did not accept the task'})}}
    act(`${created.length} task${created.length===1?'':'s'} added to Notion for ${coach}${skipped.length?` · ${skipped.length} skipped`:''}`,'notion');
    return {coach,found:rows.length,created,skipped}}},
 {name:'fetch_onboarding',description:'Find a client\'s onboarding Typeform (their coach\'s onboarding form first, then the other coach\'s) and read every answer. Use when a new client is added, or when asked to build or refresh a client\'s profile from Typeform. Returns the form, date, medical/diet/food already extracted, and all answers. Then write a summary and call save_profile.',
  inputSchema:{type:'object',properties:{client:{type:'string'}},required:['client']},
  async execute(i,ctx){const c=resolve(i.client);act(`Searching Typeform for ${c.name}`,'notion');const hit=await tfFind(c,ctx&&ctx.signal);
    if(!hit)return {found:false,client:c.name,note:'No onboarding form found under this name in Harsh\'s or Shrutika\'s onboarding forms. Ask the coach for the name they used on the form.'};
    PENDING[c.id]=hit;const {x}=obOf(c,hit,'');const ans=(hit.row.answers||[]).map(a=>[tfT(a.title),tfVal(a)]).filter(([t,v])=>v&&!/phone|date of birth|picture|upload/i.test(t)).map(([t,v])=>`${t}: ${v}`).join('\n').slice(0,9000);
    act(`Found ${c.name}'s ${hit.form.t} (${new Date(hit.ts*1000).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})})`,'notion');
    return {found:true,client:c.name,form:hit.form.t,submitted:new Date(hit.ts*1000).toISOString().slice(0,10),match:hit.score===3?'exact name':hit.score===2?'first name + surname start':'first name only, check it is the right person',extracted:{medical:x.med,flags:x.flags,diet:x.diet,food:x.food,goal:x.goal,weight_kg:x.formWeight},answers:ans}}},
 {name:'save_profile',description:'Save the profile built from the onboarding form fetched with fetch_onboarding: sets the Phase 1 onboarding (all form answers by section), the profile summary, medical, diet, food restrictions, onboarding weight and goal. Write the summary in this exact style, 3 to 5 short sentences, facts only: "26, female, salaried; 164 cm and 60 kg. Wants a lean, toned, strong body; reached her goal weight before but felt weak and lethargic. Migraines, cervical issues and bad acidity. Rarely goes out."',
  inputSchema:{type:'object',properties:{client:{type:'string'},summary:{type:'string'},extra_medical:{type:'array',items:{type:'string'},description:'Only medical points the extraction missed'}},required:['client','summary']},
  execute(i){const c=resolve(i.client),hit=PENDING[c.id];if(!hit)throw new Error('Call fetch_onboarding for this client first.');
    const {x,ob}=obOf(c,hit,String(i.summary||'').trim());if(Array.isArray(i.extra_medical))ob.profile.med=ob.profile.med.filter(m=>m!=='None reported').concat(i.extra_medical.filter(Boolean));if(!ob.profile.med.length)ob.profile.med=['None reported'];
    const E0=EDITS[c.id]||{};const patch={ob};if(x.goal&&!E0.goal&&c.g!=='Recomp')patch.goal=x.goal;
    if(E0.pf){const pf=Object.assign({},E0.pf);['sum','med','flags','diet','food','allergy'].forEach(k=>delete pf[k]);patch.pf=pf}
    const ps=Object.assign({},E0.psum||{});delete ps[1];patch.psum=ps;
    writeEdit(c.id,patch);logEvent({client:c.id,title:'🧠 Profile filled from Typeform',detail:`${hit.form.t} · ${ob.obDate}`});delete PENDING[c.id];
    act(`Filled ${c.name}'s profile from Typeform`,'edit');return {saved:true,client:c.name,form:hit.form.t,date:ob.obDate,goal:patch.goal||c.g,onboarding_weight:x.formWeight}}},
 {name:'open_client',description:'Open a client\'s full profile on screen for the coach.',
  inputSchema:{type:'object',properties:{client:{type:'string'}},required:['client']},
  execute(i){const c=resolve(i.client);if(window.XS)XS.close();openP(c.id);act(`Opened ${c.name}'s profile`);return {opened:c.name}}}
];
function rules(){const roster=CLIENTS.map(c=>{const s=sheetOf(c.id);return `${c.name} | ${c.coach} | ${SWd(s.st)||'TBD'} | ${SWd(s.act)||'TBD'} | wk ${c.week||'-'} | P${c.pnum} | ${c.g}`}).join('\n');
  return `You are Brain, the assistant inside the Twice the Lean coach portal. Twice the Lean is an online fat loss and muscle gain coaching business run by Harsh with coach Shrutika. You help the coach using the portal: answer questions about clients, change any client record (sheet, notes, profile, medical, nutrition), and add tasks to Notion. You have full authority to edit; the coach does not need to do it by hand. Today is ${todayStr()} (India time).

How to work:
- Act directly when the instruction is clear: call update_clients, create_notion_task or open_client yourself. Do not ask "should I?" for clear requests; every edit can be undone.
- If a client name is ambiguous or a value is not an allowed option, ask one short question instead of guessing.
- Use get_client before answering detailed questions about one client. Use find_clients for filtered lists the roster below cannot answer.
- Never invent numbers, notes or history. If something is not in the data, say so.
- Reply short and plain, like a sharp assistant coach. Use names. After changes, say exactly what changed in one or two lines. No headings.

Dropdown options (use these exact words, emojis optional):
checkin_status: ${SHEET_OPTS.st.join(', ')}
checkin_action: ${SHEET_OPTS.act.join(', ')}
reminders: ${SHEET_OPTS.rem.join(', ')}
form: ${SHEET_OPTS.form.join(', ')}
workouts (Shrutika's clients only): ${SHEET_OPTS.wo.join(', ')}
client_status: ${SHEET_OPTS.cs.join(', ')}
roster_status: Active, Yet to start, On hold, Expired (Expired moves the client off Check-in and Progress into Expired and hold)
Profile and notes fields: add_note appends a dated line to extra notes (use for "add a note"); extra_notes and plan_of_action replace the whole text; profile_summary rewrites the profile (Phase 1) summary shown on top; diet, food_restrictions replace text; medical_add adds one issue, medical_remove removes items containing the text, medical replaces the whole list (separate with ;); allergy true/false; calories is the daily target and also rewrites the sheet's Deficit/Surplus column (e.g. 2000-1500=500 becomes 2000-1650=350); protein, carbs, fats are grams; current_weight adds a weigh-in in kg (optionally with a YYYY-MM-DD date, default today); goal_weight and onboarding_weight in kg; client_name renames; coach is Harsh or Shrutika; phase_2_summary etc. rewrites that phase's form summary.
RULE for calories, macros and weight: change ONLY Body and nutrition (calories, protein, carbs, fats, current_weight, goal_weight, onboarding_weight). Never touch profile_summary, phase summaries, diet, medical or notes for these requests, even if the profile text mentions an old weight or calorie number. The profile is the client's form record and stays as filled.
NOTION ASSIGNMENT: every task is a row in the one Daily Tasks database. A task from Harsh's sheet or about Harsh's client -> assign Harsh (shows in Harsh's Tasks). From Shrutika's sheet or her client -> assign Shrutika only (Shrutika's Tasks). A generic team task not tied to either coach's sheet or client -> assign Both (Collaborated Tasks). Only use another assignment if the coach says so.
NEW CLIENT / PROFILE FROM TYPEFORM: when a new client is added, or the coach asks to build or refresh a profile, call fetch_onboarding, then write the summary from the answers and call save_profile. If the match is "first name only", say so and ask before saving. If nothing is found, say so in one line.
ROUTINE "check my progress sheet and move tasks to Notion" / "move Harsh task" / "move Shrutika task": call progress_to_notion with the coach named (Harsh or Shrutika). If no coach is named, ask which coach, one short question. Never mix coaches. Then list who got a task with their change, and who was skipped and why.
Health review (coach copy) categories: hist (Previous History), med (Medical Conditions), dig (Digestive Health), bowel (Bowel Health), sleep, stress, disc (Discipline), social (Social Life / Travel), supp (Supplements / Meds), notes (Additional Notes). health_<category>_result takes Yes, No, Applicable, Not applicable, Fine, Needs Attention, Low, Medium, High; health_<category>_note is the coach's own note (replaces it; read get_client first to append).
To change only part of a long text (summary, plan of action), call get_client first and send the full edited text.
app_checkin / checkin_form: true or false. Dates: YYYY-MM-DD. week_1..week_12 are the weekly coach notes. goal: ${GOAL_LIST.join(', ')}. phase: 1-10.

Roster (name | coach | check-in status | check-in action | week | phase | goal):
${roster}`}

/* ---------- UI ---------- */
const css=`
#brainBtn{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:90;width:58px;height:58px;border-radius:50%;border:0;background:#3F59A7;color:#fff;font-size:28px;line-height:1;cursor:pointer;
  box-shadow:0 10px 24px -8px rgba(63,89,167,.75),0 0 0 4px rgba(63,89,167,.12);display:grid;place-items:center;transition:transform .15s}
#brainBtn:hover{transform:scale(1.06)}
#brainBtn[aria-expanded="true"]{transform:scale(.92)}
#brain{position:fixed;right:0;top:0;bottom:0;z-index:89;width:min(420px,100%);background:#FBFBFD;border-left:1px solid #D9DBE1;box-shadow:-24px 0 48px -24px rgba(17,24,39,.35);display:flex;flex-direction:column;
  padding-top:env(safe-area-inset-top,0px);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1D1D1F}
#brain .bh{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #E6E8EC;background:#fff}
#brain .bh .em{width:36px;height:36px;border-radius:11px;background:#3F59A7;display:grid;place-items:center;font-size:20px}
#brain .bh b{display:block;font-size:15px}#brain .bh span{font-size:12px;color:#6E6E73}
#brain .bx{margin-left:auto;width:30px;height:30px;border-radius:50%;border:0;background:#EEF0F3;cursor:pointer;display:grid;place-items:center}
#brain .bl{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
#brain .m{max-width:88%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:normal;word-wrap:break-word}
#brain .m.u{align-self:flex-end;background:#3F59A7;color:#fff;border-bottom-right-radius:5px}
#brain .m.a{align-self:flex-start;background:#fff;box-shadow:0 0 0 1px #E3E5EA;border-bottom-left-radius:5px}
#brain .m.a ul{margin:4px 0;padding-left:18px}#brain .m.a p{margin:0 0 6px}#brain .m.a p:last-child{margin:0}
#brain .m.err{background:#FDECEC;box-shadow:none;color:#8A1C1C}
#brain .ac{align-self:flex-start;font-size:12px;color:#5B5F6A;display:flex;align-items:center;gap:6px;padding:2px 4px}
#brain .ac i{width:6px;height:6px;border-radius:50%;background:#A0A4AD}#brain .ac.edit i{background:#E8A400}#brain .ac.notion i{background:#1D1D1F}
#brain .th{align-self:flex-start;font-size:12.5px;color:#6E6E73;padding:4px}
#brain .th:after{content:'';display:inline-block;width:1em;text-align:left;animation:dots 1.2s steps(4,end) infinite}
@keyframes dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
#brain .sg{display:flex;flex-direction:column;gap:6px;margin-top:4px}
#brain .sg button{text-align:left;border:0;background:#fff;box-shadow:0 0 0 1px #E3E5EA;border-radius:10px;padding:9px 11px;font-size:13px;cursor:pointer;color:#1D1D1F}
#brain .sg button:hover{background:#F2F4FA}
#brain .hi{font-size:13px;color:#5B5F6A;line-height:1.5}
#brain form{display:flex;gap:8px;align-items:flex-end;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #E6E8EC;background:#fff}
#brain textarea{flex:1;resize:none;border:0;border-radius:12px;background:#F1F2F5;padding:10px 12px;font:inherit;font-size:14px;max-height:140px;min-height:42px;outline:0;color:#1D1D1F}
#brain .send{height:42px;padding:0 16px;border:0;border-radius:12px;background:#3F59A7;color:#fff;font-weight:600;font-size:13.5px;cursor:pointer}
#brain .send.stop{background:#1D1D1F}
#brain .send:disabled{opacity:.5;cursor:default}
body{padding-right:var(--brainw,0px)}
#xsHost{right:var(--brainw,0px)!important}
.scrim,.rmodal{right:var(--brainw,0px)!important}
@media (max-width:600px){#brain{top:auto;height:86vh;border-radius:18px 18px 0 0;border-left:0}#brainBtn{width:52px;height:52px;font-size:25px}}
@media (prefers-reduced-motion:reduce){#brain .th:after{animation:none;content:'...'}}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const btn=document.createElement('button');btn.id='brainBtn';btn.type='button';btn.title='Ask Brain';btn.setAttribute('aria-label','Open Brain, the portal assistant');btn.setAttribute('aria-expanded','false');btn.textContent='🧠';document.body.appendChild(btn);
const pane=document.createElement('aside');pane.id='brain';pane.hidden=true;pane.setAttribute('aria-label','Brain');
pane.innerHTML=`<div class="bh"><span class="em">🧠</span><div><b>Brain</b><span>Ask anything about your clients, or give it a task</span></div><button class="bx" id="brX" aria-label="Close Brain"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
<div class="bl" id="brL"></div>
<form id="brF"><textarea id="brI" rows="1" placeholder="e.g. Move Akshat Ginnare to Call needed"></textarea><button class="send" id="brS" type="submit">Send</button></form>`;
document.body.appendChild(pane);
const L=pane.querySelector('#brL'),I=pane.querySelector('#brI'),S=pane.querySelector('#brS');
const e2=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function md(t){const lines=e2(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(https:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">open</a>').split('\n');let h='',inl=false;
  for(const ln of lines){const m=ln.match(/^\s*[-•*]\s+(.*)/);if(m){if(!inl){h+='<ul>';inl=true}h+=`<li>${m[1]}</li>`}else{if(inl){h+='</ul>';inl=false}if(ln.trim())h+=`<p>${ln}</p>`}}if(inl)h+='</ul>';return h}
const add=(cls,html)=>{const d=document.createElement('div');d.className=cls;d.innerHTML=html;L.appendChild(d);L.scrollTop=L.scrollHeight;return d};
function act(text,kind){add('ac '+(kind||''),`<i></i>${e2(text)}`)}
let TURNS=[],BUSY=false,CTL=null,SAMPLE;
function intro(){L.innerHTML='';add('hi',`Hi. I can read every client's sheet, profile and notes, change their records, and add tasks to your Notion board.`);
  const sg=add('sg',['Who needs a call from me today?','Summarise Riya Bhardwaj for me','Move Akshat Ginnare to Marked Closed','Check my progress sheet and move Harsh tasks to Notion'].map(t=>`<button type="button" data-q="${e2(t)}">${e2(t)}</button>`).join(''))}
intro();
const dock=on=>document.documentElement.style.setProperty('--brainw',on&&innerWidth>900?Math.min(420,innerWidth)+'px':'0px');
window.addEventListener('resize',()=>dock(!pane.hidden));
let RESET=false;
function open(){if(RESET){RESET=false;TURNS=[];I.value='';I.style.height='auto';intro()}dock(true);pane.hidden=false;btn.setAttribute('aria-expanded','true');btn.hidden=true;setTimeout(()=>I.focus(),30)}
function close(){dock(false);pane.hidden=true;btn.setAttribute('aria-expanded','false');btn.hidden=false}
btn.addEventListener('click',()=>pane.hidden?open():close());
pane.querySelector('#brX').addEventListener('click',()=>{if(BUSY&&CTL)CTL.abort();RESET=true;close()});
pane.addEventListener('click',e=>{const q=e.target.closest('[data-q]');if(q&&!BUSY){I.value=q.dataset.q;send()}});
I.addEventListener('input',()=>{I.style.height='auto';I.style.height=Math.min(I.scrollHeight,140)+'px'});
I.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
pane.addEventListener('keydown',e=>e.stopPropagation());
pane.querySelector('#brF').addEventListener('submit',e=>{e.preventDefault();if(BUSY){CTL&&CTL.abort();return}send()});
const COPY={not_granted:'Brain needs your permission to use Claude. Allow it when asked, then try again.',sampling_disabled:'Claude is not available on this account.',rate_limited:'Too many requests just now. Try again in a minute.',
  session_expired:'Sign in to Claude again, then retry.',tools_unavailable:'This view cannot let Brain change records. Open the portal in claude.ai.',refused:'Claude declined that one. Try rephrasing.',prompt_too_large:'That was too much at once. Ask about fewer clients.'};
async function send(){const q=I.value.trim();if(!q||BUSY)return;
  if(SAMPLE===undefined){try{SAMPLE=await claude.use('sample')}catch(_){SAMPLE=null}}
  if(!SAMPLE){add('m a err','Brain needs Claude, which is not available in this view. Open the portal inside claude.ai.');return}
  L.querySelector('.sg')?.remove();I.value='';I.style.height='auto';add('m u',e2(q));TURNS.push({role:'user',content:q});
  BUSY=true;S.textContent='Stop';S.classList.add('stop');CTL=new AbortController();
  let th=add('th','Thinking'),bubble=null;
  const input=[{role:'user',content:rules()},{role:'assistant',content:'Understood. I am ready.'},...TURNS.slice(-12)];
  try{const {text}=await SAMPLE(input,{signal:CTL.signal,tools:TOOLS,onText:({text})=>{if(th){th.remove();th=null}if(!bubble)bubble=add('m a','');bubble.innerHTML=md(text);L.scrollTop=L.scrollHeight}});
    if(th){th.remove();th=null}if(!bubble)bubble=add('m a','');bubble.innerHTML=md(text);TURNS.push({role:'assistant',content:text})}
  catch(err){if(th){th.remove();th=null}const code=err&&err.code;
    if(code==='cancelled'){if(err.text){(bubble||add('m a','')).innerHTML=md(err.text);TURNS.push({role:'assistant',content:err.text})}add('ac','<i></i>Stopped')}
    else{if(err&&err.text){(bubble||add('m a','')).innerHTML=md(err.text)}add('m a err',e2(COPY[code]||'Something went wrong. Try again.'));TURNS.pop()}}
  finally{BUSY=false;S.textContent='Send';S.classList.remove('stop');CTL=null;try{window.portalRefresh&&portalRefresh(false)}catch(_){}}}
window.BRAIN={open,close,auto(msg){open();I.value=msg;setTimeout(()=>send(),50)}};
})();
