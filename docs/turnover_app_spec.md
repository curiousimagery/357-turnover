# Turnover Coordination App: Master Specification

**Version:** 1.4
**Last updated:** June 2026
**Owner:** Daniel Nelson
**Property:** 357 26th Ave, Seattle, WA 98122 (basement Airbnb unit)

> **Changes in 1.1:** named the three cleaners and the backup dynamic; added schedule filtering (all / mine / unclaimed); framed claiming as a commitment with ample-notice expectations; made same-day status dynamic (a relaxed turnover can flip to same-day on a late booking, which notifies the assigned cleaner) with a standing "arrive before noon" expectation; added admin-to-cleaner feedback notes as a durable record; added per-cleaner color and initials tags; added a calendar view as an explicitly deferred nice-to-have with the list staying primary.
>
> **Changes in 1.2:** recorded the real iCal feed and its expected end-date convention (turnover date equals the parsed DTEND, cross-referenced to the Kaitlyn booking, final byte check pending); set the timezone to America/Los_Angeles (Pacific); modeled linen inventory as individual sheet sets and duvet sets carrying kind, color, and brand, and added managing them to admin CRUD; refined the timing window (soft 11:00 checkout, cleaner arrives 11:30 to noon, finish by 4:00, start early for curveballs, no rushing).
>
> **Changes in 1.3:** confirmed the end-date convention against the real feed (Kaitlyn `DTEND` is `20260625`, the checkout date); specified reservation detection by the `Reserved` summary and exclusion of `Airbnb (Not available)` blocks from both derivation and same-day detection (the real feed has a reservation checking out Aug 31 as a block starts Aug 31, which must not read as same-day); store the reservation URL on bookings (admin-only) for click-through and deliberately drop the guest phone last-4 the feed includes; restricted bookings to admin and system; captured the real summer feed as the canonical test fixture.
>
> **Changes in 1.4:** added the Implementation Status note below (what is actually built vs. still aspirational in this spec) and pointers to the durable repo docs that track day-to-day reality.

---

## Implementation Status (as of June 2026)

