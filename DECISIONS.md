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
