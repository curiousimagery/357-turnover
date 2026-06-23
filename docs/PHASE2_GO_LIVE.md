# Phase 2 — going live (your checklist)

Phase 2 (claiming, filtering, admin assign/reassign, manual turnovers, the
cleaner-tagged schedule) is built, tested, and verified locally. Code is on the
`phase-2-claiming` branch.

Unlike Phase 1, there's no new infrastructure — the hourly poller, env vars, and
redirect URLs are already set. Phase 2 go-live is just: **apply two small
additive migrations, confirm you're the admin, verify, then deploy.** Do these in
order. Nothing here touches production automatically — it's all yours to approve.

The two migrations are *additive and safe*: one new table and one new nullable
column. They can't break the live read-only schedule, and they're re-runnable.

---

## 1. Apply the two Phase 2 migrations to your hosted database

Dashboard → **SQL Editor** → New query. Run each of these (paste the whole file,
**Run**, expect "Success. No rows returned."):

1. `supabase/migrations/20260623100000_assignments.sql`
   — creates `turnover_assignments` with the `unique (turnover_id)`
   double-booking guard + its RLS policies.
2. `supabase/migrations/20260623110000_turnover_confirmation_code.sql`
   — adds the `confirmation_code` column to `turnovers`.

## 2. Make sure you're the admin

Admin controls (assign/reassign, the Cleaners screen, manual turnovers) only show
for a profile with `role = 'admin'`. Check + set yours in the SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'danieldnelson@gmail.com');
```

(If you're already admin this just re-sets it — harmless.)

## 3. Verify locally against the real data first

Your `npm run dev` talks to the hosted database, so once steps 1–2 are done you
can click through Phase 2 with your real turnovers before deploying:

```bash
npm run dev
```

Open `http://localhost:3000/schedule` and confirm: the filter works, you can
assign a date to yourself, the cleaner tag appears, and the Cleaners link shows
in the header. Confirmation codes fill in after the next sync (step 5) — they
start blank on existing turnovers.

## 4. Deploy (merge the branch to main)

When it looks right, ship it. From the repo:

```bash
git checkout main
```
```bash
git merge phase-2-claiming
```
```bash
git push
```

Vercel auto-deploys `main`. Watch the deployment go green in the Vercel dashboard.

## 5. Backfill the confirmation codes

Existing turnovers won't have a code until a sync runs after the migration. Either
wait for the top of the hour (the cron does it), or trigger one now (replace the
secret):

`https://357-turnover.vercel.app/api/sync?secret=YOUR_SYNC_SECRET`

You should get `{"status":"success",...}`. Reload `/schedule` — codes appear on
the cards.

## 6. Invite your cleaners and assign the real dates

On the live site → **Cleaners** → invite each cleaner. For testing you can use
Gmail aliases (`danieldnelson+TestCleanerA@gmail.com`); the invite email lands in
your inbox. Then on `/schedule`, use each card's **Assign** menu to set the real
schedule (e.g. the 25th, 26th, 28th).

> Optional: when you move to a custom domain, set `NEXT_PUBLIC_SITE_URL` in Vercel
> to that URL so invite links always point at the right place. Until then it
> derives correctly from the request.

---

## What "done" looks like

- `/schedule` shows cleaner tags on claimed cards; All / Mine / Unclaimed filters.
- Two people can't claim the same turnover (the second gets a friendly "already
  claimed").
- You can assign/reassign anyone, add a manual turnover, and invite a cleaner.
- Confirmation codes show on the cards.

That's the Phase 2 exit criteria (Section 8). Phase 3 (reliability +
notifications) is next.