This spec is the **why/what** source of truth. Day-to-day reality lives in the
repo docs: `DATA_MODEL.md` (the schema as built), `CLAUDE.md` (phase status),
`DECISIONS.md` (choices/reversals), `docs/GO_LIVE.md` (steps to ship), and
`docs/BACKLOG.md` (what's next). Where this spec and the code disagree, those
files reflect the code.

- **Live (Phases 0–4):** auth, calendar sync + derivation, claiming/filtering +
  manual turnovers, notifications (email + in-app) + reminders + per-type
  preferences + health endpoint, closeout checklist + completion, guest feedback,
  admin→cleaner notes + per-cleaner history, personal tags.
- **Built, pending merge (Phases 5–6, branch `phase-5-6`):** linen tracking with
  the low-set warning; payment status with per-cleaner privacy (default rate +
  per-turnover override + yearly total); a profile-dropdown header.
- **Deferred to backlog (specified here but not built):** coordination requests
  (5.10), per-turnover inventory "running low" flags (5.7), maintenance/durable
  flags (5.8). A generic, shared, admin+cleaner-editable **turnover notes** field
  is the planned near-term replacement for the granular coordination flow.
- **Known spec↔code deltas:** "cleaner notes" (5.14) are implemented as
  `notifications` rows (`type='cleaner_note'`), not a `cleaner_notes` table;
  payment data lives in its own `payments`/`cleaner_rates` tables, not as columns
  on `turnover_assignments` (4.1); the closeout checklist/inventory are
  admin-editable **reference** sheets, not the `supply_items`/`inventory_flags`
  low-stock workflow (5.7); `guest_feedback` is cleanliness + note only (no
  `damages`/`missing_items`).

---

## 0. How To Use This Document

This is the single source of truth for the app. It is written to be handed to Claude Code and carried between chats.

It moves from least technical to most technical:

1. **Product Definition:** who this is for, what it must do, and how we know it worked.
2. **Domain Model:** the shared vocabulary (Turnover, Booking, Block, Set) that both product and code use.
3. **Technical Architecture:** the stack, the sync pipeline, and the reliability design.
4. **Data Model:** the database schema and the permission matrix.
5. **Feature Specifications:** each feature in build-ready detail.
6. **Design System and Interaction Design:** tokens, components, screens, and the methodical UI workflow.
7. **Claude Code Working Agreement:** the rules of engagement that keep the project lean.
8. **Build Sequence:** phased milestones, each independently demoable.
9. **Kickoff Prompt:** a paste-ready prompt to start Claude Code.

When this spec and live code disagree, update this spec in the same change. A stale spec is worse than no spec.

**Companion files this spec implies creating in the repo** (Section 7 explains each):
`CLAUDE.md`, `DESIGN_TOKENS.md`, `DATA_MODEL.md`, `DECISIONS.md`.

---

## 1. Product Definition

### 1.1 Problem and Goal

Daniel self-manages an Airbnb basement unit and coordinates turnovers with three independent cleaners. The current process relies on manual checking and ad hoc messaging, which risks gaps (a turnover nobody covers) and overlaps (two cleaners showing up). The goal is a small, reliable web app that guarantees every turnover is covered exactly once, and that quietly handles the surrounding admin: restocking heads-up, maintenance notes, guest feedback, laundry tracking, and payment status.

### 1.2 Users and Roles

| Role | Who | Count | Summary |
|------|-----|-------|---------|
| Admin | Daniel | 1 | Sees everything. Manages cleaners, turnovers, supply list, payments. |
| Cleaner | Dianna, Tiffany, Breanna | 3 | Sees the schedule, claims turnovers, completes checklists, leaves feedback. |

Small, known user set. This shapes everything: we optimize for clarity and reliability over scale.

**Roster context that shapes design.** Dianna has been the regular cleaner but is the least available; the intent is to lean increasingly on Breanna and Tiffany, with Dianna staying in the loop mainly as backup. This steady state (two primary cleaners, one backup) is what the laundry model optimizes for: two active cleaners can each hold a clean bedding set while the beds stay covered. The app must not hard-code this; it is context for sensible defaults (for example, laundry thresholds), not a rule.

### 1.3 Strategic Priorities (ordered)

These are ranked. When two priorities conflict, the higher one wins.

1. **Reliability.** The app must not silently fail, double-book, drop a turnover, or send false alarms. Correctness of the schedule is sacred. Notifications are a convenience layer and must never be load-bearing for correctness.
2. **Simplicity and Maintainability.** Fewer moving parts, fewer vendors, fewer styles, fewer concepts. Daniel must be able to reason about and repair this himself months from now.
3. **Speed and Ease of Use.** Cleaners use this on a phone, mid-turnover, sometimes in a hurry. Glanceable, few taps, forgiving.
4. **Low / Zero Cost.** Stay on free tiers without sacrificing the three priorities above.

### 1.4 User Stories with Acceptance Criteria

**Core: coverage (highest value)**

- *As an admin, when a booking is created, changed, or cancelled on Airbnb, I want the app to reflect it,* so the turnover schedule is always current.
  - Accepts: within one poll cycle, the derived turnover appears, updates, or is marked cancelled. No manual entry required for Airbnb bookings.
- *As a cleaner, I want to see all upcoming turnovers and which are unclaimed,* so I can pick up work.
  - Accepts: schedule lists each turnover by date, claimed / unclaimed state, and who claimed it. Same-day turnovers are visually unmistakable.
- *As a cleaner, I want to filter the schedule by all turnovers, my turnovers, or unclaimed turnovers,* so I can focus on what is mine or find open work fast.
  - Accepts: a simple segmented filter with three options; the default view is the full list.
- *As a cleaner, I want to claim a turnover and have it instantly reflected for everyone,* so two of us never show up.
  - Accepts: a turnover can be claimed by at most one cleaner. A second simultaneous claim fails gracefully with "X already claimed this."
- *As a cleaner, I want to release a turnover I genuinely cannot do,* so it returns to the pool and the admin is alerted.
  - Accepts: unclaim returns it to unclaimed and notifies the admin. The interface frames a claim as a commitment and asks for ample notice (see 5.3); short-notice removal prompts a gentle confirmation rather than a hard block.

**Coordination (luggage / early check-in)**

- *As an admin, I want to ask the assigned cleaner whether a guest may drop luggage during the turnover,* so I can decide whether to adjust the Airbnb check-in time.
  - Accepts: admin raises a luggage-drop request on a turnover, the assigned cleaner is notified, responds yes / no, and the admin is notified of the answer.
- *As an admin, on a same-day turnover, I want to ask the cleaner if they will finish by a certain time,* so I can offer the guest early check-in.
  - Accepts: admin raises an early-check-in request with a target time, cleaner responds yes / no / "done by X."
- *As an admin, I want to know the moment a cleaner marks a same-day turnover complete,* so I can tell the waiting guest.
  - Accepts: completing a turnover notifies the admin with a timestamp.

**Admin: turnovers and reassignment**

- *As an admin, I want to manually add a turnover for an off-Airbnb stay (friends or family),* so cleaners are coordinated even when the booking is not on Airbnb.
  - Accepts: admin creates a manual turnover with a date and notes. The Airbnb sync never edits or deletes it.
- *As an admin, I want to remove a cleaner from a turnover and reassign,* so I can fix coverage problems.
  - Accepts: admin can unassign; the affected cleaner is notified.

**Changing conditions**

- *As a cleaner, when a late booking turns a relaxed turnover I am assigned to into a same-day turnover, I want to be told,* so I plan for the tighter window.
  - Accepts: the same-day flag is recomputed every sync; a relaxed-to-same-day transition on an assigned turnover notifies that cleaner.

**Admin: durable feedback to cleaners**

- *As an admin, I want to leave a cleaner a note or feedback after a turnover that they can see and that stays on record,* so small details stay sharp without nagging and so I can spot repeated patterns over time.
  - Accepts: admin can attach a note to a completed turnover directed at the assigned cleaner; the cleaner is notified and can view it; notes accumulate into a per-cleaner history.

**Secondary: closeout admin**

- *As a cleaner, I want a quick "before you leave" checklist,* so nothing is missed.
- *As a cleaner, I want to rate how clean the guest left the unit and add a note,* so the admin can rate the guest.
  - Accepts: a 1 to 5 cleanliness slider plus a freeform note, plus optional damages and missing-items fields, tied to that turnover.
- *As a cleaner, I want to flag supplies running low against a known list,* so the admin restocks in time.
  - Accepts: a list of supply items, each with a "running low" toggle and optional note. No exact counts required.
- *As a cleaner, I want to flag durable items needing replacement (stained towel, thin sheets),* so quality stays high.
- *As a cleaner, I want to record which laundry I took with me,* so we never run short of bedding.
  - Accepts: cleaner records which bedding set(s) they took. The app warns if too few clean sets remain for the beds.

**Personalization and at-a-glance scanning**

- *As a cleaner, I want my own initials and a chosen color shown on turnovers I have claimed,* so I (and everyone) can scan the schedule and instantly see what is mine.
  - Accepts: each cleaner can pick a background color; their initials plus color tag appear on their claimed turnovers in the list (and the calendar view, if present).
- *As a cleaner or admin, I would like an optional calendar view in addition to the list,* so I can see the month at a glance. (Nice-to-have; the list is primary. See 6.4 and Section 8.)

**Admin: payments**

- *As an admin, I want to mark a turnover as paid and see each cleaner's payment preference,* without exposing rates between cleaners.
  - Accepts: admin marks paid; each cleaner has a payment preference (for example, Venmo) visible to admin and to that cleaner only; amounts are never visible to other cleaners.

### 1.5 Success / Exit Criteria (MVP Definition of Done)

The MVP is done when all of the following are true for two consecutive real weeks:

- Every Airbnb booking change is reflected in the app within one poll cycle, verified against the Airbnb calendar.
- No turnover is ever claimed by two cleaners, and no covered turnover is shown as unclaimed.
- Same-day turnovers are visibly distinct from relaxed ones at a glance, and a relaxed-to-same-day flip notifies the assigned cleaner.
- A failed or empty feed fetch never produces a false cancellation or a false notification.
- The admin receives a health alert if the sync stops for longer than two poll cycles.
- A nightly database backup exists and has been test-restored once.
- Cleaners can complete a full turnover closeout (checklist, feedback, inventory, laundry) on a phone in under two minutes.
- Total recurring cost is $0.

### 1.6 Explicit Non-Goals (scope guardrails)

To protect simplicity, the app deliberately does **not**:

- Write back to Airbnb. There is no Airbnb write API. The app coordinates humans; Daniel makes Airbnb edits manually.
- Process payments or store financial account details. It tracks paid / unpaid status and a stated preference only.
- Store guest PII. Turnovers are identified by date, not guest identity. The feed provides no names. It does include a reservation URL (kept admin-only for click-through to the booking) and a guest phone last-4, which we intentionally do not store. Cleaners never see guest-identifying data.
- Track exact inventory counts. It surfaces "running low," nothing more.
- Ship as a native mobile app. It is a responsive web app, optionally installable as a PWA.
- Support multiple properties or many users. One unit, four people. Build for that.

---

## 2. Domain Model and Key Concepts

These terms have precise meanings and are used identically in product, schema, and UI.

- **Booking.** A reservation read from the Airbnb iCal feed. Has a check-in date, a check-out date, a stable UID, and a status (active or cancelled). Raw input. We store these for diffing and same-day detection.
- **Block.** A "Not available" entry in the feed that is not a reservation (manual blocks, prep buffers, booking-window markers). We store awareness of these but never derive turnovers from them. Treating blocks as bookings is a known trap that creates phantom turnovers.
- **Turnover.** The operational unit a cleaner works. One turnover per checkout. This is the first-class object in the UI. It is **derived** from a booking's checkout date (for Airbnb) or **created manually** (for off-Airbnb stays).
- **Same-day turnover.** A turnover whose date equals the next booking's check-in date. The unit is vacant only briefly and a new guest arrives that afternoon, so there is a firm downstream deadline.
- **Relaxed turnover.** A checkout with no same-day check-in (yet). The unit sits empty afterward.

**Same-day status is dynamic.** A late booking can turn a relaxed turnover into a same-day turnover after a cleaner has already claimed it. The flag is therefore recomputed on every sync, and a relaxed-to-same-day transition on an assigned turnover is a notifiable change (Section 5.4). Because of this, the timing expectation is the same for every turnover: checkout is 11:00 but softly enforced (guests often need until about 11:15 to 11:30 to fully clear out), so the cleaner aims to **arrive around 11:30 to noon** and to be **finished before 4:00 at the latest**. The turnover itself does not take four hours; arriving early simply leaves room to spot and handle the occasional curveball without anyone having to rush. Same-day turnovers carry a firm guest arrival at the end of that window, which raises the stakes of finishing on time but does not change the routine.

- **Source.** Every turnover is `airbnb` or `manual`. The sync only ever touches `airbnb` turnovers. Manual turnovers are immune to sync.
- **Linen set.** A set of bedding for the unit's two queen beds, tracked as inventory with a location / state so the app can guarantee the beds are always coverable. The exact granularity of a "set" (per bed vs both beds) is confirmed in Appendix A.

**The iCal end-date normalization rule (load-bearing), CONFIRMED.** The feed's `DTEND` holds the **checkout date**, and iCal treats an all-day end as exclusive, so calendars render the block ending the night before. Confirmed against the real feed: the Kaitlyn booking reads `DTSTART;VALUE=DATE:20260622` and `DTEND;VALUE=DATE:20260625`, which Google Calendar renders as ending June 24 (matching Daniel's experiment). The rule is settled: **the turnover date equals the parsed `DTEND`, never minus a day.** That makes the Kaitlyn turnover June 25, which is also same-day because the next guest checks in June 25. Frozen behind a unit test using the captured real feed as a fixture. The real feed lives at the listing whose id is `642786513955690657` (full tokenized URL stored in env, not committed).

