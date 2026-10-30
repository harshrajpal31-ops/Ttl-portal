// One-off import of the handover data into Supabase.
//   node scripts/import.mjs --dry-run   -> checks counts, writes nothing
//   node scripts/import.mjs             -> needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DATA = new URL('../handover/data/', import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(f, DATA), 'utf8'));
const DRY = process.argv.includes('--dry-run');

const raw = load('clients.json');
const expired = load('expired_and_hold.json');
const meta = load('sheet_options_and_colours.json');

const B = v => String(v) === 'True' ? true : String(v) === 'False' ? false : null;
const D = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null;
const plus90 = s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 90); return d.toISOString().slice(0, 10); };
const RS = { active: 'Active', 'yet to start': 'Yet to start', 'on hold': 'On hold' };

// Same mapping as rowFrom() in the demo.
const clients = [], sheet = [], phases = [];
for (const r of raw) {
  clients.push({
    id: r.id, name: r.name, coach: r.coach, email: r.email || '', phase: r.phase || 1,
    goal: r.goal || 'Not set', goal_src: r.goalSrc || '', ob_form: r.obForm || '', ob_date: D(r.obDate),
    profile: r.profile || {},
    body: { calories: r.kcal ?? null, onboarding_weight: r.formWeight ?? null },
  });
  const start = D(r.start), end = D(r.end);
  sheet.push({
    client_id: r.id,
    rs: RS[String(r.rosterStatus || '').trim().toLowerCase()] || (r.status === 'New' ? 'Yet to start' : r.status === 'On hold' ? 'On hold' : 'Active'),
    start, end, end_typed: !!(start && end && end !== plus90(start)),
    form: r.form || '', wo: r.coach === 'Shrutika' ? (r.programme || '') : '',
    app: B(r.appCheckin), cf: B(r.formIn), rem: r.reminders || 'TBD',
    st: r.ciStatus && r.ciStatus !== 'Not set' ? r.ciStatus : 'TBD', act: r.ciAction || 'TBD', note: r.ciNotes || '',
    cs: r.clientStatus || 'TBD', wn: r.weeklyNote || '', rf: r.refeed || '', ds: r.kcalText || '',
    w: Array.from({ length: 12 }, (_, i) => (r.notes || [])[i] || ''),
  });
  for (const p of r.phases || []) phases.push({
    client_id: r.id, n: p.n, type: p.type || 'Onboarding', form: p.form || '', date: D(p.date),
    summary: p.sum || '', med: p.med || [], secs: p.secs || [],
  });
}
const expiredRows = expired.map(e => ({
  id: e.id, name: e.name, coach: e.coach || '', rs: e.rs || '', start: String(e.start ?? ''), end: String(e.end ?? ''),
  x: Array.from({ length: 16 }, (_, i) => (e.xn || [])[i] || ''), nbg: e.nbg || '', sbg: e.sbg || '', hist: !!e.hist,
}));

// Checks from the handover (section 8, step 2).
const by = c => clients.filter(x => x.coach === c).length;
const checks = [
  ['active clients', clients.length, 90], ['Harsh', by('Harsh'), 38], ['Shrutika', by('Shrutika'), 52],
  ['clients with phases', new Set(phases.map(p => p.client_id)).size, 87], ['expired/hold rows', expiredRows.length, 433],
];
let ok = true;
for (const [k, got, want] of checks) { const pass = got === want; ok &&= pass; console.log(`${pass ? 'OK  ' : 'FAIL'} ${k}: ${got} (expected ${want})`); }
console.log('Sheet gaps, no start date:', sheet.filter(s => !s.start).map(s => clients.find(c => c.id === s.client_id).name).join(', '));
console.log('Extended end dates kept as typed:', sheet.filter(s => s.end_typed).length);
if (!ok) process.exit(1);
if (DRY) { console.log('Dry run: nothing written.'); process.exit(0); }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function put(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length}`);
}
await put('clients', clients, 'id');
await put('sheet_rows', sheet, 'client_id');
await put('phases', phases, 'client_id,n');
await put('expired_rows', expiredRows, 'id');
await put('settings', [
  { key: 'options', value: meta.options }, { key: 'colours', value: meta.colours },
  { key: 'all_dates_name_colours', value: meta.all_dates_name_colours },
  { key: 'roster_status_colours', value: meta.roster_status_colours },
], 'key');
await db.from('change_log').insert({ who: 'Harsh', via: 'job', field: 'import', new_value: { source: 'Check-in & Progress sheets, 30 Oct 2026' } });
console.log('Import done.');
