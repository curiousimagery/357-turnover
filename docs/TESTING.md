# Testing the notification engine

Notifications have **two layers**, and you test them differently:

1. **The logic** — "does a calendar change produce the right notification?" — is
   pure and **already covered by automated tests**. Run `npm test`:
   `lib/sync/sync.test.ts` (parse / derive / same-day / blocks excluded),
   `lib/notify/changes.test.ts` + `notify.test.ts` (diff → which notifications),
   `lib/notify/reminders.test.ts`. This is the reliability backbone — trust it
   first.
2. **The live pipeline** — "does a real sync write the right rows and send the
   email?" — is what you **spoof** by hand, below.

## How sync works (so spoofing makes sense)

`/api/sync` does: fetch the iCal at `AIRBNB_ICAL_URL` → parse → reconcile
`bookings` → derive `turnovers` (recompute same-day) → **diff vs. the prior
state** → enqueue `notifications` → drain pending emails (Resend). It's idempotent
(a `dedupe_key`), so **re-running the same feed notifies nothing** — only a real
change between runs fires a notification. To spoof, you point the feed at a file
you control and run sync twice with an edit in between.

## Setup (a throwaway local feed)

1. Make an editable feed the dev server can serve:
   ```bash
   cp lib/sync/__fixtures__/summer-2026.ics public/test-feed.ics
   ```
   It's now at `http://localhost:3000/test-feed.ics`.
2. In `.env.local`, point the app at it (note your real URL first, to restore
   later): `AIRBNB_ICAL_URL=http://localhost:3000/test-feed.ics`
3. `npm run dev`
4. **Baseline sync** — paste this in your browser (or `curl` it), using your
   `SYNC_SECRET` from `.env.local`:
   `http://localhost:3000/api/sync?secret=YOUR_SYNC_SECRET`
   The JSON response shows `{ added, changed, cancelled, ... }`.

Then edit `public/test-feed.ics`, hit that sync URL again, and watch the inbox.

> **Which database?** The dev server writes to whatever Supabase `.env.local`
> points at. Against the **hosted** DB this creates real rows (and can email test
> cleaners) — use clearly-fake **far-future dates** (e.g. 2030) and delete the
> rows after, or run against **local Supabase** (`npx supabase start` +
> `db reset`) for full isolation (you'll need to seed a cleaner profile so
> notifications have a recipient).

## A reservation looks like this

```
BEGIN:VEVENT
DTEND;VALUE=DATE:20300625      <- checkout date = the turnover date
DTSTART;VALUE=DATE:20300622    <- check-in
UID:spoof1@airbnb.example      <- must be unique & stable
SUMMARY:Reserved               <- "Reserved" = reservation; anything else = block
END:VEVENT
```

## Scenarios → what should fire

| Simulate | Edit `public/test-feed.ics`, then re-sync | Expect |
|---|---|---|
| **New turnover** | Add a `Reserved` VEVENT, future `DTEND`, unique `UID` | `new` → every active cleaner |
| **Cancellation** | Delete a reservation VEVENT | `cancelled` → the cleaner who claimed it; turnover marked cancelled |
| **Date change** | Change a reservation's `DTEND` to another date | `date_changed` → prior assignee (claim is **released**) + "new date open" to all |
| **Relaxed → same-day** | On a claimed relaxed checkout, add a new reservation whose `DTSTART` = that checkout date | `became_same_day` → the assigned cleaner (+ admin) |
| **Reminder** | (no feed edit) claim a turnover 1–2 days out, then sync | `reminder` → assigned cleaner |
| **Empty-feed safety** | Replace the file with just `BEGIN:VCALENDAR` / `END:VCALENDAR` | sync = `skipped`, **nothing cancelled** (the critical guard) |

**Preconditions that bite:** `new` / "date open" only notify **active cleaners**
for **future** dates. `date_changed` and `became_same_day` notify the **assignee**,
so **claim the turnover first** (sign in as a test cleaner and claim it), *then*
edit the feed and re-sync.

## Seeing the results

- **In-app:** the bell / `/inbox` (refresh to update — near-real-time is backlog).
- **Email:** the sync run drains pending emails if `RESEND_API_KEY` + `NOTIFY_FROM`
  are set; otherwise use `/test` → **"Send pending emails now."**
- **Raw truth:** open the `notifications` table in Supabase Studio to see exactly
  what enqueued (`type`, `recipient_id`, `dedupe_key`, `status`).

The `/test` page (admin) also injects one sample of **any** notification type
directly — use it to check the inbox, archive, deep links, and email delivery
without touching the calendar.

## Cleanup

Restore `AIRBNB_ICAL_URL` to the real feed; delete `public/test-feed.ics`. If you
spoofed against the hosted DB, delete the fake `bookings` / `turnovers` /
`notifications` rows (or `npx supabase db reset` on local).
