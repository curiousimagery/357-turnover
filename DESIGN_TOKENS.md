# DESIGN_TOKENS.md — the styling contract

The constrained vocabulary (spec Section 6.2). Nothing outside it is allowed
without a deliberate addition recorded in `DECISIONS.md`. Tokens are defined once
in `tailwind.config.ts` and `app/globals.css`; the Style Guide (`/style-guide`)
renders all of them and is the visual source of truth.

## How it's implemented (read this first)

We **extend** Tailwind's theme with our tokens rather than replacing its default
scales. This keeps the vendored shadcn primitives in `components/ui/**` pristine
and updatable. The contract is then enforced in *our* code by a local ESLint
rule (`eslint-rules/design-tokens.mjs`), scoped to `app/**` and `components/**`
and **not** applied to `components/ui/**`. See `DECISIONS.md` for the rationale.

The lint rule (`npm run lint`) flags, in our code:

- **arbitrary values** — `w-[12px]`, `bg-[#fff]`, etc. (arbitrary *variants* like
  `data-[state=open]:` are fine). _error_
- **raw text-size utilities** — `text-sm`, `text-xl`, … Use the four type tokens.
  _error_
- **raw color-palette utilities** — `text-red-500`, `bg-zinc-200`, … Use a
  semantic/status token. _error_
- **off-scale spacing** — spacing utilities off the base-8 scale. _warn_

## Spacing scale (base-8)

The only permitted values, in px: **1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 64**.

Because we keep Tailwind's default scale, these map to the standard keys:

| px  | 1   | 2   | 4   | 8   | 12  | 16  | 20  | 24  | 32  | 40   | 56   | 64   |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- | ---- | ---- |
| key | px  | 0.5 | 1   | 2   | 3   | 4   | 5   | 6   | 8   | 10   | 14   | 16   |

So `p-4` = 16px, `gap-2` = 8px, `p-6` = 24px. Stay on this set.

## Type ramp (four styles only)

| Token          | Use                       | Size / Line / Weight |
| -------------- | ------------------------- | -------------------- |
| `text-display` | Page or date headlines    | 24 / 32 / 600        |
| `text-heading` | Section and card titles   | 18 / 24 / 600        |
| `text-body`    | Default text              | 16 / 24 / 400        |
| `text-caption` | Meta, labels, timestamps  | 13 / 16 / 500        |

One typeface (Geist). A fifth style is a signal to reconsider, not to add.

## Color tokens (semantic, shadcn CSS-variable model)

Defined as HSL CSS variables in `app/globals.css`, light theme first; dark uses
the same variables. Edit a value there and everything cascades.

Core: `background, foreground, card (+foreground), popover (+foreground),
primary (+foreground), secondary (+foreground), muted (+foreground),
accent (+foreground), border, input, ring`.

Status (these do real work):

| Token     | Meaning                         |
| --------- | ------------------------------- |
| `urgent`  | same-day turnover (unmistakable)|
| `success` | covered / paid / complete       |
| `warning` | unclaimed / low stock           |
| `danger`  | cancelled / conflict            |

`destructive` is mapped onto `danger` for shadcn compatibility. Use status tokens
via `bg-*` / `text-*` / `border-*` (e.g. `bg-urgent text-urgent-foreground`), or
the `StatusBadge` component.

## Cleaner tag palette (separate, user-chosen)

A small, closed set, distinct from status tokens and never overriding them.
Defined as `.tag-*` classes in `app/globals.css` and listed in
`lib/cleaner-tags.ts`: **rose, amber, emerald, sky, violet, teal, slate,
fuchsia**. Rendered via the `CleanerTag` component (initials + chosen color).

## Radius & elevation

One radius token (`--radius`, used by `rounded-lg/md/sm`) and one card shadow
(`shadow-card`). Resist proliferation.

## Sizing / tap targets

Mobile-first. Cleaner-facing primary actions use the Button `touch` size (56px,
comfortably ≥ the 44px minimum). The 40px default sizing is for denser
admin/desktop contexts. Inputs in cleaner flows use `h-14` (56px).

## Core components

Vendored shadcn primitives: Button, Card, Badge, Input, Textarea, Label,
Checkbox, Switch, Slider, Select, Tabs, Skeleton, Separator, Dialog, Toaster
(sonner). Custom, token-driven: `StatusBadge`, `CleanerTag`, `TurnoverCard`,
`ScheduleFilter`, `SyncStatus`, `TagColorPicker`. A calendar view is deferred.
