# Backlog — what's next

Forward-looking only. Shipped work lives in git history, `CLAUDE.md` (status),
and `DATA_MODEL.md`. Steps to deploy the current build are in `docs/GO_LIVE.md`.

Roughly ordered: pre-launch hardening first, then the near-term feature, then
deferred features and enhancements.

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

## Later / nice-to-have

- **Web push** — a third notification channel (no schema change; after the core
  is proven stable).
- **Calendar view** — optional secondary toggle; the list stays primary.
- **Copy variety** — property aliases ("357 Oasis" / "Central District Oasis
  Airbnb") in body copy while keeping the wordmark consistent.
