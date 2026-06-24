# Reliability (Section 3.4)

The schedule is authoritative; notifications are a convenience layer. These add
defenses so a silently-stuck poller — the failure mode that would drop a
turnover — gets noticed, and so the data is recoverable.

## 1. Health endpoint (built)

`GET /api/health` — public, no auth. Returns the freshness of the last
successful sync:

```json
{ "ok": true, "lastSuccessAt": "...", "ageMinutes": 12, "staleThresholdMinutes": 180 }
```

It returns **200** when a sync has succeeded within 3 hours, **503** otherwise
(or if the DB is unreachable). The hourly cron should keep `ageMinutes` small.

## 2. External watcher (you set up — ~5 min)

Point a free uptime monitor at the health URL so you're alerted when sync stalls
(this is the watcher that lives *outside* Supabase/Vercel, so it catches an
outage of either):

- **cron-job.org** or **UptimeRobot** (free) → monitor
  `https://357-turnover.vercel.app/api/health` every ~15 min → alert on a non-200.
- A 503 means "no successful sync in 3h" — go look at `sync_runs` and the cron.

## 3. Nightly backup (you set up)

Supabase's free tier has **no automated backups**, so we DIY one at zero cost: a
GitHub Action runs `pg_dump` nightly and stores the dump as an artifact (90-day
retention, offsite). The workflow lives as a template at
[docs/backup-workflow.yml](backup-workflow.yml) because our push credential can't
add `.github/workflows/` files — install it yourself:

1. GitHub repo → **Actions** → "New workflow" → "set up a workflow yourself" →
   name it `backup.yml` → paste the contents of `docs/backup-workflow.yml`
   (everything below its comment header) → Commit.
2. Supabase → Settings → Database → **Connection string (URI)** — copy the direct
   (port 5432) one, password included.
3. GitHub repo → Settings → Secrets and variables → Actions → add
   `SUPABASE_DB_URL` = that string.
4. Check your Postgres major version (Supabase → Settings → Infrastructure) and
   set `postgresql-client-NN` in the workflow to match.
5. Actions tab → run **Nightly DB backup** once (workflow_dispatch) to confirm it
   produces a `backup-*.sql` artifact.

### Quarterly test-restore (the part people skip)

A backup you've never restored isn't a backup. Once a quarter:
1. Download the latest artifact.
2. `npx supabase db reset` (fresh local), then
   `psql "$(npx supabase status -o env | grep DB_URL ...)" < backup-YYYYMMDD.sql`
   into a scratch local DB and spot-check row counts (bookings, turnovers,
   assignments, profiles).

## Already in place (earlier phases)

- **Defensive sync** — never treats an empty/failed feed as cancellation; never
  hard-deletes turnovers; recomputes same-day every run; idempotent upserts.
- **Observability** — `sync_runs` (every run + error) and `sync_state`
  (heartbeat). The schedule's "synced N ago" chip reads the heartbeat.
- **Notifications can't break sync** — every enqueue/send is in a try/catch after
  the schedule is reconciled.
