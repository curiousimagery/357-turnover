# Go-live — the remaining manual steps (you do these)

Phases 0–4 are **already live** on Vercel + hosted Supabase. This is the single
checklist for shipping the rest and finishing the reliability/email hardening.
Everything here is point-and-click or copy-paste — **nothing touches production
automatically.** Do the steps in order; ping me on any one.

When a step is done, check it off here so this file always shows what's left.

## 1. Apply pending migrations, then ship

Verified (lint + tests + build green). **Apply the migrations before you push**,
or the deployed pages will query tables that don't exist yet. (The new pages read
defensively — they show empty instead of crashing if a table is missing — but the
features won't actually work until the migration is applied.)

- [ ] **Apply the migrations** in the hosted SQL Editor (paste each, Run — all
      additive/safe). _If you're unsure whether 5–6 already ran, re-running is
      safe: every statement is `create … if not exists` / `drop policy if exists`._
  - Phases 5–6: `supabase/migrations/20260624060000_payments.sql`
  - Phases 5–6: `supabase/migrations/20260624070000_linens.sql`
  - Supplies: `supabase/migrations/20260628000000_supply_notes.sql`
  - Closeout ticks: `supabase/migrations/20260628010000_checklist_completions.sql`
- [ ] **Merge `supplies-and-copy` → `main` and push** (Vercel auto-deploys `main`):
  ```bash
  git checkout main && git merge --ff-only supplies-and-copy && git push
  ```

## 2. Confirm Vercel env vars

- [x] `RESEND_API_KEY` — the rotated key.
- [x] `NEXT_PUBLIC_SITE_URL=https://357-turnover.vercel.app` (invite redirects).
- [ ] `NOTIFY_FROM` — set **after** step 3, e.g.
      `357 Oasis Turnovers <turnovers@yourdomain.com>`.

## 3. Resend domain — fixes spam AND alias delivery

The sandbox sender (`onboarding@resend.dev`) lands in spam and only delivers to
your own address, so cleaner `+alias` emails get dropped. Verify a domain to fix
both. Full steps: **`docs/RESEND_SETUP.md`**.

- [ ] Resend → Domains → add a domain you own → create the DNS records (SPF,
      DKIM, DMARC) → wait for "Verified."
- [ ] Set `NOTIFY_FROM` (step 2) to an address on that domain; redeploy.

## 4. Auth email templates (hosted)

So the invite link and "Update email" button work in one click. Full steps:
**`docs/AUTH_EMAIL_SETUP.md`**. (Magic-link sign-in already works; this is for
invites + email change.)

- [ ] Apply the Invite + Change-Email templates on the **hosted** project.

## 5. Reliability (~10 min) — from `docs/RELIABILITY.md`

- [ ] **Backup workflow:** GitHub → Actions → New workflow → paste
      `docs/backup-workflow.yml` → add the `SUPABASE_DB_URL` secret. **Run it
      once and test-restore** (an MVP exit criterion).
- [ ] **Uptime watcher:** point UptimeRobot / cron-job.org at `/api/health` (it
      returns 503 when the sync goes stale, so the watcher emails you).

## 6. Verify after deploy (quick smoke test)

1. `/checklist` → Load starter items for both lists.
2. `/test` → send yourself one of each notification type → check the bell,
   archive, the "View turnover" link, and Account → Notifications toggles.
3. `/test` → "Send pending emails now" → confirm email arrives (after step 3, not
   in spam).
4. Claim a turnover as a test cleaner → open it → Mark complete with feedback →
   confirm you (admin) get the completion notice and see it on `/turnover/[id]`
   and `/cleaners/[id]`.
5. **Phase 5–6:** `/linens` (move a set, check the low-stock banner) and a
   turnover's payment card (set amount → Mark paid → cleaner sees only their own).
6. **Supplies + closeout ticks:** on a claimed turnover, tick a checklist item →
   reload → it stays ticked; Mark complete with "Anything running low?" filled →
   confirm it shows in the turnover's Inventory card **and** on `/inventory`, then
   "Mark restocked." Also check `/test/emails` renders all the copy.

---

_Phase 1 and Phase 2 went live earlier; their original go-live notes are in
`docs/archive/` for reference._
