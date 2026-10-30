// Supabase-backed store for the portal (public/portal.js, ported from the demo).
// The demo talked to a document store: clients/<id>, edits/<id>, feed/<day>, meta/sync, settings/rules.
// This keeps that interface so the demo code runs unchanged, and maps every document to the real tables.
//   clients/<id>  <- clients + sheet_rows + phases + Trainerize weigh-ins   (what the sync/import wrote)
//   edits/<id>    <-> coach edits: phase, goal, notes, nutrition, health review, snoozes, weigh-ins, sheet
//   feed/<day>    <-> change_log
import { db } from './supabase.js';

const RULE_KEYS = { silentDays: 'silent_days', plateauWeeks: 'plateau_weeks', plateauKg: 'plateau_kg', regainWeeks: 'regain_weeks',
  regainKg: 'regain_kg', workDrop: 'workouts_slip_sessions', discWeeks: 'discipline_checkins', renewFrom: 'renewal_week', thriveWeeks: 'thriving_checkins' };
const SRC_OF_VIA = { portal: 'portal', sheet: 'sheet', brain: 'claude', job: 'sheet' };

const dayKey = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const num = v => v == null || v === '' ? null : +v;

// Same parser as kcalFromDs() in the portal: '2000-1500=500' -> 1500, '+' form -> the total.
export function kcalFromDs(ds) {
  const t = String(ds || '').replace(/,/g, '');
  let m = t.match(/^\s*(\d{3,4})\s*([-+])\s*(\d{2,4})\s*=\s*(\d{2,4})/);
  if (m) return m[2] === '-' ? +m[3] : +m[4];
  m = t.match(/^\s*(\d{3,4})\s*(kcal)?\s*$/i);
  return m ? +m[1] : null;
}

