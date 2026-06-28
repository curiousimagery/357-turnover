# Backlog — what's next

Forward-looking only. Shipped work lives in git history, `CLAUDE.md` (status),
and `DATA_MODEL.md`. Steps to deploy the current build are in `docs/GO_LIVE.md`.

Roughly ordered: pre-launch hardening first, then the near-term feature, then
deferred features and enhancements.

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

## Near-term feature: supply / inventory notes (spec 5.7–5.8)

Cleaners can read the inventory **reference** sheet at closeout but have no way to
flag "we're low on coffee / TP," and there's no single place for Daniel to see
those flags or add his own (e.g. "guest said the first-aid kit was out of
band-aids"). Wanted now. Recommended design:

- **Storage:** a small `supply_notes` table — `id, turnover_id, author_id, body,
  resolved bool default false, created_at`. **Needs a migration.** Attached to a
  turnover so each note carries context (which visit); multiple notes per
  turnover, from cleaner or admin.
- **RLS:** admin reads/writes all and resolves; the assigned cleaner can add +
  read on their own turnover.
- **Closeout prompt:** in the "Before you leave" flow, an optional "Anything
  running low?" field → files a supply note on complete.
- **Per-turnover:** a "Supplies / running low" section on `/turnover/[id]` —
  notes + an add form (admin on any turnover; assigned cleaner on theirs).
- **Unified view:** a `/supplies` page (admin) listing all **unresolved** notes
  across turnovers (date + who flagged) with "mark restocked" (resolve) + an admin
  add — the shopping list for a resupply run.
- Folds in maintenance flags (5.8) as just another note (add a `kind` column
  later if we want to separate supplies vs. durable-goods).

This is the **last un-built feature from the original plan** (Phase 5's inventory
piece) — everything else in the spec is shipped.

## Deferred spec features (in the spec, intentionally not built)

Kept as backlog, not cut — revisit once we know how granular things really need
to be (the guiding worry is not adding complexity prematurely).

- **Coordination requests** (spec 5.10) — structured luggage-drop / early-check-in
  request + yes/no/conditional response. Likely unnecessary if generic turnover
  notes (above) prove enough.
- **Inventory "running low" flags + maintenance flags** (spec 5.7–5.8) — promoted
  to near-term as **supply / inventory notes** (above).
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

- **Per-item closeout persistence.** The checklist is a reference list; ticks
  aren't stored per turnover. Add a completions join for a recorded checkoff.
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
