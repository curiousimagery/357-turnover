# Backlog

## Done (landed on `phase-2-polish`)

- App named **357 Oasis Turnovers** (wordmark + page titles).
- Home (`/`) redirects to `/schedule` or `/auth/login`; placeholder gone.
- Style Guide link admin-only; nav "Settings" → "Account".
- Header shows **display name** (not email).
- **Account settings** page: heading + view/change email (`updateEmail`).
- **First-run `/welcome`** page (celebratory + next steps); invites land here.
- Cleaners admin: **Delete forever** (confirm dialog; frees their turnovers,
  hard-deletes; guarded against self/other admins).

## Needs a one-time dashboard step (you, ~5 min)

- **Auth email templates** — apply `docs/AUTH_EMAIL_SETUP.md` (Invite + Change
  Email) so the invite link and the "Update email" button work in one click.
  Until then, the workaround stands: invited accounts exist, so cleaners can sign
  in via `/auth/login`. Redo on the hosted project at go-live.

## Phase 3 — Notifications (BUILT on `phase-2-polish`, not yet deployed)

Channels: in-app + email (Resend) now; web push later. Driven by the sync diff
(added / changed / cancelled), which reconcile already computes. **Not
load-bearing** — never double-send (outbox with status), never block the
schedule.

| Event | Who | Message |
| --- | --- | --- |
| New booking | all active cleaners | new turnover date available to claim |
| Cancelled booking | cleaner who claimed it | your turnover on {date} was cancelled |
| Edited booking (date moved) | previously-assigned cleaner | your date changed; new date is open (**releases the claim**) |
| Edited booking (date moved) | all cleaners | new date available |
| **Relaxed → same-day flip** | assigned cleaner (+ admin) | **heads up: now a same-day turnover** (high priority) |
| Admin assigns / reassigns | the newly-assigned cleaner | you've been assigned {date} |
| Admin reassigns / unassigns | the removed cleaner | you've been taken off {date} |
| Reminder, 24–72h before | the assigned cleaner | reminder: you're on for {date} |
| Payment sent | cleaner who did it | you've been paid for {date} (Phase 6) |

Open questions: reminder cadence (per-user vs. 2-day default); whether
cancel/edit on **unclaimed** turnovers should stay quiet (probably yes).

**What actually counts as a change (the feed is date-only).** The Airbnb iCal
export carries only dates (DTSTART/DTEND), UID, summary, and a description — no
times, no guest count. So:
- **Checkout date moves** → the turnover date moves → release the existing claim
  + notify (we can't assume the cleaner is free on the new date). `date_changed`
  keys on the *checkout* date specifically.
- **Booking disappears** → `cancelled`.
- **Same-date changes** (extra guest, early check-in, etc.) → either absent from
  the feed or don't move the date → **no notification, claim stays put.** Decided:
  same date = cleaner is still on.
- **Early check-in time** isn't in the feed (date-only), so it can't drive a
  notification from the calendar. If we ever want "your check-in moved earlier"
  for the assigned cleaner, it's a manual coordination feature (Phase 6), and it
  would *update* (not release) the assignment.

**Safe testing:** sync reads `AIRBNB_ICAL_URL`, and we already serve controlled
`.ics` fixtures over HTTP in tests — so we (1) unit-test "diff → notifications"
against fixture pairs with the sender mocked (zero real email), then (2) one
end-to-end run against a fixture feed + a real test inbox. Never touch the live
calendar.

## UI polish (revisit together later)

- **Deactivated-cleaner affordance.** Today an inactive cleaner is blocked from
  claiming but the app gives no clear signal *why*. Add an obvious state — likely
  hide the schedule behind a friendly "your account is paused — contact Daniel"
  lock-out screen — so they're not left guessing or hitting claim errors.
- **Text wrapping** on the header (long "357 Oasis Turnovers" wordmark + nav) and
  the `/welcome` page wraps awkwardly on small screens. Tighten responsive
  layout when we do a UI polish pass.
- **Confetti** on `/welcome` (today it's a tasteful static 🎉 — add motion only
  if it's worth a dependency or a little globals.css).

## Cross-cutting (do before/with a real rollout)

- **End-to-end test pass.** Walk common scenarios as admin + cleaner: claim race,
  reassign, date move, cancellation, same-day flip, deactivate-with-claims,
  invite/first-run, email delivery. Catch functional bugs, UX dead-ends, and copy
  problems. Build a short scripted checklist.
- **UI / look-and-feel pass.** Define the visual personality, fix the text-wrap
  issues (header wordmark + nav, /welcome), tidy responsive layout, add small
  playful flourishes (e.g. real /welcome confetti). Keep the token contract.
- **Rotate the Resend key** (it passed through chat) — see security note.

## Phase 4 — Closeout & feedback (planned)

- **"Before you leave" closeout checklist** — Daniel to provide the item content;
  mark-complete flow; admin notified on completion.
- **Guest feedback** (cleaner → admin): cleanliness, damages, missing items, free
  note. Provide qualitative prompts / helper examples to make leaving feedback
  easy and consistent.
- **Admin → cleaner feedback notes** with per-cleaner history.
- **Per-cleaner views over time**: a screen to review a cleaner's feedback and
  history.

## Phase 6 — Payments (planned)

- **Payment status** per turnover; per-cleaner privacy.
- **Yearly pay totals per cleaner** (1099 / tax) — already noted.
- **Rates model**: a default rate per cleaner (e.g. $120) with a **per-turnover
  override** (e.g. $200 for a deep clean). Capture amount + reason on the
  assignment. (Planning note — not for now.)

## Later / nice-to-have

- **Email send retry/backoff.** A failed Resend send currently marks the row
  `failed` (no retry); the in-app inbox still shows it. Add transient-vs-permanent
  handling (leave 5xx/network as `pending` to retry; fail only on 4xx).
- **Yearly pay totals per cleaner** (Phase 6, admin): sum payments by cleaner +
  calendar year for 1099 / tax season. Exportable.
- App naming variety in body copy (property = "357 Oasis" / "Central District
  Oasis Airbnb") while keeping the wordmark consistent.
