# Punch list — getting the latest live (everything you do manually)

All the Phase 4 work is on the branch **`phase-4-checklist`** (not yet deployed).
You've been testing it locally (`npm run dev` against the hosted DB). When you're
ready to make it live for cleaners, do these in order. Nothing here was done to
production automatically.

## 1. Apply the two new migrations (hosted SQL Editor)

You've already applied `closeout_lists` and `notification_preferences`. The two
new ones (paste each, Run — both additive/safe):

- `supabase/migrations/20260624040000_notifications_archive.sql`
- `supabase/migrations/20260624050000_guest_feedback.sql`

## 2. Confirm Vercel env vars

- `RESEND_API_KEY` — your rotated key (you added this). ✓
- `NEXT_PUBLIC_SITE_URL=https://357-turnover.vercel.app` (you added this). ✓
- `NOTIFY_FROM` — set this **after** step 4 (domain), e.g.
  `357 Oasis Turnovers <turnovers@yourdomain.com>`.

## 3. Deploy (merge the branch)

Test locally first if you like, then:

```bash
git checkout main
```
```bash
git merge phase-4-checklist
```
```bash
git push
```

Vercel auto-deploys `main`. (This branch has no `.github/workflows` file, so the
push won't be blocked like before.)

## 4. Resend domain — fixes spam AND alias delivery (important)

The one email that arrived hit spam, and cleaner `+alias` emails are being
dropped, both because we're sending from the sandbox `onboarding@resend.dev`.
Fix:

1. Resend → **Domains** → Add a domain you own → create the DNS records it shows
   (SPF, DKIM, and ideally DMARC). Wait for "Verified."
2. Set `NOTIFY_FROM` (step 2) to an address on that domain, and redeploy.

After this, email goes to anyone (including the aliases) and lands in the inbox,
not spam.

## 5. Reliability (optional, ~10 min) — from docs/RELIABILITY.md

- **Backup workflow:** Actions → New workflow → paste `docs/backup-workflow.yml`
  → add the `SUPABASE_DB_URL` secret.
- **Uptime watcher:** point UptimeRobot / cron-job.org at `/api/health`.

---

## What's new in this batch (so you know what to test)

- **Checklist & inventory editor** (`/checklist`, admin) — load starter items,
  edit/reorder/hide.
- **Closeout** — tap a turnover's date → `/turnover/[id]`: the cheat sheets +
  "Mark complete" (with optional 5-star + note guest feedback). Completing
  notifies you.
- **Cleaner notes** — on a turnover, leave a private note for the assigned
  cleaner; it arrives as a notification (inbox has an All / Notes filter).
- **Per-cleaner history** (`/cleaners/[id]`) — their turnovers, the feedback they
  filed, the notes you sent.
- **Notification preferences** (Account) — in-app/email switch per type.
- **Inbox** — deep links to the turnover, archive / clear, admin coverage alert
  when a cleaner releases.
- **Test tools** (`/test`, admin) — send a sample of any notification type, and
  **"send pending emails now"** (so you don't wait for the hourly drain).

## Quick test path once deployed

1. `/checklist` → Load starter items for both lists.
2. `/test` → send yourself one of each notification type → check the bell,
   archive, the "View turnover" link, and Account → Notifications toggles.
3. `/test` → "Send pending emails now" → confirm email arrives (after step 4,
   not in spam).
4. Claim a turnover as a test cleaner → open it → Mark complete with feedback →
   confirm you (admin) get the completion notice and see the feedback on
   `/turnover/[id]` and `/cleaners/[id]`.
