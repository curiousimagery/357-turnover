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

## Phase 3 — Notifications (next up to build)

Channels: in-app + email (Resend) now; web push later. Driven by the sync diff
(added / changed / cancelled), which reconcile already computes. **Not
load-bearing** — never double-send (outbox with status), never block the
schedule.

| Event | Who | Message |
| --- | --- | --- |
| New booking | all active cleaners | new turnover date available to claim |
| Cancelled booking | cleaner who claimed it | your turnover on {date} was cancelled |
| Edited booking (date moved) | previously-assigned cleaner | your date changed; new date is open |
| Edited booking (date moved) | all cleaners | new date available |
| **Relaxed → same-day flip** | assigned cleaner (+ admin) | **heads up: now a same-day turnover** (high priority) |
| Reminder, 24–72h before | the assigned cleaner | reminder: you're on for {date} |
| Payment sent | cleaner who did it | you've been paid for {date} |

Open questions: reminder cadence (per-user vs. 2-day default); whether
cancel/edit on **unclaimed** turnovers should stay quiet (probably yes).

**Safe testing:** sync reads `AIRBNB_ICAL_URL`, and we already serve controlled
`.ics` fixtures over HTTP in tests — so we (1) unit-test "diff → notifications"
against fixture pairs with the sender mocked (zero real email), then (2) one
end-to-end run against a fixture feed + a real test inbox. Never touch the live
calendar.

## UI polish (revisit together later)

- **Text wrapping** on the header (long "357 Oasis Turnovers" wordmark + nav) and
  the `/welcome` page wraps awkwardly on small screens. Tighten responsive
  layout when we do a UI polish pass.
- **Confetti** on `/welcome` (today it's a tasteful static 🎉 — add motion only
  if it's worth a dependency or a little globals.css).

## Later / nice-to-have
- **Yearly pay totals per cleaner** (Phase 6, admin): sum payments by cleaner +
  calendar year for 1099 / tax season. Exportable.
- App naming variety in body copy (property = "357 Oasis" / "Central District
  Oasis Airbnb") while keeping the wordmark consistent.