**Reservations versus blocks (load-bearing).** The feed contains two event kinds: reservations (`SUMMARY: Reserved`) and blocks (`SUMMARY: Airbnb (Not available)`, used for offline periods). Only reservations produce turnovers, and only reservations count for same-day detection. The real feed proves why this matters: a reservation checks out Aug 31 and a six-week block starts Aug 31, so Aug 31 must be a relaxed turnover, never same-day. Classify by `SUMMARY`, not by UID prefix.

---

## 3. Technical Architecture

### 3.1 Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router), TypeScript | Conventional, deploys cleanly to Vercel, one codebase for UI and API routes. |
| Hosting | Vercel (Hobby / free) | Free, native Next.js, preview deploys per branch. |
| Database | Supabase Postgres (free) | Plain Postgres (portable), generous free tier. |
| Auth | Supabase Auth + RLS | First-party, magic link, JWT integrates with Row Level Security. |
| UI components | shadcn/ui + Tailwind CSS | Code-owned, token-friendly, matches Supabase's own auth UI blocks, includes a date picker. |
| Auth UI | Supabase UI Library (shadcn-based) | Drop-in sign-in scaffolding, restyled to our tokens. |
| Scheduled poller | Supabase Cron (pg_cron) + pg_net | Runs inside the database, no external scheduler, keeps the project awake. |
| Email | Resend (free tier) | Simple API, generous free tier, no phone / carrier overhead. |
| In-app notifications | Supabase Realtime over the notifications table | Free, real-time, no extra vendor. |
| Web push (later) | Web Push API + service worker | Free, native-feeling, added as a third channel without rework. |
| Uptime monitor | UptimeRobot or a GitHub Action (free) | Independent watcher that catches a stalled sync or paused project. |
| Backups | Scheduled `pg_dump` via GitHub Action | Free tier has no automatic backups, so this is mandatory. |

### 3.2 Data Flow (the sync loop)

```
Supabase Cron (hourly)
  -> calls a database function (via pg_net) OR invokes an Edge Function
     -> fetch Airbnb iCal feed (.ics)
        -> parse events (bookings vs blocks)
           -> normalize dates (end-date rule, timezone)
              -> RECONCILE against `bookings` table (idempotent full reconcile)
                 -> DERIVE/UPDATE `turnovers` (airbnb-sourced only), recompute is_same_day
                    -> DIFF vs previous state (added / changed / cancelled / became_same_day)
                       -> ENQUEUE rows in `notifications` (outbox)
                          -> mark sync success, write last_synced_at
Email worker (cron or on-insert) drains pending email notifications
In-app clients subscribe to `notifications` via Realtime
```

