-- Twice the Lean coach portal: base schema.
-- One shared coach login sees and edits everything. The person using it
-- (Harsh / Shrutika) is picked in the app and stored on every change as `who`.

-- Active clients (portal + Check-in / Progress / All Dates List tabs).
create table clients (
  id            text primary key,              -- slug, e.g. 'raghav-sharma'
  name          text not null,
  coach         text not null check (coach in ('Harsh','Shrutika')),
  email         text default '',
  phase         int  not null default 1 check (phase between 1 and 10),
  goal          text default 'Not set',        -- Fat Loss / Muscle Gain / Recomp / Recovery / Health
  goal_src      text default '',               -- '' = coach set it; otherwise how it was inferred
  ob_form       text default '',
  ob_date       date,
  profile       jsonb not null default '{}',   -- sum, med, flags, diet, food, allergy
  body          jsonb not null default '{}',   -- calories, protein, carbs, fats, goal_weight, onboarding_weight
  plan_of_action text default '',
  expired_at    date,                          -- set when moved to Expired and hold
  purge_after   date,                          -- expired_at + 1 year
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index clients_name_unique on clients (lower(name)); -- duplicate names blocked

-- Sheet cells, one row per client. Field keys match the handover.
create table sheet_rows (
  client_id text primary key references clients(id) on delete cascade,
  -- All Dates List
  rs    text not null default 'Active' check (rs in ('Active','Yet to start','On hold','Expired')),
  start date,
  "end" date,
  end_typed boolean not null default false,    -- true = extension typed by coach, never auto-overwritten
  dn    text default '',
  dds   text default '',
  -- Check-in
  form  text default '',
  wo    text default '',                       -- Shrutika's clients only
  app   boolean,                               -- null = not set
  cf    boolean,
  rem   text default 'TBD',
  st    text default 'TBD',
  act   text default 'TBD',
  note  text default '',
  -- Progress
  cs    text default 'TBD',
  wn    text default '',
  rf    text default '',
  ds    text default '',                       -- e.g. '2000-1500=500', synced with body.calories
  w     text[] not null default array_fill(''::text, array[12]),  -- Week 1..12 coach notes
  updated_at timestamptz not null default now()
);

-- Expired and hold tab. Historical rows (433) have client_id null and live in the sheet only.
create table expired_rows (
  id         text primary key,
  client_id  text references clients(id) on delete set null,
  name       text not null,
  coach      text default '',                  -- '' for grey 2023-24 rows
  rs         text default '',
  start      text default '',                  -- text on purpose: some sheet values are literally '90'
  "end"      text default '',
  x          text[] not null default array_fill(''::text, array[16]),  -- Notes + 15 untitled
  nbg        text default '',
  sbg        text default '',
  hist       boolean not null default false,
  saved_sheet jsonb,                            -- full sheet row at expiry, used by Reactivate
  created_at timestamptz not null default now()
);

-- Phases: every onboarding or renewal form. Phase 1 = latest main onboarding form.
create table phases (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null references clients(id) on delete cascade,
  n          int  not null,
  type       text not null,                    -- Onboarding / Renewal
  form       text default '',
  date       date,
  summary    text default '',
  med        jsonb not null default '[]',
  secs       jsonb not null default '[]',      -- [[section, [[question, answer], ...]], ...]
  typeform_response_id text unique,
  created_at timestamptz not null default now(),
  unique (client_id, n)
);

-- Health review · coach copy. Coach result overrides the auto result.
create table health_review (
  client_id  text not null references clients(id) on delete cascade,
  category   text not null,
  result     text check (result in ('Yes','No','Applicable','Not applicable','Fine','Needs Attention','Low','Medium','High')),
  note       text default '',
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (client_id, category)
);

-- Extra notes (dated lines) on the Coach notes tab.
create table client_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null references clients(id) on delete cascade,
  body       text not null,
  who        text,
  at         timestamptz not null default now()
);

-- Weigh-ins: Trainerize pulls and coach entries.
create table weigh_ins (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null references clients(id) on delete cascade,
  date       date not null,
  kg         numeric(5,2) not null,
  source     text not null default 'Coach entry',  -- 'Trainerize' or 'Coach entry'
  unique (client_id, date, source)
);

-- Weekly Typeform check-ins (Check-ins tab, built later).
create table checkins (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null references clients(id) on delete cascade,
  form       text not null,
  submitted_at timestamptz not null,
  answers    jsonb not null default '[]',
  typeform_response_id text unique
);

-- Every change from portal, sheet or Brain. Powers Recent updates, Changes panel and Undo.
create table change_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  who        text not null,                    -- 'Harsh' / 'Shrutika'
  via        text not null check (via in ('portal','sheet','brain','job')),
  client_id  text,
  client_name text,
  tab        text,
  field      text,
  old_value  jsonb,
  new_value  jsonb,
  undone     boolean not null default false
);
create index change_log_at on change_log (at desc);

-- Tag thresholds, dropdown options, colours, misc.
create table settings (
  key   text primary key,
  value jsonb not null
);

insert into settings (key, value) values ('tag_rules', '{
  "silent_days": 7,
  "plateau_weeks": 3, "plateau_kg": 0.5,
  "regain_weeks": 3, "regain_kg": 1.0,
  "workouts_slip_sessions": 1,
  "discipline_checkins": 3,
  "renewal_week": 10,
  "thriving_checkins": 4
}');

-- updated_at triggers
create function touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger clients_touch before update on clients for each row execute function touch();
create trigger sheet_rows_touch before update on sheet_rows for each row execute function touch();

-- End date = start + 90 days, unless a coach typed an end date (extension).
create function fill_end_date() returns trigger language plpgsql as $$
begin
  if new.start is not null and not new.end_typed
     and (tg_op = 'INSERT' or new.start is distinct from old.start or new."end" is null) then
    new."end" = new.start + 90;
  end if;
  return new;
end $$;
create trigger sheet_rows_end before insert or update on sheet_rows for each row execute function fill_end_date();

-- Access: the single shared coach login (any signed-in user) can do everything.
-- Nobody else can read anything. Server functions use the service key.
do $$
declare t text;
begin
  foreach t in array array['clients','sheet_rows','expired_rows','phases','health_review',
                           'client_notes','weigh_ins','checkins','change_log','settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy coach_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
