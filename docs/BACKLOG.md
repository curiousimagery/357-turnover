# Backlog — what's next

Forward-looking only. Shipped work lives in git history, `CLAUDE.md` (status),
and `DATA_MODEL.md`. Steps to deploy the current build are in `docs/GO_LIVE.md`.

Roughly ordered: pre-launch hardening first, then the near-term feature, then
deferred features and enhancements.

## Wave 2 (cleaner usability test, 2026-06-30)

- **Edit a completed turnover without reverting / data loss — TODO.** Today "Edit
  turnover" calls `reopenTurnover` → flips status back to `scheduled`, and the
  closeout flow re-saves from *empty* local state (and `completeTurnover` deletes
  the prior `guest_feedback`), so the cleaner lost her star rating + feedback +
  inventory note. Desired: editing a completed turnover **stays completed**,
  **pre-fills** the existing values (stars/feedback/checklist are already stored;
  pass the existing `guest_feedback` row into `CloseoutFlow` as initial state),
  and **saves in place** (update, not delete+insert from empty). "Mark
  incomplete" becomes an **admin-only** action once a cleaner has completed it.
  Needs: `CloseoutFlow` initial cleanliness/note props + a save-edits path that
  doesn't change status; gate reopen to admin.
- **Whole schedule card clickable — DONE** (this commit): stretched link over the
  card + a subtle hover; the CTA buttons stay above it.

