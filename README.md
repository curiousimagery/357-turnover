# 357 Oasis Turnovers

A turnover-coordination web app for **one** Airbnb unit (357 26th Ave, Seattle)
and **four** people: one admin (Daniel) and three cleaners. The core promise:
**every turnover is covered exactly once.** It also quietly handles the
surrounding admin — restock heads-up, maintenance notes, guest feedback, laundry
tracking, and payment status.

Built deliberately small. Priorities, in order: **reliability → simplicity →
ease of use → zero cost.** When they conflict, the higher one wins.

## Stack

- **Next.js** (App Router, TypeScript) on **Vercel** (Hobby/free)
- **Supabase** — Postgres + Auth (magic-link) + Row Level Security
- **Tailwind v3 + shadcn/ui**, driven by a fixed design-token vocabulary
- **Supabase Cron** (`pg_cron` + `pg_net`) → hourly `/api/sync` poller
- **Resend** for email notifications
- Everything on free tiers.

## How it works (one paragraph)

An hourly cron POSTs to `/api/sync`, which fetches the Airbnb iCal feed, parses
reservations (not blocks), and does a full **idempotent reconcile** into
`bookings` → derives `turnovers` (recomputing same-day every run) → diffs against
the prior state → enqueues `notifications`. The in-app schedule is **always
authoritative**; email/in-app notifications are a convenience layer that can fail
without breaking correctness. Cleaners claim turnovers (a `unique(turnover_id)`
constraint makes double-booking impossible at the database level), work the
closeout, and file feedback; the admin assigns, pays, and tracks linens.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint         # ESLint incl. the design-token rules
npm run build        # production build (run with .env.local present)
npm test             # vitest — sync + notify logic tests
```

Local Supabase (needs Docker):

```bash
npx supabase start   # local stack + keys
npx supabase db reset # replay all migrations into the local db
npx supabase status
```

`.env.local` needs the Supabase URL + keys (see `.env.example`), plus
`AIRBNB_ICAL_URL`, `SYNC_SECRET`, `RESEND_API_KEY`, and `NEXT_PUBLIC_SITE_URL`
for full function. The app degrades gracefully when optional vars are absent.

## Where the docs live

| File | What it's for |
|------|---------------|
| [docs/turnover_app_spec.md](docs/turnover_app_spec.md) | **Source of truth** — product, domain, architecture, full feature specs. |
| [CLAUDE.md](CLAUDE.md) | Standing rules for working in this repo (read every task). |
| [DATA_MODEL.md](DATA_MODEL.md) | The schema + RLS, kept in sync with `supabase/migrations/`. |
| [DESIGN_TOKENS.md](DESIGN_TOKENS.md) | The styling contract (spacing, type, color tokens). |
| [DECISIONS.md](DECISIONS.md) | Append-only log of notable choices and reversals. |
| [docs/GO_LIVE.md](docs/GO_LIVE.md) | The remaining manual steps to ship the current build. |
| [docs/BACKLOG.md](docs/BACKLOG.md) | What's next (future features + pre-launch hardening). |

Reference/setup how-tos: [docs/RELIABILITY.md](docs/RELIABILITY.md),
[docs/RESEND_SETUP.md](docs/RESEND_SETUP.md),
[docs/AUTH_EMAIL_SETUP.md](docs/AUTH_EMAIL_SETUP.md). Closeout content lives in
[docs/content/closeout-and-inventory.md](docs/content/closeout-and-inventory.md).

## Status

Phases 0–4 are live (schedule sync, claiming, notifications, closeout/feedback).
Phases 5–6 (linen tracking + payments + profile menu) are built on the
`phase-5-6` branch, pending merge. See [docs/GO_LIVE.md](docs/GO_LIVE.md) for
what's left to ship and [docs/BACKLOG.md](docs/BACKLOG.md) for what's next.
