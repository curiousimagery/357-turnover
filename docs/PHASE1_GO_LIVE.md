# Phase 1 — going live (your checklist)

Phase 1 (the live schedule) is built, tested, and verified locally end-to-end.
Code is on the `phase-1-schedule` branch. To make it live we connect the real
Airbnb feed and turn on the hourly poller. These are point-and-click + paste
steps. Do them in order; ping me on any one and I'll walk you through it.

Nothing here was done to production automatically — it's all yours to approve.

---

## 1. Apply the Phase 1 migration to your hosted database

Dashboard → **SQL Editor** → New query → paste the entire contents of
`supabase/migrations/20260623000000_schedule.sql` → **Run**. (Same as last time;
it's safely re-runnable. Expect "Success. No rows returned.")

This creates `bookings`, `turnovers`, `sync_runs`, `sync_state` with RLS + grants.

## 2. Get your Airbnb iCal export URL

Airbnb → your listing → **Availability** → **Connect to another website** /
**Export Calendar** → copy the `.ics` link. Keep it private (anyone with it can
read your booking dates).

## 3. Add three environment variables

These power the sync. Add them in **both** places:

- **Vercel:** Project → Settings → Environment Variables (Production + Preview)
- **`.env.local`** on your machine (so local runs work too)

| Key | Value |
| --- | --- |
| `AIRBNB_ICAL_URL` | the `.ics` link from step 2 |
| `SUPABASE_SECRET_KEY` | Dashboard → Settings → API → **secret** key (`sb_secret_…`). Server-only — never `NEXT_PUBLIC_`. |
| `SYNC_SECRET` | a random string. Generate one in a terminal: `openssl rand -hex 32` |

After adding the Vercel vars, **redeploy** (Vercel → Deployments → ⋯ → Redeploy)
so the running app picks them up.

## 4. Add the live site to Supabase redirect URLs (if not already)

Dashboard → Authentication → URL Configuration → Redirect URLs →
`https://<your-app>.vercel.app/**` (so production sign-in works).

## 5. Do a first sync (manual) and verify

Visit (replace the host + secret):
`https://<your-app>.vercel.app/api/sync?secret=YOUR_SYNC_SECRET`

You should get JSON like `{"status":"success","added":N,...}`. Then open
`/schedule` on the live site — your upcoming turnovers should appear, same-day
ones flagged. (If it says `unauthorized`, the secret doesn't match; `success`
with `added:0` means it ran but found nothing ahead.)

## 6. Turn on the hourly poller (pg_cron + pg_net)

Dashboard → SQL Editor → run this **once** (edit the URL + secret first):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'turnover-sync-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-app>.vercel.app/api/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SYNC_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

This calls the sync endpoint every hour (which also keeps the free Supabase
project awake). To check it later: `select * from cron.job;` and
`select * from public.sync_runs order by started_at desc limit 5;`.

> Security note: the secret sits in the stored cron command (admin-only). When
> we get to Phase 3 we can move it into Supabase Vault for extra hygiene.

---

## What "done" looks like

- `/schedule` shows the real upcoming turnovers, same-day unmistakable.
- `select * from sync_runs` shows hourly `success` rows.
- The "synced N ago" chip on `/schedule` stays fresh.

That's the Phase 1 exit criteria (Section 8). Phase 2 (claiming + filtering +
cleaner tags + manual turnovers) is next.
