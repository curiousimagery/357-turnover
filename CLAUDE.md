# CLAUDE.md — standing rules for this repo

Read this on every task. It distills the working agreement (spec Section 7.2).
The full spec is `docs/turnover_app_spec.md` — the source of truth. When code and
spec disagree, fix the code or update the spec in the same change.

## What this is

A turnover-coordination web app for one Airbnb unit (357 26th Ave, Seattle) and
four people: one admin (Daniel) and three cleaners. Optimize for a small, known
user set. The core promise: every turnover is covered exactly once.

## Priorities (higher wins when they conflict)

1. **Reliability** — never silently fail, double-book, drop a turnover, or send a
   false alarm. The in-app schedule is authoritative; notifications are a
   convenience layer and must never be load-bearing.
2. **Simplicity & maintainability** — fewer parts, vendors, styles, concepts.
   Daniel must be able to repair this himself months from now.
3. **Speed & ease of use** — cleaners on a phone, mid-turnover. Glanceable, few
   taps, forgiving.
4. **Low / zero cost** — stay on free tiers.

## Discipline rules (7.2)

- **Token contract.** Use only the defined spacing, type, and color tokens. No new
  font size, spacing value, or color. No arbitrary Tailwind values. See
  `DESIGN_TOKENS.md`. Lint enforces this in our code (`npm run lint`).
- **Reuse before create.** Prefer existing components. Add a CVA variant only when
  genuinely needed. Apply type through the four named styles, never ad hoc.
- **Schema is migrations-first.** Every schema change is a reviewed SQL migration
  in `supabase/migrations/`, tested on local Supabase before the hosted project.
  Never edit the live schema directly. See `DATA_MODEL.md`.
- **Sync is idempotent and defensive** (Phase 1+). Full reconcile each run. Never
  treat an empty or failed fetch as cancellation. Never hard-delete turnovers —
  mark cancelled. Recompute same-day every run.
- **Notifications are not load-bearing.** Correctness lives in the schedule.
- **Secrets stay server-side.** The service-role key never reaches the client; it
  must never appear in a `NEXT_PUBLIC_*` variable.
- **Test the load-bearing logic** (Phase 1+): feed parsing and turnover
  derivation against the captured real feed fixture; diff/notify idempotency; the
  permission rules. Skip testing styling.
- **Keep it lean.** Every file, abstraction, and dependency must justify itself.

## Stack

Next.js (App Router, TS) · Supabase (Postgres + Auth + RLS) · Tailwind v3 +
shadcn/ui · Supabase Cron (pg_cron + pg_net) for the poller (Phase 1+) · Resend
for email (Phase 3+) · Vercel hosting. Everything on free tiers.

## Project conventions

- **Vendored shadcn primitives** live in `components/ui/**`. They are exempt from
  the token lint (kept pristine so they stay updatable). Our own components and
  pages must obey the token contract.
- **Auth** is magic-link only (no passwords). Client/server Supabase clients are
  in `lib/supabase/`. The session proxy is `proxy.ts` + `lib/supabase/proxy.ts`.
- **Time** is property-local (America/Los_Angeles). Turnover dates are date-only.
- Reference: `DESIGN_TOKENS.md` (styling), `DATA_MODEL.md` (schema + RLS),
  `DECISIONS.md` (why things are the way they are).

## Commands

```bash
npm run dev      # local dev server (http://localhost:3000)
npm run lint     # ESLint incl. the design-token rules
npm run build    # production build
npx supabase start          # local Supabase (needs Docker)
npx supabase migration new  # author a new migration
npx supabase db reset       # apply all migrations to local db
```

## Status

Phase 0 (foundation) is built: scaffold, design tokens + Style Guide
(`/style-guide`), magic-link auth, profiles migration with signup trigger + RLS,
and settings with tag color. Phase 1 (live schedule) is next — see spec Section 8.
