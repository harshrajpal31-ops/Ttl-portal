-- Check-in ladder history. Safe to run more than once. Adds, never removes.

-- "Extra support" (Meal Pictures, Daily Check-ins, ...) sits beside Check-in Action.
alter table sheet_rows add column if not exists sup text default '';

-- One line per client per week: where they stood when the week closed,
-- and the highest ladder level they reached during it. Never erased by later changes.
create table if not exists weekly_record (
  client_id text not null references clients(id) on delete cascade,
  week_of   date not null,                     -- Monday of that week
  wk        int,                               -- client's programme week number
  st        text default '',                   -- Check-in Status at week close
  act       text default '',                   -- Check-in Action at week close
  peak      text default '',                   -- highest Check-in Action during the week
  sup       text default '',                   -- Extra support
  coach     text default '',
  saved_by  text default '',
  saved_at  timestamptz not null default now(),
  primary key (client_id, week_of)
);
alter table weekly_record enable row level security;
do $$ begin
  create policy coach_all on weekly_record for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
