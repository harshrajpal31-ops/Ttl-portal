# Twice the Lean — Coach Portal

Rebuild of the claude.ai demo (`handover/reference/portal-demo.html`) as a hosted app at `portal.twicethelean.com`.
Spec: `handover/HANDOVER.md`.

- `supabase/migrations/0001_schema.sql` — database: clients, sheet rows, expired/hold, phases, health review, notes, weigh-ins, check-ins, change log, settings.
- `scripts/import.mjs` — loads the 30 Oct 2026 data. `npm run import:check` verifies counts without writing.
- `src/` — the web app (Vite). One shared coach login; each device picks Harsh or Shrutika so changes are logged by name.
  - `public/portal.js`, `src/portal.css`, `src/portal.html` — the portal screens, ported from the demo with only the data hookup changed.
  - `src/store.js` — maps the demo's documents (clients, edits, feed, rules) to the Supabase tables.

Client data (`handover/data/` and the demo HTML, which embeds it) is deliberately not committed.

## Local
```
npm install
cp .env.example .env   # fill in Supabase keys
npm run dev
```
