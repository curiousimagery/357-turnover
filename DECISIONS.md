# DECISIONS.md

Append-only log of notable choices and reversals (lightweight ADRs). Newest last.

## 2026-06-22 — Phase 0 foundation

### Scaffold from the Supabase Next.js starter

Used `create-next-app -e with-supabase`. It pre-wires the cookie-based
`@supabase/ssr` clients, the session proxy, and shadcn — the reliable auth
foundation the spec calls for (7.3). Trade-off: it ships Tailwind v3 (not v4),
which we keep — v3 has the most stable tooling and the token model works the same.

### Tokens extend Tailwind's theme; the contract is enforced by lint (not by replacing the scales)

The faithful-but-costly option was to override Tailwind's spacing/type scales so
only the named tokens exist. That breaks every vendored shadcn primitive
(`h-9`, `px-2.5`, `space-y-1.5`, `text-sm`, …), forcing ~18 forks now and on every
future shadcn update — a maintainability and reliability regression (priority 2).

Chosen instead: **extend** the theme with our four type tokens, status colors,
card shadow, and cleaner-tag palette, keeping Tailwind's defaults available so
the vendored primitives stay pristine. The token contract is enforced in *our*
code by a dependency-free local ESLint rule (`eslint-rules/design-tokens.mjs`),
scoped to `app/**` + `components/**` and excluding `components/ui/**`:
arbitrary values (error), raw text-size utilities (error), raw color-palette
utilities (error), off-scale spacing (warn). This satisfies the explicit
"no-arbitrary-values" requirement and the spirit of the token contract without
the fork tax. A custom rule (vs. `eslint-plugin-tailwindcss`) avoids
Tailwind-version coupling and correctly ignores arbitrary *variants* like
`data-[state=open]:`.

_If hard spacing-scale enforcement is wanted later, we can override the scale and
refactor the primitives — tracked as a possible follow-up, not done now._

### Touch target = 56px

The base-8 scale's options near the 44px touch minimum are 40 and 56. Cleaner-
facing primary actions use a new Button `touch` size (56px) and `h-14` inputs;
40px is reserved for denser admin/desktop. Adding the `touch` CVA variant is the
sanctioned "add a variant only when genuinely needed."

### Magic-link only; password flows deleted

Per Section 5.1 (magic link, no passwords). Removed the starter's sign-up,
forgot-password, and update-password pages/components to cut surface. Sign-in uses
`signInWithOtp`. Accounts are admin-provisioned in production, but sign-in stays
permissive during setup; tighten `shouldCreateUser` later if desired.

### Auth callback handles both magic-link flows

`/auth/confirm` handles PKCE (`?code=`) via `exchangeCodeForSession` *and*
`?token_hash=&type=` via `verifyOtp`, so auth works regardless of which email
template the project uses. `next` is constrained to a relative path (no open
redirect).

### Profile safety: signup trigger + privileged-column guard

A trigger creates a `profiles` row on signup. RLS lets a user update their own
row, but a `BEFORE UPDATE` trigger pins `role`/`active`/`id` for non-admins, so
the self-update policy can't be used to self-escalate. `is_admin()` is
SECURITY DEFINER to avoid RLS recursion. First admin is set manually.

### Style Guide kept reachable without a session

`/style-guide` is added to the proxy's public allowlist (it has no data) so it
stays easy to review.

## 2026-06-23 — Phase 1 (live schedule, read-only)

### Sync runs as a Vercel API route, triggered by pg_cron + pg_net

The fetch/parse/reconcile logic lives in our repo (`lib/sync/`) and runs as
`/api/sync` on Vercel, so it's testable in TypeScript and reuses our code.
Supabase Cron (`pg_cron` + `pg_net`) POSTs to it hourly with a shared
`SYNC_SECRET`; that hourly DB call also keeps the free project awake. Chosen
over a Deno Edge Function (which would fork the logic) and over Vercel Cron
(Hobby is once/day). The endpoint writes with the service-role key (bypasses
RLS for system writes). See `docs/PHASE1_GO_LIVE.md`.

### Load-bearing logic is pure + tested; reconcile is thin

Parsing, classification, date normalization, and turnover/same-day derivation
are pure functions (`ical.ts`, `derive.ts`) unit-tested against a fixture
(`sync.test.ts`) — the Kaitlyn end-date rule, blocks-excluded, and the Aug 31
reservation-meets-block case. `reconcile.ts` only persists. The fixture is a
reconstruction from the spec until the real tokenized feed is captured; the
assertions hold either way. An opt-in integration test
(`reconcile.integration.test.ts`) runs the whole pipeline against local Supabase.

### Two bugs the local integration test caught (before prod)

- `turnovers(booking_out_id)` was a *partial* unique index (`where … not null`),
  which Postgres won't use as an ON CONFLICT target → upsert failed. Switched to
  a plain unique index (NULLs are still distinct, so manual turnovers are fine).
- New tables needed **explicit grants** — locally the migration role's tables
  don't inherit Supabase's default privileges, so `service_role` got
  "permission denied". Added explicit `GRANT`s so local and hosted behave
  identically. This is why we build/verify locally before deploying.

### Cache Components (PPR) turned off

The starter shipped `cacheComponents: true` (Next 16). It broke the Vercel
build: pages that read the session from cookies (home, settings, the shared
header) accessed dynamic data outside a `<Suspense>` boundary, which Cache
Components forbids during prerender. The build passed locally only because the
first local build had no `.env.local` (so it skipped the Supabase call and went
static); with env vars present it fails the same way locally — caught by building
locally first. Chosen fix: disable Cache Components and let those pages render
dynamically (the conventional App Router behavior). Simpler and more reliable for
a 4-person app than wrapping every cookie read in Suspense; revisit only if we
ever need the perf. (`next.config.ts`.)