async function all(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
async function must(q) {
  const { error } = await q;
  if (error) throw error;
}

export function createStore(who) {
  const S = { clients: {}, edits: {}, feed: {}, meta: {}, rules: null, rows: {} };
  const L = {}; // listeners by key: 'clients', 'edits', 'feed', 'meta/sync', 'settings/rules', 'edits/<id>', 'feed/<day>'
  const savedFeed = new Set(); // feed item timestamps already in change_log

  const snapDoc = (k, v) => ({ id: k.split('/').pop(), exists: v !== undefined, data: () => clone(v) });
  const coll = c => ({ docs: Object.entries(S[c]).map(([id, v]) => snapDoc(c + '/' + id, v)) });
  const docVal = k => {
    if (k === 'meta/sync') return S.meta;
    if (k === 'settings/rules') return S.rules ?? undefined;
    const [c, id] = k.split('/');
    return (S[c] || {})[id];
  };
  const fire = key => (L[key] || []).forEach(f => f());
  const fireAll = () => Object.keys(L).forEach(fire);

  function build(rows) {
    const { clients, sheet, phases, weighins, health, notes, log, settings } = rows;
    const sheetOf = Object.fromEntries(sheet.map(s => [s.client_id, s]));
    const by = (list, key = 'client_id') => list.reduce((o, x) => ((o[x[key]] ||= []).push(x), o), {});
    const phOf = by(phases), wiOf = by(weighins), hrOf = by(health), ntOf = by(notes);
    S.clients = {}; S.edits = {}; S.rows = {};

    for (const c of clients) {
      const s = sheetOf[c.id] || {};
      const b = c.body || {};
      const set = b.coach_set || {};
      const wi = wiOf[c.id] || [];
      S.rows[c.id] = { client: c, sheet: s };
      S.clients[c.id] = {
        name: c.name, coach: c.coach, email: c.email || '', goal: c.goal || 'Not set', goalSrc: c.goal_src || '',
        obForm: c.ob_form || '', obDate: c.ob_date || '',
        profile: c.profile && Object.keys(c.profile).length ? c.profile : undefined, // none yet = no form matched
        formWeight: num(b.onboarding_weight), target: num(b.goal_weight), kcal: num(b.calories), kcalText: s.ds || '',
        phases: (phOf[c.id] || []).map(p => ({ n: p.n, type: p.type, form: p.form, date: p.date || '', sum: p.summary || '', med: p.med || [], secs: p.secs || [] })),
        tz: { weights: wi.filter(w => w.source === 'Trainerize').map(w => ({ d: w.date, v: +w.kg })) },
      };
      const e = {
        sheet: { rs: s.rs, start: s.start || '', end: s.end || '', form: s.form || '', wo: s.wo || '', app: s.app ?? null, cf: s.cf ?? null,
          rem: s.rem || 'TBD', st: s.st || 'TBD', act: s.act || 'TBD', note: s.note || '', cs: s.cs || 'TBD', wn: s.wn || '', rf: s.rf || '',
          ds: s.ds || '', w: s.w || [], dn: s.dn || '', dds: s.dds || '' },
      };
      if (c.expired_at) Object.assign(e.sheet, { archived: true, expiredAt: c.expired_at });
      if (set.phase) e.phase = c.phase;
      if (set.goal) e.goal = c.goal;
      if (set.nut) e.nut = { p: num(b.protein), c: num(b.carbs), f: num(b.fats) };
      if (b.snooze) e.snooze = b.snooze;
      const at = b.notes_at || {};
      if (c.plan_of_action) e.poa = { text: c.plan_of_action, at: at.poa || '' };
      const xn = (ntOf[c.id] || [])[0];
      if (xn) e.extra = { text: xn.body, at: at.extra || '' };
      const coachWt = wi.filter(w => w.source !== 'Trainerize').map(w => ({ d: w.date, v: +w.kg, m: 1 }));
      if (coachWt.length) e.wt = coachWt;
      const hr = hrOf[c.id];
      if (hr) e.hr = Object.fromEntries(hr.map(h => [h.category, { r: h.result || '', n: h.note || '', at: Date.parse(h.updated_at) }]));
      S.edits[c.id] = e;
    }

    S.feed = {};
    savedFeed.clear();
    for (const r of log) {
      const v = r.new_value || {};
      const t = Date.parse(r.at);
      const item = { t, title: v.title || (r.field === 'import' ? 'Data imported' : r.field || 'Change'), detail: v.detail || v.source || '',
        client: r.client_id || undefined, by: r.who, kind: v.kind || (r.via === 'job' ? 'sync' : 'coach'), src: v.src || SRC_OF_VIA[r.via] || 'portal' };
      if (v.tone) item.tone = v.tone;
      const k = dayKey(t);
      (S.feed[k] ||= { day: k, items: [] }).items.push(item);
      savedFeed.add(t);
    }
    const lastJob = log.find(r => r.via === 'job');
    S.meta = lastJob ? { at: Date.parse(lastJob.at) } : {};

    const tr = (settings.find(x => x.key === 'tag_rules') || {}).value;
    S.rules = tr ? Object.fromEntries(Object.entries(RULE_KEYS).filter(([, k]) => tr[k] != null).map(([d, k]) => [d, +tr[k]])) : undefined;
  }

  async function load() {
    const since = new Date(Date.now() - 60 * 864e5).toISOString();
    const [clients, sheet, phases, weighins, health, notes, log, settings] = await Promise.all([
      all(db.from('clients').select('*')),
      all(db.from('sheet_rows').select('*')),
      all(db.from('phases').select('client_id,n,type,form,date,summary,med,secs').order('n')),
      all(db.from('weigh_ins').select('*').order('date')),
      all(db.from('health_review').select('*')),
      all(db.from('client_notes').select('*').order('at', { ascending: false })),
      all(db.from('change_log').select('*').eq('undone', false).gte('at', since).order('at', { ascending: false }).limit(1000)),
      all(db.from('settings').select('*').in('key', ['tag_rules'])),
    ]);
    build({ clients, sheet, phases, weighins, health, notes, log, settings });
  }

  // ---- writes: one edits document in, the matching table writes out ----
  const bodyOf = id => ({ ...(S.rows[id]?.client.body || {}) });
  async function saveBody(id, body) {
    await must(db.from('clients').update({ body }).eq('id', id));
    S.rows[id].client.body = body;
  }
  async function saveClient(id, patch) {
    await must(db.from('clients').update(patch).eq('id', id));
    Object.assign(S.rows[id].client, patch);
  }

  // Saves run one at a time, so two edits fired together (nutrition + calories) never overwrite each other.
  let queue = Promise.resolve();
  const enqueue = fn => { const run = queue.then(fn); queue = run.catch(() => {}); return run; };
  function saveEdits(id, next) {
    const prev = clone(S.edits[id] || {});
    S.edits[id] = clone(next);
    return enqueue(() => writeEdits(id, prev, next));
  }

  async function writeEdits(id, prev, next) {
    const changed = k => !same(prev[k], next[k]);
    const body = bodyOf(id);
    const set = { ...(body.coach_set || {}) };
    let bodyDirty = false;
    const bset = (k, v) => { if (!same(body[k], v)) { body[k] = v; bodyDirty = true; } };

    if (changed('phase')) { await saveClient(id, { phase: +next.phase }); set.phase = true; }
    if (changed('goal')) { await saveClient(id, { goal: next.goal, goal_src: '' }); set.goal = true; }
    if (changed('name') && next.name) await saveClient(id, { name: next.name });
    if (changed('coach') && next.coach) await saveClient(id, { coach: next.coach });
    if (changed('pf')) await saveClient(id, { profile: { ...(S.rows[id].client.profile || {}), ...(next.pf || {}) } });
    if (changed('poa')) {
      await saveClient(id, { plan_of_action: next.poa?.text || '' });
      bset('notes_at', { ...(body.notes_at || {}), poa: next.poa?.at || '' });
    }
    if (changed('extra')) {
      await must(db.from('client_notes').delete().eq('client_id', id));
      if (next.extra?.text) await must(db.from('client_notes').insert({ client_id: id, body: next.extra.text, who }));
      bset('notes_at', { ...(body.notes_at || {}), extra: next.extra?.at || '' });
    }
    if (changed('nut')) {
      const n = next.nut || {};
      bset('protein', n.p ?? null); bset('carbs', n.c ?? null); bset('fats', n.f ?? null);
      if (n.kcal != null) bset('calories', n.kcal);
      set.nut = true;
    }
    if (changed('target')) bset('goal_weight', next.target ?? null);
    if (changed('formWeight')) bset('onboarding_weight', next.formWeight ?? null);
    if (changed('snooze')) bset('snooze', next.snooze || {});
    if (changed('psum')) for (const [n, sum] of Object.entries(next.psum || {}))
      if (!same((prev.psum || {})[n], sum)) await must(db.from('phases').update({ summary: sum }).eq('client_id', id).eq('n', +n));
    if (changed('hr')) for (const [cat, h] of Object.entries(next.hr || {})) {
      const o = (prev.hr || {})[cat] || {};
      if (o.r === h.r && o.n === h.n) continue;
      await must(db.from('health_review').upsert({ client_id: id, category: cat, result: h.r || null, note: h.n || '', updated_by: who, updated_at: new Date().toISOString() }));
    }
    if (changed('wt')) {
      const old = new Set((prev.wt || []).map(w => w.d + ':' + w.v));
      for (const w of next.wt || []) if (!old.has(w.d + ':' + w.v))
        await must(db.from('weigh_ins').upsert({ client_id: id, date: w.d, kg: w.v, source: 'Coach entry' }, { onConflict: 'client_id,date,source' }));
    }
    if (changed('sheet')) await writeSheet(id, prev.sheet || {}, next.sheet || {});
    if (changed('ob')) console.warn('Typeform profile fill arrives with the Brain (step 5); not saved:', id);

    if (!same(set, body.coach_set || {})) { body.coach_set = set; bodyDirty = true; }
    if (bodyDirty) await saveBody(id, body);
  }

  const SHEET_COLS = ['rs', 'start', 'end', 'form', 'wo', 'app', 'cf', 'rem', 'st', 'act', 'note', 'cs', 'wn', 'rf', 'ds', 'w', 'dn', 'dds'];
  async function writeSheet(id, prev, next) {
    const patch = {};
    for (const k of SHEET_COLS) if (!same(prev[k], next[k])) patch[k === 'end' ? 'end' : k] = next[k] === '' && (k === 'start' || k === 'end') ? null : next[k];
    if ('end' in patch) patch.end_typed = true;
    if (Object.keys(patch).length) await must(db.from('sheet_rows').update(patch).eq('client_id', id));
    if ('ds' in patch) {
      const k = kcalFromDs(patch.ds);
      if (k != null) { const body = bodyOf(id); body.calories = k; await saveBody(id, body); }
    }
    if (prev.archived !== next.archived) console.warn('Expire / reactivate arrives with the Sheet (step 4); not saved:', id);
  }

  async function writeFeed(doc) {
    const fresh = (doc.items || []).filter(x => !savedFeed.has(x.t));
    if (!fresh.length) return;
    fresh.forEach(x => savedFeed.add(x.t));
    const name = id => S.rows[id]?.client.name || null;
    await must(db.from('change_log').insert(fresh.map(x => ({
      at: new Date(x.t).toISOString(), who, via: x.src === 'claude' ? 'brain' : x.src === 'sheet' ? 'sheet' : 'portal',
      client_id: x.client || null, client_name: x.client ? name(x.client) : null, field: x.title,
      new_value: { title: x.title, detail: x.detail || '', kind: x.kind, src: x.src, ...(x.tone ? { tone: x.tone } : {}) },
    }))));
    S.feed[doc.day] = clone(doc);
  }

  async function writeRules(r) {
    const value = {};
    for (const [d, k] of Object.entries(RULE_KEYS)) if (r[d] != null) value[k] = +r[d];
    await must(db.from('settings').upsert({ key: 'tag_rules', value }));
    S.rules = clone(r);
  }

  const doc = k => ({
    get: async () => snapDoc(k, docVal(k)),
    async set(d) {
      const [c, id] = k.split('/');
      if (c === 'edits') return saveEdits(id, d);
      if (c === 'feed') return enqueue(() => writeFeed(d));
      if (k === 'settings/rules') return enqueue(() => writeRules(d));
      throw new Error('Read-only: ' + k);
    },
    onSnapshot(next) {
      const f = () => next(snapDoc(k, docVal(k)));
      (L[k] ||= []).push(f);
      return () => { L[k] = L[k].filter(x => x !== f); };
    },
  });

  const store = {
    collection: c => ({
      onSnapshot(next) {
        const f = () => next(coll(c));
        (L[c] ||= []).push(f);
        return () => { L[c] = L[c].filter(x => x !== f); };
      },
      doc: id => doc(c + '/' + id),
    }),
    doc,
    load,
    async reload() { await queue; await load(); fireAll(); },
    fireAll,
    // Stand-in for the Sheet (window.XS) until step 4: only the calorie sync from the profile uses it.
    sheetApply(items) {
      const applied = [];
      for (const it of items) {
        if (it.f !== 'ds' || !S.edits[it.id]) continue;
        const next = clone(S.edits[it.id]);
        next.sheet = { ...(next.sheet || {}), ds: it.raw };
        saveEdits(it.id, next).catch(() => window.dispatchEvent(new CustomEvent('ttl-save-failed')));
        applied.push(it);
      }
      if (applied.length) fire('edits');
      return { applied, skipped: [] };
    },
  };
  return store;
}
