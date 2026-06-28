# Email delivery (Resend) — setup

Notifications are enqueued during each sync and delivered by email from the same
hourly run. The sender is a no-op until `RESEND_API_KEY` is set, so nothing
breaks before you finish this. (Email is a convenience layer — the schedule and
the in-app inbox don't depend on it.)

## 1. Get an API key

Resend dashboard → **API Keys** → Create. Copy the `re_…` key.

## 2. Add env vars (`.env.local` and Vercel)

| Key | Value |
| --- | --- |
| `RESEND_API_KEY` | the `re_…` key (server-only — never `NEXT_PUBLIC_`) |
| `NOTIFY_FROM` | sender, e.g. `357 Oasis Turnovers <turnovers@yourdomain.com>` (see step 3) |
| `NEXT_PUBLIC_SITE_URL` | your app URL, for the "open the schedule" link (e.g. `https://357-turnover.vercel.app`) |

After adding the Vercel vars, redeploy so the running app picks them up.

## 3. Sender address — sandbox vs. verified domain

- **Quick test (no domain):** leave `NOTIFY_FROM` unset — it defaults to
  `onboarding@resend.dev`. Resend's sandbox only delivers to **the email you
  signed up with**, and `you+alias@gmail.com` counts as a *different* address, so
  the cleaner aliases may bounce. To smoke-test, point one test cleaner at your
  exact account email.
- **Real use:** Resend → **Domains** → add a domain you own and create the DNS
  records it shows (SPF/DKIM). Once verified, set `NOTIFY_FROM` to an address on
  that domain and email goes to anyone — including the `+alias` cleaners.

### Current setup — prod is verified; dev uses the sandbox

- **Prod (Vercel):** `NOTIFY_FROM = 357 Oasis Turnovers <noreply@mail.curiousimagery.com>`
  on the verified `mail.curiousimagery.com` domain → delivers to **anyone**. Test
  `+alias` cleaner addresses **from prod**.
- **Dev (`npm run dev`):** `.env.local` has no `NOTIFY_FROM`, so it falls back to
  the sandbox (`onboarding@resend.dev`), which only delivers to your **own** Resend
  account email. A send to a `+alias` tester from dev returns "failed 1" — that's
  **expected, not a bug** (and it's a quiet failure now, never a crash). Add
  `NOTIFY_FROM` to `.env.local` if you want dev to mirror prod and send for real.

## 4. Test it

Make a notification exist (add a manual turnover, or let a sync pick up a new
booking), then hit the sync endpoint:

```
https://357-turnover.vercel.app/api/sync?secret=YOUR_SYNC_SECRET
```

The JSON response includes a `delivery` field, e.g. `{"sent":1,"failed":0}`.
Sent rows flip to `status='sent'` in `notifications` and won't resend.

> Note: a failed send marks that row `failed` (no auto-retry yet). The in-app
> inbox still shows it, so nothing is lost. Retry/backoff is a backlog item.
