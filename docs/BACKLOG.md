# Backlog (captured mid-build; fold into the right phase)

## Done already (small wins, landed this session)

- Home (`/`) now redirects to `/schedule` (signed in) or `/auth/login` — the
  schedule is the home screen; the old placeholder card is gone.
- Style Guide link hidden from cleaners (admin-only).
- Nav label "Settings" → "Account".

## Role-based UX cleanups (quick, do together next)

- **Header identity:** show the user's **display name** next to Sign out, not
  their email.
- **Account page:** rename heading to "Account settings". Add a **current email**
  field (view + change). Changing email uses `supabase.auth.updateUser({ email })`,
  which sends a re-confirmation — so it's a small flow, not just a text field.
- Notification subscription preferences also live here (Phase 3).

## Invite & first-run (Option A — "just click the link")

Daniel chose A: make the invite link work in one click. The reason the link
fails today: the default invite email routes through `/auth/v1/verify`, which
hands the session back in a URL **hash fragment** that a server route can't read.
The fix is to make the email link point straight at our server-side confirm
route with a token hash:

- **Invite email template** (Dashboard → Authentication → Email Templates →
  Invite user) → make the button link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/welcome`
  Our `/auth/confirm` route already verifies `type=invite` server-side. Set the
  project **Site URL** to the environment you're testing (localhost for dev,
  the Vercel URL for prod), or test whether `{{ .RedirectTo }}` is available to
  avoid the single-Site-URL constraint.
- **Invite email copy** (orient a cold recipient — name the property, the host,
  the purpose). Draft:
  - Subject: *"Accept your invite to Daniel's Airbnb turnover schedule"*
  - Body: *"Daniel is inviting you to join the cleaning turnover schedule for his
    Central District Oasis Airbnb. This little web app lets you see upcoming
    turnovers, claim cleanings you're available for, and get notified about new
    bookings and cancellations. Click below to confirm your email and activate
    your account."*
- **First-run success page** (`/welcome`, the invite's `next` target): a small
  celebratory moment (confetti) + warm copy. Arc:
  - *"Nice — your account is live, you're on the team."*
  - Explain it's passwordless: *"We just use your email to know it's you. If you
    ever get signed out, head to `/auth/login` and re-enter your email."*
  - Next steps: 1) bookmark the app, 2) visit **Account** to pick your tag color
    and payment preference, 3) open the **Schedule** to claim cleanings.
  - (Confetti: prefer a tiny CSS/SVG burst over a new dependency unless it's
    clearly worth it — token/dependency discipline.)

## Cleaners admin

- **Delete forever.** After deactivation, show two buttons: **Reactivate** (right,
  current spot) and a destructive red **Delete forever** (left), behind a
  confirmation dialog. Hard-deletes the auth user (cascades the profile). Mainly
  to purge test accounts cleanly; keep the guardrail so it can't be a slip.

## Naming / branding (decide, then apply everywhere)

Property identity: **Central District Oasis** (Airbnb). Need one consistent name
across the app bar, emails, and page titles. Recommendation:
- App bar (compact): **"Oasis Turnovers"**
- Formal / titles: **"Central District Oasis — Turnover Schedule"**
- Emails (spell it out): *"Daniel's Central District Oasis turnover schedule"*
Confirm the pick, then replace the generic "Turnover" wordmark + `<title>`s.

## Notifications (Phase 3) — trigger spec (Daniel's draft, to finalize)

Channels: in-app + email (Resend) now; web push later. Driven by the sync diff
(added / changed / cancelled), which reconcile already computes. Notifications
are **not load-bearing** — never double-send (outbox with status), never block
the schedule.

| Event | Who gets it | Message |
| --- | --- | --- |
| New booking | all active cleaners | new turnover date available to claim |
| Cancelled booking | the cleaner who claimed it (if any) | your turnover on {date} was cancelled |
| Edited booking (date moved) | previously-assigned cleaner | your date changed; the new date is open to claim |
| Edited booking (date moved) | all cleaners | new date available (the old one went away) |
| **Relaxed → same-day flip** (a change makes a relaxed turnover same-day) | assigned cleaner (+ admin) | **heads up: this is now a same-day turnover** (spec calls this out — high priority) |
| Reminder, 24–72h before | the assigned cleaner | reminder: you're on for {date} |
| Payment sent | the cleaner who did it | you've been paid for {date} |

Open questions:
- Reminder cadence: per-user setting vs. global default. Default **2 days** for
  everyone; allow override on the Account page if it's cheap.
- Confirm the cancelled/edited rules for **unclaimed** turnovers (probably
  admin-only or no-op, to avoid noise).

## Payments / tax (Phase 6, admin)

- **Yearly totals per cleaner.** Admin view summing payments to each cleaner by
  calendar year (Daniel pays directly now, so he needs this for 1099 / tax
  season). Sum assignment payments grouped by cleaner + year, exportable.

## Testing the notification engine safely (answered for Daniel)

We never need to touch the real Airbnb calendar to test triggers — sync reads
whatever URL is in `AIRBNB_ICAL_URL`, and we already serve controlled `.ics`
fixtures over HTTP in the integration tests. Plan: (1) unit-test the pure
"diff → which notifications" function against fixture pairs (new/cancel/edit/flip)
with the email sender mocked — deterministic, zero real email; (2) one
end-to-end run against a fixture feed + a real test inbox to confirm delivery.
Build/test this **before** adding real cleaners.