### 3.3 The Sync Pipeline in Detail

1. **Fetch.** Retrieve the `.ics` from the stored Airbnb URL. Timeout and retry once.
2. **Guard against empty / failed fetch.** If the fetch fails or returns zero events when we previously had many, **do not** treat it as mass cancellation. Skip the cycle, record the failure, and alert if it persists across cycles. This single rule prevents the worst failure mode.
3. **Parse and classify.** Identify reservations by `SUMMARY: Reserved`. Treat every other event, including `SUMMARY: Airbnb (Not available)`, as a block. From a reservation's `DESCRIPTION`, extract the reservation URL (stored on the booking, admin-only, for click-through to manage the guest) and deliberately discard the guest phone last-4 the feed also includes. Blocks are ignored for turnover derivation and for same-day detection.
4. **Normalize.** Apply the end-date rule. Interpret dates in property local time (America/Los_Angeles). Feed dates are date-only / floating.
5. **Reconcile (idempotent).** Upsert all current reservations into `bookings` keyed by UID. Mark bookings absent from the feed as cancelled (only when the fetch was healthy). Because we reconcile the full current state every run, a missed or failed run self-heals on the next run.
6. **Derive turnovers.** For each active reservation checkout date, ensure an `airbnb` turnover exists on that date. Recompute `is_same_day` every run by checking whether any active **reservation** (never a block) has a check-in on that same date. This distinction is load-bearing: the real feed has a reservation checking out Aug 31 as a long block starts Aug 31, and Aug 31 must read as relaxed, not same-day. Mark turnovers cancelled when their underlying reservation is cancelled (preserve the row; do not hard-delete).
7. **Diff and enqueue.** Compare the new turnover state to the prior state. For genuine adds, date changes, cancellations, and relaxed-to-same-day transitions on assigned turnovers, enqueue notifications. Enqueue is idempotent: re-running the same feed produces no duplicate notifications.
8. **Heartbeat.** On success, write `last_synced_at` and `last_success_at`.

### 3.4 Reliability Architecture

- **Idempotent, self-healing sync** (above). The feed plus the database are the source of truth; every run reconciles full state.
- **Notifications are not load-bearing.** The in-app schedule is always authoritative. If email or push fails, nothing operational breaks.
- **Health endpoint.** `GET /api/health` returns OK only if the database is reachable and `last_success_at` is within two poll cycles. Otherwise it returns degraded with detail.
- **External watcher.** A free uptime monitor pings `/api/health` on its own schedule and emails Daniel on failure. A system cannot be trusted to report its own death, so this watcher is independent of Supabase.
- **Visible staleness.** The UI shows "synced N minutes ago" so a stall is obvious to humans too.
- **Backups.** A nightly `pg_dump` to a private store (GitHub Action). Test-restore once during the build, per the exit criteria.
- **Defensive parsing.** Unknown or malformed events are logged and skipped, never allowed to corrupt state or trigger notifications.

### 3.5 Constraints and Known Gotchas

| Gotcha | Handling |
|--------|----------|
| iCal `DTEND` is exclusive; conventions vary | Normalize per Section 2 rule; guard with a real-feed test. |
| Blocks ("Airbnb (Not available)") can spawn phantom turnovers and false same-day flags | Classify by `SUMMARY`; exclude blocks from derivation AND same-day detection. Confirmed real case: a reservation checks out Aug 31 as a block starts Aug 31. |
| `pg_net` is officially beta | Acceptable and widely used. Keep the fetch swappable to an Edge Function or external trigger if it misbehaves. |
| Supabase free projects pause after about 7 days idle | The hourly cron touches the database every run, preventing pause. The external watcher catches it if it ever happens anyway. |
| Free tier has no automatic backups | Scheduled `pg_dump` is mandatory. |
| Vercel Hobby cron is limited to once per day | We do not use Vercel cron for polling; the poller lives in Supabase. |
| Feed dates are date-only / floating; cron runs in UTC | Store as `date`, interpret in property timezone, compute "same day" in property time. |
| Airbnb feed URL can be regenerated | Store it in config; surface a clear error and alert if it 404s. |
| Same-day status can change after a claim | Recompute every run; notify the assigned cleaner on a relaxed-to-same-day flip. |

### 3.6 Environment and Config

Secrets live in environment variables (Vercel) and Supabase Vault (for anything the database function needs, for example the service role key for `pg_net` calls). Never expose the service role key to the client.