- **Linen subsystem redesign — TODO (needs migration + UI).** The current
  one-row-per-set + state machine (`linen_sets`, on_beds/with_cleaner/clean_backup/
  in_wash) doesn't match how it's used. Desired model:
  - **Count-based inventory:** the admin defines linen *types* with a **count**
    (e.g. ×5 white cotton sheet sets, ×3 blue linen duvet covers) — not one row
    each. Likely `linen_types(id, kind, label, count)`; drop the per-set state.
  - **Two locations only:** on the beds vs. in the cleaning-closet storage.
    **Remove the "in wash" status.**
  - **Closeout step:** after a turnover is started, ask the cleaner **which linen
    sets they put on the beds and which they stored** — shown alongside the
    "anything running low?" note. Persist per turnover (who/what/when).
  - **Fix `/linens` UX:** let the admin set counts (today it only adds one of each)
    and kill the bogus low-stock warnings (e.g. "Only 1 clean Sage Green Linen
    duvet set backup left" when there's exactly one). Re-derive low-stock from the
    count model, or drop it.
  - Dedicated build: migration(s) for `linen_types` (+ a per-turnover linen record),
    rebuild `/linens` admin, add the closeout linen prompt.

## Wave 1 nits (from Daniel's testing, 2026-06-29)

- **Notify on manual-turnover delete — DONE.** `deleteTurnover` reads the
  assignee and sends the cancellation copy first (detached `turnover_id` so the
  notice survives the cascade delete).
- **Header overflow on mobile — DONE.** Secondary nav collapses into a hamburger
  dropdown (`components/mobile-nav.tsx`) under `sm`; inline on desktop.
- **Schedule filters — DONE.** Three dropdowns on one anchored (muted) row,
  self-describing options, selections persisted via localStorage.
- **Customize the Supabase sign-in / account emails — DRAFTED; dashboard step
  remains (Daniel).** Copy now lives in `lib/notify/external-emails.ts` and shows
  on `/test/emails`. Still manual: paste the final wording into the Supabase
  dashboard (Authentication → Email Templates; `docs/AUTH_EMAIL_SETUP.md`) and set
  **custom SMTP (Resend)** so they send from `…@mail.curiousimagery.com` instead
  of "Supabase Auth". Covers magic-link, invite, and change-email.

## Pre-launch (do before / with the real rollout)

- **Email deliverability.** Verify a Resend domain (SPF/DKIM/DMARC) and set
  `NOTIFY_FROM`. Fixes spam **and** unblocks `+alias` cleaner addresses. Steps in
  `docs/GO_LIVE.md` §3 / `docs/RESEND_SETUP.md`.
- **End-to-end bug-bash.** Walk the common scenarios as admin + cleaner against a
  fixture feed: claim race, reassign, date move, cancellation, same-day flip,
  deactivate-with-claims, invite/first-run, closeout, payment, linen move, email
  delivery. Catch functional bugs, UX dead-ends, copy problems. Write a short
  scripted checklist as we go.
- **UX cleanup.**
  - *Account settings consolidation* — **DONE.** Profile + tag + payment +
    notifications now save with one "Save settings" button; the sign-in email is
    the one separate action (it needs email confirmation).
  - *Deactivated-cleaner affordance* — a paused cleaner is blocked from claiming
    but isn't told why. Show a friendly "your account is paused — contact Daniel"
    state instead of silent claim errors.
  - *Responsive text wrapping* — the header wordmark + nav and `/welcome` wrap
    awkwardly on small screens.
- **UI / look-and-feel pass.** Define the visual personality and apply it within
  the token contract; tidy responsive layout; small playful flourishes (e.g. real
  `/welcome` confetti vs. today's static 🎉).

## Near-term feature: the turnover as the home for three "sibling" notes

When you review a turnover, three note/feedback fields belong **on it** — captured
by different people at different moments, but persisted *with the turnover* and
shown side-by-side. Its detail page (`/turnover/[id]`) is the natural home.

1. **Prep notes** (coordination) — early arrival, special requests. Shared: the
   admin **and** the assigned cleaner can see + edit. _Not built._
2. **Guest feedback** (cleaner → admin) — the 1–5 rating + note filed at
   mark-complete. _Built; already persisted and shown on the turnover page._
3. **Cleaner feedback** (admin → cleaner) — the admin's note about the work.
   _Built only as a one-way `notifications` row: written from the turnover page
   but never read back, so it isn't a persisted turnover field._

**Principle (mirrors the sync design):** the turnover holds the **durable record**;
notifications are just the **delivery layer**. #2 already works this way. So:

- Add **#1** as a shared, turnover-scoped field with RLS for admin + the currently-
  assigned cleaner (grow `turnovers.notes`, or a small `turnover_notes` table).
- Make **#3** persist a turnover-scoped record too, so it shows on the turnover
  (the notification stays as the ping, not the store) — likely the durable
  `cleaner_notes` table the spec wanted (5.14).
- Compose all three into one "Notes & feedback" section on the turnover page.

Storage stays per-type (different authors, shapes, visibility) — "sibling" is a
**review-surface** concept, not one table. This also **supersedes** the granular
coordination-requests flow (5.10): a shared prep note covers luggage / early
check-in without new request tables.

**Decided — the turnover detail is a dedicated page** (`/turnover/[id]`): every
card links to it, message deep-links go straight there (works for past
turnovers), and it carries claim / assign / release + the three notes + a
prominent "back to schedule." This retires the in-list scroll-and-highlight (so
the light-yellow focus idea is moot).

## Near-term feature: view past / historical turnovers

Today the schedule hard-filters to upcoming (`turnover_date >= today`,
`app/schedule/page.tsx`) and the only filter axis is ownership (All / Mine /
Unclaimed). There is **no way to see past turnovers** except the admin-only
per-cleaner page — so once a date passes, a turnover and its feedback/payment drop
off. **Not in the spec** (it's upcoming-oriented). A real gap, sharpest for
payments: a cleaner can't see their own paid/unpaid history.

**Decided — three independent pickers** on the schedule (default = all upcoming):
- **Who:** Mine / Everyone (admin also gets per-cleaner by name).
- **When:** Upcoming / Historic / All.
- **Status:** Claimed / Unclaimed / All.

Reuse the same list + cards; past turnovers render read-only. Cleaners see their
own, admin sees all. The dedicated turnover page (above) is the deep-link target
for historic turnovers. Mostly relaxing the `.gte` filter + the picker UI.

## Notification cleanup — DONE

- **Intent-grouped preferences** — settings now show ~5 category toggles
  (claimable / changes to one you're on / reminders / follow-up notes /
  payments) instead of 12 raw types; admin-only categories (coverage &
  completion) are hidden from cleaners. Each category fans out to its member
  types on save. Message copy stays specific per type.
- Friendlier dates in messages ("Jul 10, 2026"), clearer follow-up-note +
  reminder labels, and manual turnovers now notify cleaners.

## Supply / inventory notes (spec 5.7–5.8) — DONE (on `supplies-and-copy`)

The last un-built feature from the original plan. Built as designed:
`supply_notes` table (nullable `turnover_id` so the admin can file standalone
notes), a closeout "Anything running low?" prompt, a per-turnover **Supplies**
card (add + admin resolve), and the unified **`/inventory`** board — shared with
cleaners, who see the whole list and can add ad-hoc; only the admin resolves (open
flags up top with "mark restocked", restocked below). Maintenance flags (5.8)
fold in as just another note. _Pending hosted migration — see `docs/GO_LIVE.md`._

With this shipped, **every feature in the original spec is built.**

## Deferred spec features (in the spec, intentionally not built)

Kept as backlog, not cut — revisit once we know how granular things really need
to be (the guiding worry is not adding complexity prematurely).

- **Coordination requests** (spec 5.10) — structured luggage-drop / early-check-in
  request + yes/no/conditional response. Likely unnecessary if generic turnover
  notes (above) prove enough.
- **Inventory "running low" flags + maintenance flags** (spec 5.7–5.8) — **DONE**
  as `supply_notes` (above).
- **Guest feedback depth** — the spec's `damages` / `missing_items` fields (not
  built; today it's cleanliness + note).
- **Durable / two-way cleaner notes** — if the one-way notification model proves
  too thin, a real `cleaner_notes` table with acknowledge (spec 5.14).

## Notification enhancements

- **Near-real-time.** Today the badge/inbox update on refresh (fine for a
  single-user-at-a-time app). A Supabase Realtime subscription on `notifications`
  (filtered to the recipient) would bump the badge + list live. Lowish priority.
- **Faster email.** Emails currently flush on the hourly sync. Options: a ~15-min
  "drain" cron hitting a notify endpoint, or send-on-enqueue for high-priority
  types. (`/test` has a manual "send now.")
- **Email retry/backoff.** A failed Resend send marks the row `failed` (no retry).
  Leave 5xx/network as `pending` to retry; fail only on 4xx.

## Closeout & tooling

- **Per-item closeout persistence — DONE** (on `supplies-and-copy`).
  `turnover_checklist_completions` records each tick; they survive a reload and
  the admin sees what was checked. _Pending hosted migration._
- **Email/notification copy — centralized.** All subjects + bodies now live in
  `lib/notify/copy.ts` (one source of truth for the senders, the spoof tool, and
  the `/test/emails` preview page). The voice & tone pass edits that one file.
- **Richer spoof tool.** `/test` injects sample notifications today. A fuller
  harness could inject/shift/cancel a *test booking* and run the real sync diff
  end to end against a fixture feed.

## Admin surfaces

- **Sync-health view** (spec 5.13). `/api/health` + the "synced N ago" chip exist;
  a small admin page listing recent `sync_runs` / failures would round it out.
- **Yearly pay totals export.** The per-cleaner this-year total is shown; add a
  CSV/export for 1099 / tax season.

## Open-source prep — genericize property + admin names

Goal: make this shareable as a generic template, and fix the "Daniel" vs "admin"
inconsistency by using the admin's **own name** (`display_name`) wherever we mean
the person (not the role) — which also sets up multiple admins. Two themes:

**A. Admin person-name** ("Daniel" → the admin's first name). 9 user-facing spots
today. Most are easy once context is available; three have wrinkles:
- *Easy (context exists):* the `cleaner_note` notification **subject**
  (`lib/notify/copy.ts`) — thread the author's first name from `addCleanerNote`
  (the author is the current user) through `notifyCleanerNote`. The closeout
  placeholder + the "ask Daniel to reactivate" error — reword (generic or, where
  we have it, the admin name).
- *Wrinkle 1 — static labels:* the notification-pref labels in
  `lib/notify/types.ts` are module constants with no user context. Either
  genericize ("Follow-up note from the admin") or inject the admin name in the
  settings UI.
- *Wrinkle 2 — per-note author:* the "Follow-up notes from Daniel" heading on
  `/turnover/[id]` reads `cleaner_note` **notification rows**, which don't store
  *who* wrote them. True per-admin attribution ("from <name>") needs recording the
  author (e.g. a `notifications.author_id` column). Without it, go generic or
  assume the single admin.
- *Wrinkle 3 — invite email:* "Daniel is inviting you…" is a static Supabase
  dashboard template (`lib/notify/external-emails.ts` is just the draft). Can't
  inject the inviter name without custom SMTP templating → keep generic.

**B. Property / brand name** ("357 Oasis Turnovers", "357 26th Ave", "Central
District"). ~16 files — mostly page `metadata.title`, the header wordmark, and
email sender/footer/copy. Cleanest: a single `lib/config.ts` (or env) exporting
`APP_NAME` / `PROPERTY_NAME` / `PROPERTY_ADDRESS`, referenced everywhere; build
the page titles from it. Mechanical, low risk.

**Effort/risk:** ~half a day for a tidy job; **low risk** (almost all strings; the
one load-bearing change is the notification-copy signature, which the unit tests
pin). Optional small migration for `notifications.author_id` if we want true
multi-admin attribution. Supersedes the "Copy variety" note below.

## Public availability calendar + visit requests

A shareable, **read-only** calendar (public URL, no login) showing the gaps
between bookings — so friends/family can spot open pockets and request a visit.
A request creates a pending **manual turnover** that the admin approves (then it
joins the schedule like any other manual turnover; declining drops it).

- **Availability:** derive open ranges from `bookings` (check-in/out) — the
  inverse of occupied dates, maybe with a min-gap and a booking horizon. Show as a
  month grid; never expose guest details (dates only).
- **Request flow:** a public form (date range + name + note) → a `visit_requests`
  row (`status` pending/approved/declined). Rate-limit / lightweight anti-spam
  since it's unauthenticated (the URL is the only gate, or add a shared passphrase).
- **Approve:** an admin queue; approving creates a manual turnover (reuse
  `createManualTurnover`) for the checkout date and notifies cleaners as usual.
- **Surface:** a token in the URL (`/calendar/<token>`) so it's shareable but not
  guessable; revocable.
- **Cost/risk:** new public route + table + admin queue. The unauthenticated
  surface is the main thing to get right (no data leakage, abuse-resistant).
  Medium effort; isolated from the core (read-only over `bookings` + a request
  inbox).

## Later / nice-to-have

- **Web push** — a third notification channel (no schema change; after the core
  is proven stable).
- **Calendar view** — optional secondary toggle; the list stays primary.
