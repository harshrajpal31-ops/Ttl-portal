# Twice the Lean — Coach Portal: build handover

This pack moves the Coach Portal from a claude.ai demo to a real app on Harsh's own domain.
The demo (`reference/portal-demo.html`, open it in any browser) is the agreed design and behaviour.
Everything below was decided with Harsh between 18 and 30 Oct 2026. Rebuild it properly, keep the
look and the rules, do not redesign.

Owner: Harsh Rajpal (founder, head coach). Second coach: Shrutika.
Harsh reviews everything on his phone — every screen must work at 390 px wide.
Brand colour `#3F59A7`. Logo: `assets/logo_white.png` (white mark, shown on a `#2D2C2A` rounded tile).
Communication with Harsh: simple, direct, one recommendation, flag problems early.

---

## 1. Stack (agreed, keep costs near zero)

| Piece | Choice | Cost |
|---|---|---|
| Code | GitHub repo | free |
| Hosting | Netlify (Harsh's site twicethelean.com is already there) — use `portal.twicethelean.com` | free |
| Database + logins | Supabase **free plan** (Postgres + Auth) | free |
| Backups | Nightly job exports the whole database to Harsh's Google Drive, keep 30 days (replaces paid Supabase backups) | free |
| Brain (AI) | Anthropic API key, server-side only | pay per use, ~2–10 cents a message |
| Scheduled jobs | Netlify scheduled functions (or Supabase cron) | free |

Rules:
- API keys (Anthropic, Typeform, Notion) live only in server functions / env vars, never in the browser.
- Use a cheaper Claude model for simple Brain actions and a stronger one for writing profiles/summaries.
- Daily use plus the nightly jobs keep the free Supabase project from pausing (it pauses after 7 days idle).
- Two logins: Harsh (owner, sees everything) and Shrutika. Ask Harsh before deciding whether Shrutika sees only her clients or everyone.

---

## 2. Data in this pack

| File | What it is |
|---|---|
| `data/Check-in & Progress sheets (30 Oct 2026).xlsx` | Harsh's latest Apple Numbers export (source of truth on 30 Oct). Tick boxes were exported as text `True`/`False`; blank = not set. |
| `data/clients.json` | 90 active clients (Harsh 38, Shrutika 52) already joined from the sheet + Typeform: sheet fields, `profile` (summary, med, flags, diet, food, allergy), `phases` (each onboarding/renewal form with sections of answers), `formWeight`, `goal`, `obForm`, `obDate`, `email`. 87 have phases; Gourang Sharma, Priyanka Joshi, Tanvi Patwa have no form yet. |
| `data/expired_and_hold.json` | 433 rows from the "Expired and hold client" tab: name, coach (`Harsh`/`Shrutika`/`''` for grey 2023–24 rows), status, start, end, `xn` (Notes + 15 more note columns), `nbg` name colour, `sbg` status colour. Some end dates are literally `90` (formula with no start date) — show as written. |
| `data/sheet_options_and_colours.json` | Exact dropdown options and exact cell colours from the sheet (`options` keyed `form`, `wo`, `rem`, `st`, `act`, `cs`; `colours` same keys → `[bg, text]`), plus All Dates name colours and roster-status colours. |
| `reference/portal-demo.html` | The full working demo (portal + sheet + Brain). Use it as the visual and behavioural spec. |
| `reference/brain.js` | Brain's tools, rules prompt and UI from the demo. Port the logic server-side. |

Sheet tabs → fields (keep these field keys):
- Check-in: `form` (Form/Program), `wo` (Workouts — Shrutika's clients only), `app` (App Check-in, tick), `cf` (Check-in Form, tick), `rem` (Reminders), `st` (Check-in Status), `act` (Check-in Action), `note` (Check-in Notes).
- Progress: `cs` (Client Status), `wn` (Weekly Notes), `rf` (Refeed/Diet Break), `ds` (Deficit/Surplus, e.g. `2000-1500=500`), `w1..w12` (Week 1–12 coach notes).
- All Dates List: `rs` (Status: Active / Yet to start / On hold / Expired), `start`, `end`, `dn` (Notes), `dds` (Deficit/Surplus column of this tab — separate, empty today).
- Expired and hold: `rs`, `start`, `end`, `x1..x16` (Notes + 15 untitled columns).

Name aliases already resolved: Adi Khandelwal = Aditya Khandelwal; Orijeet Mukherjee = Oriijeet Mukherji/Mukherjee; Harshita Wadhwa = Harshita Wadhva. There is no Avesh Sharma (only Avesh Verma, now expired).

Known sheet gaps to show Harsh, not fix silently: no start date for Aadi Joshi, Adi Khandelwal, Orijeet, Tanisha Talreja, Tanvi Patwa, Priyanka Joshi; Soumya Arora missing from Harsh's Progress tab.

---

## 3. Portal (main screen)

- Header: logo, "Coach Portal", last sync line, **Refresh** button, **Sheet** button. Mobile: Refresh and Sheet sit side by side on their own row under the title.
- Coach switch on top: All / Harsh / Shrutika with counts.
- Tiles show only: name, check-in status pill, check-in action pill (+N more tags). No initials, no goal, no week, no colour bar, no "plan of action due".
- Status pills use the **exact sheet words and colours** (`SHEET_ST`, `SHEET_ACT` in the demo). "TBD" instead of "Not set".
- Grouped sections in this order: Needs you · In progress · Skipping this week · Check-in closed · TBD · On hold. Skip and On Hold are real statuses, not "neglected".
- **Filter** button: Check-in status list, divider, Check-in action list (with counts), divider, **Expired → Show expired clients**. Separate **Tags** button with the tag list and "Edit tag rules".
- Tags (auto, from data): Silent, Missing check-in, Regaining, Plateau, Workouts slipping, Discipline falling, Renewal window, Thriving. Editable thresholds (defaults): silent 7 days, plateau 3 weeks < 0.5 kg, regaining 3 weeks ≥ 1.0 kg, workouts slipping by 1 session, discipline falling 3 check-ins, renewal from week-10 coach note, thriving 4 check-ins. Renewal window shows **only inside the profile**, and only once coach notes exist through week 10.
- Recent updates feed: every change (portal, sheet, Brain) logged with who/when.

## 4. Client profile

Header: name, editable **Phase** select (1–10), form, end date, coach, week X of 12, editable **Goal** (Fat Loss / Muscle Gain / Recomp / Recovery / Health; Recomp is always set by a coach), status pills, tags.
Expired clients: red banner "Expired on <date> · history kept until <date+1y>" with **Move back · Reactivate**.

Tabs: **Profile · Coach notes · Check-ins · Onboarding**.

Profile tab, top to bottom:
1. **Profile summary by phase.** Phase 1 (the onboarding form) always first and open; later phases (renewal forms) collapsed below. Phase rules: every onboarding or renewal form is a phase; a re-filled main onboarding form becomes Phase 1 and the latest one is the profile; coaches can override the phase number.
2. **Health review · coach copy** (mirrors Harsh's Numbers coach copy). Rows: Previous History, Medical Conditions, Digestive Health, Bowel Health, Sleep, Stress, Discipline, Social Life / Travel, Supplements / Meds, Additional Notes. Columns: Category | Result | From the form | Coach notes.
   - "From the form" = a **concise summary of what the client reported**, not the Q&A (rules in `hrForm` in the demo).
   - Result is auto-marked from the form ("Auto · Applicable" etc., shown lighter/italic) until the coach picks one. Options: Yes, No, Applicable, Not applicable, Fine, Needs Attention, Low, Medium, High.
   - Auto rules: Digestive/Bowel normal → Not applicable, reported → Applicable, bad reflux / constipated most of the time → Needs Attention. Sleep counts issues (short hours, not enough, poor quality, wakes tired/lethargic, trouble falling asleep): 0 → N/A, 1–2 → Applicable, 3+ or insomnia → Needs Attention. Stress: too stressed or stress-eating → Applicable; out of control, or too stressed + stress-eating → Needs Attention. Medical: anything → Applicable; heart, pregnancy, blackouts, dizziness, breathlessness, depression → Needs Attention. Previous History, Supplements → Yes/No. Discipline from readiness score 9–10 High, 6–8 Medium, ≤5 Low. Social: party / twice+ a week / eats out more than twice → High; hardly + rarely eats out → Low; else Medium.
   - Colours: Needs Attention red `#EE8C7C`; N/A/Fine/No/Low green `#E3F1D9`; Discipline High green, Low red; Social High amber `#FBE3B5`.
   - Coach note: yellow text box, saves on blur. Header counts "x of 10 confirmed by coach".
   - Medical issues each live in one row only (stress-eating under Stress, supplements under Supplements).
3. Diet preference pill and Food restrictions (allergy highlighted).
4. Weight trend from Trainerize (1M / 3M / All / Custom, 7-day average or daily).
5. **Body and nutrition**: current weight (Trainerize or "Coach entry"), onboarding weight, change, goal weight; calories + protein/carbs/fat (each optional), macros total.
   - **Calories sync both ways with the sheet's Deficit/Surplus column**: `2000-1500=500` → profile 1500; setting 1650 rewrites it to `2000-1650=350` (`A+B=C` form for surplus); unparseable text becomes the plain number. Macros live only in the portal.

Coach notes tab: Plan of action and Extra notes (dated lines). Check-ins tab: weekly Typeform check-ins (to build). Onboarding tab: every form answer by section, one block per phase.

## 5. The Sheet (replaces Apple Numbers)

Full-screen, Apple Numbers look: brand-blue header row `#3F59A7`, bold 2 px column borders, whole-cell colour fills from the exact sheet colours, letter row + row numbers, frozen header row and name column (smooth when scrolling), name column without initials or week.
Tabs: **Check-in · Progress · All Dates List · Expired and hold**. Coach switch All/Harsh/Shrutika, search, inspector side panel (Client / Changes), status bar with selection stats.

Spreadsheet behaviour: click/drag/shift-click ranges, column/row/all select, type to edit, dropdown popover with type-to-filter (prefix matches first), copy/cut/paste TSV (validated per column), ⌘D fill down, Delete clears, ⌘Z undo, change log with Undo, small yellow **fill-handle dot** (9 px, 14 px on touch) to drag a value down/up.
**Sort** on every column header of every tab: ⇅ → A→Z → Z→A → off; blanks last.

All Dates List must look like Harsh's sheet: headers NAMES / STATUS / START DATE / END DATE / Notes / Deficit / Surplus, then empty filler columns to the right edge with the blue header continuing; names coloured by coach (Harsh green `#BDD6AB`, Shrutika blue `#A9C1F0`); status colours Active `rgba(175,228,137,.9)`, Yet to start `rgba(255,252,152,.9)`, On hold `rgba(152,239,234,.9)`, Expired `rgba(255,151,129,.9)`.
Expired and hold: headers Name of Client / Status / Start date / End date / Notes + 15 untitled; per-row name/status colours from the data file.

Toolbar: New Week, **Saturday** (lists active clients past their end date; ticked ones expire), Add Client, Changes, Export (Excel of all tabs), Inspector.

Rules:
- **End date = start + 90 days**, filled automatically when a start date is set. A typed end date (extension) is kept and not overwritten.
- **Expire**: setting Status to Expired on All Dates List (or Saturday, or Brain) removes the client from Check-in, Progress and All Dates and moves them to Expired and hold with everything kept. Undoable.
- In the portal, expired clients are hidden; visible only via Filter → Expired. Their full history stays for **1 year after expiry**, then they are removed everywhere.
- **Move back · Reactivate** (inspector or profile banner): back to All Dates as **Yet to start** keeping their start date; Check-in: same form type, status Marked Closed; Progress: Client Status Marked Closed; deficit/surplus, refeed/diet break and weekly notes restored from history. For old sheet-only rows: ask coach (if grey), old notes go into Weekly Notes, then Brain builds the profile.
- The 433 historical rows stay in the sheet only (not in the portal) and the 1-year rule does not apply to them for now.
- Add Client: name, coach, start date, form; duplicate names are blocked; triggers Brain to build the profile from Typeform.

## 6. Brain 🧠

Floating 🧠 button bottom-right on portal and sheet; opens a right-docked chat panel (bottom sheet on phone) that pushes the page left so nothing is covered; the button hides while open. Closing with ✕ clears the chat back to the home screen. Stop button while working. After each reply the portal refreshes itself.

Authority: Brain can do everything a coach can, directly, without asking "should I?" (asks only when a name is ambiguous or a value isn't an allowed option). Every change is logged.
Tools (see `reference/brain.js`):
- `find_clients`, `get_client` (sheet, notes, profile, health review, nutrition, body, all phases), `open_client`.
- `update_clients`: any sheet column (dropdowns only accept listed options), phase, goal, plan of action, extra notes, `add_note` (dated append), profile summary, diet, food, allergy, medical add/remove/replace, calories (rewrites sheet Deficit/Surplus), protein/carbs/fats, current weight (weigh-in marked "Coach entry"), goal weight, onboarding weight, client name, coach, phase N summary, `health_<cat>_result` / `health_<cat>_note`, roster status incl. Expired.
- **Rule**: calorie/macro/weight requests change only Body and nutrition (+ sheet calories), never the profile summary or form record.
- `create_notion_task` and the **progress-sheet routine** (below).
- `fetch_onboarding` + `save_profile` (Typeform → profile, below).

### Notion
Daily Tasks database (data source `collection://f2fb6aa7-3cb6-4dd0-839b-83f8e6c920f3`). Properties: Name (title), Due Date (status: Today, Tomorrow, Later This week, Next week, Undecided), Status (Not started, In progress, Done), Assign (person).
People: Harsh `0c182b51-8a92-46cf-907e-32f949dea8bc`, Shrutika `d3103dd3-f183-48ee-857f-26ae2d050394`.
Views: Harsh's Tasks (Harsh only), Shrutika's Tasks (Shrutika only), Collaborated Tasks (both).
Assignment: from Harsh's sheet/client → Harsh only; from Shrutika's sheet/client → Shrutika only; generic team task → both. Every task is a row in the same database.

**Routine "check my progress sheet and move Harsh/Shrutika tasks to Notion"** (one coach at a time; ask which if not named): take that coach's clients whose Client Status is Changes required, Meal Plan Changes or Workout Changes; title `<Client name> – <Weekly Note>` (or the status if the note is empty); body = Weekly Note; Due Today; Not started; assigned per the rule above; skip any client who already has an open (not Done) task with their name; report created and skipped.

### Typeform (account `01GRXRVGPD0FDMKXDGYS4EGF1M`)
Onboarding forms (Phase 1 / profile):
- Harsh's Onboarding Questionnaire `cxnxmVaA` (first name `xFJvpuljjCSl`, last name `iKV04aFFLE0q`)
- Shrutika's OB Questionnaire – New `bdT7rElU` (`RhkceWR7BCSk`, `2UiKXFiG5qEn`)
- Old OB Questionnaire Shrutika `N0XYQnhc` (`CFhK30AGQIBX`, `c6GRuPcHQdE3`)
Renewal forms (later phases, must be as detailed as onboarding and highlight new medical issues): Next Phase OB `hV1ATWrG`, Accelerator Method onboarding `M18epO23` and `dBKZPXLU`, Accelerator / Next phase `bMgBpcjy`, Shrutika Accelerator Master `shYnmzi6`, Shrutika's Fat loss Master `X5X3C0jK`.
Check-in forms (for the Check-ins tab later): Harsh's fat loss Checkin `zoxN0bGC`, Harsh's Next phase Checkin `daNxqEge`, Muscle Gain Checkin `V9KQ2RVz`, NC check-in form `eaqMQB98`, Harsh NC form `XRpahfhD`, Recovery Check-In `VTevqM4g`.

New client flow: match by name in the coach's own onboarding form(s) first, then the other coach's; exact name > first name + surname start > first name only (ask before saving). Fill Phase 1 (all answers by section), summary (style: "26, female, salaried; 164 cm and 60 kg. Wants a lean, toned, strong body; reached her goal weight before but felt weak and lethargic. Migraines, cervical issues and bad acidity. Rarely goes out."), medical, flags, diet, food restrictions, allergy, onboarding weight, goal (unless a coach set it). Medical/diet/food are extracted by rules, not guessed (see `tfExtract` in brain.js).
In the real app this should also run automatically on a schedule: a new onboarding submission creates or updates the profile without anyone asking.

---

## 7. What the hosted version adds (the reason for moving)

- One shared database: Harsh and Shrutika see the same live data on every device.
- Logins for both coaches; Brain on the business API key for both.
- Scheduled jobs: nightly Typeform check (new onboarding/renewal/check-in forms), daily expiry handling + 1-year cleanup, nightly Google Drive backup, weekly Trainerize pull (needs Trainerize Studio API — Harsh is considering it), optional morning summary.
- Calendly booked calls can set status to Call Booked (later).
- Apple Numbers has no API: the portal's sheet replaces it. Two-way Google Sheet sync was discussed and parked — confirm with Harsh before building it.

## 8. Suggested build order

1. Repo + Netlify + Supabase project + auth (two coaches). Schema for clients, sheet rows, expired rows, phases, edits/history, health review, notes, change log.
2. Import `clients.json`, `expired_and_hold.json`, options/colours. Check counts: 90 active (Harsh 38, Shrutika 52), 433 expired/hold.
3. Portal screens (tiles, filters, tags, profile tabs) matching the demo.
4. Sheet (all four tabs, editing, paste, fill handle, sort, expire/reactivate, 90-day rule).
5. Brain server function + tools, then Notion routine, then Typeform profile flow.
6. Scheduled jobs + Drive backup.
7. Run alongside Numbers for 1–2 weeks with both coaches, then switch over.

Ask Harsh before: anything that deletes data, the Shrutika visibility question, Google Sheet sync, Trainerize Studio.