Required config:
- `AIRBNB_ICAL_URL` (the listing's export link; listing id `642786513955690657`; the full tokenized URL is stored in env / secrets, never committed to the repo)
- `SUPABASE_URL`, Supabase publishable key (client), Supabase secret key (server only)
- `RESEND_API_KEY`
- `PROPERTY_TIMEZONE` = `America/Los_Angeles` (Pacific; this IANA zone handles PST and PDT automatically, so summer turnovers compute correctly)
- `POLL_INTERVAL` = hourly (configurable)

---

## 4. Data Model and Permissions

Types are Postgres. Enums are modeled as `text` with `check` constraints for migration friendliness. All ids are `uuid default gen_random_uuid()` unless noted. All tables have `created_at timestamptz default now()`.

### 4.1 Schema (DDL sketch)

```sql
-- Profiles: one row per user, linked to Supabase auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'cleaner' check (role in ('admin','cleaner')),
  payment_preference text,        -- e.g. 'Venmo @handle'; visible to admin + self only
  color text,                     -- chosen tag color (hex or token) for at-a-glance scanning
  active boolean not null default true
);
-- initials are derived from display_name in the app; not stored

-- Bookings: raw reservations from the feed (not blocks)
create table bookings (
  id uuid primary key default gen_random_uuid(),
  uid text unique not null,        -- stable UID from the iCal event
  check_in date not null,
  check_out date not null,
  status text not null default 'active' check (status in ('active','cancelled')),
  raw_summary text,                -- expected 'Reserved'; blocks are not stored here
  reservation_url text,            -- parsed from DESCRIPTION; admin-only via RLS
  -- NOTE: the feed also carries a guest phone last-4; we intentionally do not store it
  last_seen_at timestamptz not null default now()
);

-- Turnovers: the operational unit (derived from checkouts or created manually)
create table turnovers (
  id uuid primary key default gen_random_uuid(),
  turnover_date date not null,
  source text not null check (source in ('airbnb','manual')),
  booking_out_id uuid references bookings(id),   -- the checkout that creates it (airbnb)
  booking_in_id uuid references bookings(id),     -- the same-day check-in, if any
  is_same_day boolean not null default false,     -- recomputed every sync
  status text not null default 'scheduled'
    check (status in ('scheduled','claimed','completed','cancelled')),
  completed_at timestamptz,
  notes text
);
create index on turnovers (turnover_date);

-- Assignment: who is doing a turnover. At most one active assignment per turnover.
create table turnover_assignments (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid not null references turnovers(id) on delete cascade,
  cleaner_id uuid not null references profiles(id),
  claimed_at timestamptz not null default now(),
  paid_at timestamptz,             -- set by admin
  amount numeric,                  -- visible to admin + this cleaner only (RLS)
  bedding_taken text,              -- which set(s) taken; freeform or set ids
  unique (turnover_id)             -- enforces single coverage; the core safety rule
);

-- Linen inventory: individual sheet sets and duvet sets, tracked by location.
-- Specific kind/color/brand prevents mismatched pieces and keeps "who has what" clear.
create table linen_sets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sheet_set','duvet_set')),
  color text not null,             -- e.g. 'Sand', 'Terracotta'
  brand text not null,             -- e.g. 'Quince', 'IKEA'
  label text,                      -- optional friendly label (e.g. 'Set A')
  state text not null default 'clean_backup'
    check (state in ('on_beds','with_cleaner','clean_backup','in_wash')),
  held_by uuid references profiles(id),  -- when state = with_cleaner
  notes text
);

-- Guest feedback per turnover (cleaner -> admin, about the guest)
create table guest_feedback (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid not null references turnovers(id) on delete cascade,
  cleaner_id uuid not null references profiles(id),
  cleanliness smallint check (cleanliness between 1 and 5),
  note text,
  damages text,
  missing_items text
);

-- Cleaner notes (admin -> cleaner, durable feedback record)
create table cleaner_notes (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid references turnovers(id) on delete set null,
  cleaner_id uuid not null references profiles(id),   -- recipient
  author_id uuid not null references profiles(id),     -- admin
  body text not null,
  acknowledged_at timestamptz
);

-- Supply catalog (admin-maintained) and low-stock flags
create table supply_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order int default 0
);
create table inventory_flags (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid references turnovers(id) on delete set null,
  supply_item_id uuid not null references supply_items(id),
  cleaner_id uuid not null references profiles(id),
  note text,
  resolved boolean not null default false
);

-- Durable-goods / maintenance flags
create table maintenance_flags (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid references turnovers(id) on delete set null,
  cleaner_id uuid not null references profiles(id),
  description text not null,
  resolved boolean not null default false
);

-- Coordination requests (luggage drop, early check-in)
create table requests (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid not null references turnovers(id) on delete cascade,
  type text not null check (type in ('luggage_drop','early_checkin','other')),
  message text,
  target_time time,                -- for early check-in
  status text not null default 'pending'
    check (status in ('pending','yes','no','conditional')),
  response_note text,
  created_by uuid not null references profiles(id),
  responder_id uuid references profiles(id),
  responded_at timestamptz
);

-- Notification outbox (channel-agnostic)
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id),
  channel text not null check (channel in ('in_app','email','web_push')),
  type text not null,              -- e.g. 'turnover_added','turnover_cancelled','became_same_day','request','reassigned','cleaner_note'
  title text not null,
  body text,
  turnover_id uuid references turnovers(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','sent','failed','read')),
  sent_at timestamptz,
  error text
);

-- Sync observability
create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed','skipped')),
  added int default 0,
  changed int default 0,
  cancelled int default 0,
  error text
);
create table sync_state (
  id int primary key default 1 check (id = 1),
  last_synced_at timestamptz,
  last_success_at timestamptz
);
```

### 4.2 Permission Matrix (enforced by RLS)

`Y` = allowed, `own` = only own rows, blank = denied.

| Table | Action | Admin | Cleaner |
|-------|--------|-------|---------|
| profiles | read | Y | Y (names + color only; payment / amount own) |
| profiles | update own (color, payment_preference) | Y | own |
| profiles | create / deactivate / set role | Y | |
| bookings | read | Y | (cleaners use turnovers, not raw bookings) |
| bookings | write | system only | |
| turnovers | read | Y | Y |
| turnovers | create / edit / delete | Y | |
| turnovers | mark complete | Y | own (if assigned) |
| turnover_assignments | claim (insert) | Y | own |
| turnover_assignments | unclaim (delete) | Y | own |
| turnover_assignments | reassign / unassign others | Y | |
| turnover_assignments | set paid_at / amount | Y | |
| turnover_assignments | read amount / paid | Y | own |
| linen_sets | read | Y | Y |
| linen_sets | update state | Y | own action via turnover |
| guest_feedback | create | Y | own (if assigned) |
| guest_feedback | read | Y | own |
| cleaner_notes | create / read all | Y | |
| cleaner_notes | read own / acknowledge | Y | own |
| supply_items | read | Y | Y |
| supply_items | manage | Y | |
| inventory_flags | create | Y | own (if assigned) |
| inventory_flags | read / resolve | Y | own (read) |
| maintenance_flags | create | Y | own |
| maintenance_flags | read / resolve | Y | own (read) |
| requests | create | Y | |
| requests | respond | Y | own (if assigned) |
| requests | read | Y | own turnovers |
| notifications | read / mark read | own | own |

**The single most important constraint** is `unique (turnover_id)` on `turnover_assignments`. It makes double-coverage impossible at the database level. Claiming is an insert that either succeeds or fails on the unique constraint; the loser gets a friendly "already claimed" message. No locks, no "X is editing" hacks.

Example claim-safety policy intent (RLS + constraint):
```sql
-- A cleaner may insert an assignment for themselves only;
-- the unique(turnover_id) constraint guarantees single coverage.
create policy "cleaner can claim" on turnover_assignments
  for insert to authenticated
  with check (cleaner_id = auth.uid());
```

Example payment-visibility policy intent:
```sql
-- Amount/paid visible to admin or the owning cleaner only.
create policy "assignment read scope" on turnover_assignments
  for select to authenticated
  using (
    cleaner_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
```

---

## 5. Feature Specifications

### 5.1 Auth and Onboarding
Use Supabase Auth via the Supabase UI Library (shadcn-based), restyled to our tokens. Magic link only (no passwords to manage). Admin creates cleaner accounts and assigns the `cleaner` role; the first / only admin is set manually. A `profiles` row is created on signup via a trigger on `auth.users`.

### 5.2 Calendar Sync and Turnover Derivation
Implements Section 3.3 exactly. Manual turnovers (`source = manual`) are created by the admin and never touched by sync. Same-day detection compares checkout dates to check-in dates across active bookings and is recomputed every run.

### 5.3 Scheduling, Claiming, and Filtering
Cleaners see all turnovers in a list and can claim or unclaim. Single coverage is enforced by the unique constraint. Admin can reassign or unassign; the affected cleaner is notified. Optional Realtime subscription so claimed turnovers update live for everyone.

**Filtering.** A simple segmented control offers three views: All turnovers (default), My turnovers, and Unclaimed. This is the cleaner's primary lens on the schedule.

**Claiming is framed as a commitment.** Signing up for a date is a commitment, and the copy says so warmly and concisely. The expected norm is that changes come with ample notice (about a month). There is no value in hard-blocking a removal, so unclaim is always permitted, but removing on short notice triggers a gentle confirmation that names the impact (for example, "This turnover is in 5 days. Removing yourself leaves a gap to fill. Continue?"). Tone stays peer-to-peer, never scolding.

### 5.4 Notifications
Events that notify: turnover added, date-changed, cancelled, and relaxed-to-same-day flip on an assigned turnover (from sync); admin reassign / unassign; new coordination request; request response; turnover marked complete (to admin); new cleaner note (to the cleaner). Written to the `notifications` outbox with a channel. Email worker drains pending email rows; in-app clients subscribe via Realtime. Web push is a future channel writer requiring no schema change. In-app notifications display only while the app is open; lock-screen delivery requires web push (later).

### 5.5 Closeout Checklist and Completion
A short "before you leave" checklist (the quick essentials), with the full turnover spec available as reference behind it. The turnover detail surfaces the standing timing expectation (arrive before noon, complete within the 11:00 to 4:00 window). Marking complete sets `completed_at` and notifies the admin (critical for same-day early check-in).

### 5.6 Guest Feedback
A 1 to 5 cleanliness slider, a freeform note, and optional damages and missing-items fields, tied to the turnover. Admin reviews to rate the guest in Airbnb. (Cleaner to admin, about the guest.)

### 5.7 Inventory Check
The cleaner reviews the supply catalog and toggles "running low" with an optional note per item. No counts. Flags surface to the admin and can be resolved when restocked.

### 5.8 Maintenance / Durable Goods
Freeform flags for items needing replacement (stained towel, thin sheets), resolvable by admin.

### 5.9 Laundry Tracking
The cleaner records which bedding set(s) they took. `linen_sets` track each specific item (a sheet set or a duvet set, with its color and brand, for example a Quince "Sand" sheet set or an IKEA "Terracotta" duvet set) and its location / state. Tracking items specifically prevents mismatched pieces (for example mixed pillowcases) and keeps it clear who is holding what. The app warns when too few clean items remain to cover the beds. Towels are typically washed on-site during the turnover; bedding is taken home and returned next time, so bedding is the tracked unit.

Steady-state assumption (for sensible defaults, not a hard rule): two active cleaners (Breanna and Tiffany) can each hold a clean set while one set stays on the beds and a backup remains; Dianna is backup and usually does not hold a set. Current inventory context: two queen beds, seven duvet covers total. The warning threshold is configurable; confirm exact set granularity in Appendix A.

### 5.10 Coordination Requests
Preset request types (`luggage_drop`, `early_checkin`, `other`). Admin raises a request on a turnover; the assigned cleaner is notified and responds with a quick tap (yes / no / conditional plus optional note); the admin is notified of the answer. The app never edits Airbnb; the admin makes the actual reservation-time change.

### 5.11 Payment Status
Admin marks a turnover paid (`paid_at`). Each cleaner has a `payment_preference`. Amounts and paid status are visible only to the admin and the owning cleaner, never to other cleaners (RLS). No payment processing.

### 5.12 Admin CRUD
Manage cleaners (create, deactivate, role), manage turnovers (create manual, edit, cancel, reassign), manage the supply catalog, and manage the linen inventory. Linen management means adding and editing individual sheet sets and duvet sets, each with its kind (sheet set or duvet set), color, and brand, so the inventory stays specific enough to prevent mismatched pieces and to track who holds what.

### 5.13 Health and Monitoring Surface
A small admin view showing last sync time, recent `sync_runs`, and any failures, plus the `/api/health` endpoint backing the external watcher.

### 5.14 Cleaner Feedback Log (admin to cleaner)
The admin can attach a note to a completed turnover directed at the assigned cleaner (for example, "the bedroom lamp was left unplugged, please double check everything is powered before you leave"). The cleaner is notified and can view and acknowledge it. Notes accumulate into a per-cleaner history that the admin can review to spot repeated patterns. This is distinct from guest feedback (5.6): guest feedback is cleaner-to-admin about the guest; this is admin-to-cleaner about the work. The tone target is sharp-but-kind, a way to keep details tight without nagging.

### 5.15 Personal Tag (initials and color)
Each cleaner can pick a background color in settings. Their initials (derived from display name) plus that color form a compact tag shown on turnovers they have claimed, in the list and in the optional calendar view, so anyone can scan and immediately see whose turnover is whose.

---

## 6. Design System and Interaction Design

### 6.1 Design Principles
Mobile-first (cleaners on phones, mid-turnover). Glanceable (the schedule reads in two seconds). Big tap targets. Calm and legible, low chrome. Status color does real work: same-day turnovers are unmistakable. The admin views can be denser but share the same tokens. Copy is warm, concise, and peer-to-peer, never patronizing.

### 6.2 Design Tokens (the constrained vocabulary)
Defined once in the Tailwind theme (and mirrored in `DESIGN_TOKENS.md`). Nothing outside this vocabulary is allowed without a deliberate addition.

**Spacing scale (base-8), the only permitted values:**
`1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 64`

**Type ramp, four styles only:**
| Token | Use | Size / Line / Weight |
|-------|-----|----------------------|
| `display` | Page or date headlines | 24 / 32 / 600 |
| `heading` | Section and card titles | 18 / 24 / 600 |
| `body` | Default text | 16 / 24 / 400 |
| `caption` | Meta, labels, timestamps | 13 / 16 / 500 |

One typeface. If a fifth style seems necessary, that is a signal to reconsider, not to add.

**Color tokens (semantic, shadcn CSS-variable model):**
`background, foreground, card, muted, muted-foreground, primary, primary-foreground, border, ring`, plus status tokens: `urgent` (same-day turnover), `success` (covered / paid / complete), `warning` (unclaimed / low stock), `danger` (cancelled / conflict). Cleaner tag colors are a separate small, user-chosen palette and do not override status tokens. Keep everything tight. Light theme first; dark optional later via the same variables.

**Radius:** one base radius token. **Elevation:** one subtle shadow token for cards. Resist proliferation.

### 6.3 Component Inventory
Reuse shadcn primitives: Button, Card, Badge, Dialog, Sheet, Input, Textarea, Select, Slider, Switch, Calendar / Date Picker, Toast, Tabs, Skeleton. Custom components, kept few:
- `TurnoverCard` (date, same-day badge, claim state, cleaner tag, quick actions)
- `StatusBadge` (drives off status tokens)
- `CleanerTag` (initials + chosen color)
- `ScheduleFilter` (All / Mine / Unclaimed segmented control)
- `ChecklistItem`, `InventoryRow`, `RequestCard`, `SyncStatus` (the "synced N ago" chip)

A calendar view component is deferred (see 6.4 and Section 8).

### 6.4 Key Screens
- **Cleaner Home / Schedule.** The default view, a **list**. Upcoming turnovers as cards, same-day flagged, unclaimed surfaced, one-tap claim, cleaner tags visible. The `ScheduleFilter` toggles All / Mine / Unclaimed. A calendar view is an optional secondary toggle, deferred as a nice-to-have; the list is and remains primary.
- **Turnover Detail.** Date, status, timing expectation, assignment, requests, any admin note, and the closeout flow (checklist, feedback, inventory, maintenance, laundry).
- **Closeout Flow.** A short, sequential, thumb-friendly flow ending in "mark complete."
- **Admin Dashboard.** Schedule with coverage gaps surfaced, manual-turnover creation, reassign, payment status, health / sync status.
- **Admin Management.** Cleaners, supply catalog, linen sets, and the per-cleaner feedback history.
- **Settings.** Magic-link account, payment preference, tag color, notification preferences, PWA install prompt.
- **Style Guide (internal).** Renders tokens and components; the visual source of truth (see 6.5).

### 6.5 The Methodical UI / IxD Workflow (opinionated)
Build and validate in this order. Do not wire real data until the interaction feels right on a phone.

1. **Tokens first.** Implement the spacing scale, type ramp, and color tokens in the Tailwind theme. Nothing else proceeds until these exist.
2. **Style Guide page.** Build a single page that renders every token and core component. This replaces a visual builder: Daniel tunes look and feel by editing token values and watching everything update. It is the design system's living proof.
3. **Static screen, seed data.** Build each screen against hardcoded seed data first, mobile viewport, before any backend wiring. Evaluate against the IxD checklist below.
4. **IxD checklist per screen:** Does the schedule pass the two-second glance test? Are same-day turnovers unmistakable? Are cleaner tags readable at a glance? Are primary actions one tap and thumb-reachable? Are tap targets at least 44px? Is empty state and loading state designed, not an afterthought? Is the unhappy path (claim collision, sync stale, short-notice unclaim) shown gracefully?
5. **Wire data.** Only after the static screen passes, connect Supabase and RLS.
6. **Iterate conversationally.** Refine in Claude Code, view in the running app, adjust tokens centrally rather than per-component.

---

## 7. Claude Code Working Agreement

### 7.1 Repo Markdown Files (which file does what)
- `turnover_app_spec.md`: this master spec. The why and the what. Update it when decisions change.
- `CLAUDE.md`: the agent's standing rules (a distilled version of this section). Read on every task.
- `DESIGN_TOKENS.md`: the exact token vocabulary (Section 6.2). The styling contract.
- `DATA_MODEL.md`: the schema and RLS (Section 4), kept in sync with migrations.
- `DECISIONS.md`: a short append-only log of notable choices and reversals (lightweight ADRs).

### 7.2 Discipline Rules
- **Token contract.** Use only the defined spacing, type, and color tokens. Never introduce a new font size, spacing value, or color. No arbitrary Tailwind values; lint them out.
- **Reuse before create.** Prefer existing components. Add a variant via CVA only when genuinely needed. Apply type through the four named styles, never ad hoc.
- **Schema is migrations-first.** Every schema change is a reviewed SQL migration in the repo, tested against a local Supabase instance before it touches the hosted database. Never edit the live schema directly.
- **Sync is idempotent and defensive.** Full reconcile each run. Never treat an empty or failed fetch as cancellation. Never hard-delete turnovers; mark cancelled. Recompute same-day every run.
- **Notifications are not load-bearing.** Correctness lives in the schedule, not in delivery.
- **Secrets stay server-side.** The service role key never reaches the client.
- **Test the load-bearing logic.** Feed parsing and turnover derivation, using the captured real summer 2026 feed as the canonical fixture (it includes the dense same-day turnovers and the Aug 31 reservation-meets-block edge case). For the committed fixture, sanitize it: keep dates, summaries, and UIDs, but redact reservation-URL tokens and drop the phone last-4. Also test diff / notify idempotency and the permission rules. Skip testing styling.
- **Keep it lean.** Fewer files, fewer abstractions, fewer dependencies. Every addition must justify itself against simplicity and reliability.

### 7.3 Setup Task Checklist (ordered; B = browser, CC = Claude Code)
1. (CC) Scaffold Next.js + Tailwind + shadcn from a Supabase starter so app, client, and auth wiring come pre-connected.
2. (B) Create an empty GitHub repo; (CC) initialize git and push.
3. (B) Create the Supabase project; copy keys into `.env.local`.
4. (CC) Init and link the Supabase CLI; set up the migrations folder; bring up local Supabase.
5. (B) Import the repo into Vercel; enable the Supabase integration so env vars set automatically; confirm a preview deploy.
6. (CC) Create `CLAUDE.md`, `DESIGN_TOKENS.md`, `DATA_MODEL.md`, `DECISIONS.md`.
7. (B) Enable `pg_cron` and `pg_net`; store secrets in Supabase Vault.
8. (B) Create the Resend account; add the API key.
9. (B) Configure the external uptime monitor against `/api/health` (after that route exists).

### 7.4 Branch / Deploy Discipline
Develop on branches with preview deploys. Treat the hosted Supabase as production: changes reach it only through reviewed migrations. Local Supabase is the staging ground. This is the discipline that replaces "production as staging."

---

## 8. Build Sequence (phased milestones)

Each phase ends in something demoable and independently valuable.

- **Phase 0, Foundation.** Scaffold, auth (magic link), tokens, Style Guide page, settings with tag color. Exit: a logged-in shell that proves the design system.
- **Phase 1, Core schedule (read-only).** Calendar sync, booking reconcile, turnover derivation with same-day flagging, the schedule list. No claiming, no notifications. Exit: the live Airbnb calendar appears correctly as turnovers, same-day ones unmistakable, end-date test passing.
- **Phase 2, Claiming, filtering, and manual turnovers.** Claim / unclaim with the unique constraint and commitment framing, the All / Mine / Unclaimed filter, cleaner tags on cards, admin reassign, manual turnover creation. Exit: two cleaners cannot double-book; the filter works; friends and family turnovers exist.
- **Phase 3, Reliability and notifications.** Notification outbox, email + in-app, the relaxed-to-same-day flip notification, health endpoint, external watcher, nightly backup with one test-restore. Exit: all reliability exit criteria met.
- **Phase 4, Closeout and feedback.** Checklist, mark-complete (admin notify), guest feedback, and admin-to-cleaner feedback notes with per-cleaner history. Exit: a full closeout and a feedback note both work on a phone.
- **Phase 5, Admin surfaces.** Inventory flags, maintenance flags, laundry tracking with the low-set warning, supply / linen management. Exit: restock and laundry heads-up flow end to end.
- **Phase 6, Coordination and payments.** Requests (luggage / early check-in), payment status with per-cleaner privacy. Exit: the full feature set per Section 1.
- **Later, nice-to-haves.** Web push (a third notification channel), and the optional calendar view with cleaner tags. Added only once the core is proven stable; the list remains the primary schedule view regardless.

---

## 9. Kickoff Prompt for Claude Code

Paste this to start. It assumes this spec file is in the repo.

```
You are helping build a turnover coordination web app. The full specification is in
turnover_app_spec.md in this repo. Read it fully before doing anything.

Top priority is RELIABILITY, then simplicity/maintainability, then ease of use, then
zero cost. When priorities conflict, the higher one wins.

Stack: Next.js (App Router, TypeScript), Supabase (Postgres + Auth + RLS), Tailwind +
shadcn/ui, Supabase Cron (pg_cron + pg_net) for the calendar poller, Resend for email.
Hosting on Vercel. Everything must stay on free tiers.

Before writing feature code, do Phase 0 from Section 8:
1. Confirm the scaffold (Next.js + Tailwind + shadcn + Supabase) is in place.
2. Create CLAUDE.md, DESIGN_TOKENS.md, DATA_MODEL.md, and DECISIONS.md by distilling
   the relevant sections of turnover_app_spec.md (Sections 7.2, 6.2, and 4 respectively).
3. Implement the design tokens from Section 6.2 in the Tailwind theme: the base-8 spacing
   scale, the four-style type ramp, and the semantic color tokens including the status
   tokens. Enforce a no-arbitrary-values rule.
4. Build the Style Guide page that renders every token and core component.
5. Implement magic-link auth via the Supabase UI Library, restyled to our tokens, with a
   profiles table and a trigger to create a profile row on signup. Include a settings
   screen where a cleaner can choose a tag color.

Working rules (from Section 7.2): use only the defined tokens, reuse components, make all
schema changes through reviewed migrations tested on local Supabase, keep the sync
idempotent and defensive (never treat an empty or failed feed fetch as cancellation, never
hard-delete turnovers, recompute same-day every run), and keep secrets server-side.

Stop after Phase 0 and show me the Style Guide page and the auth flow before proceeding to
Phase 1.
```

---

## Appendix A: Open Decisions

- **End-date convention: RESOLVED.** Confirmed against the real feed: `DTEND` is the checkout date (Kaitlyn `20260625`). Turnover date equals the parsed `DTEND`, never minus a day. The captured summer 2026 feed is the canonical test fixture (sanitized for commit), including the Aug 31 reservation-meets-block case that must not read as same-day.
- **Timezone.** Resolved: `America/Los_Angeles` (Pacific). The IANA zone handles PST and PDT, so summer same-day math is correct.
- **Linen model.** Resolved: individual sheet sets and duvet sets, each with kind, color, and brand (Section 4.1, 5.9, 5.12). Still to set during Phase 5: the exact low-stock warning threshold against the seven-cover, two-bed inventory and the two-active-holders steady state (Breanna and Tiffany holding sets, Dianna backup).
- **Timing window.** Resolved (Section 2): soft 11:00 checkout, cleaner arrives 11:30 to noon, finishes before 4:00, starts early for curveballs, no rushing.
- **Web push timing.** Deferred to after the core is stable (email + in-app first).
- **Calendar view.** Deferred nice-to-have. The list is the primary schedule view; the calendar is additive only and should not pull scope from the list.

## Appendix B: Glossary
Booking, Block, Turnover, Same-day, Relaxed, Source, Linen set: see Section 2.
