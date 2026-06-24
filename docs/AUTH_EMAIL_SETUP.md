# Auth email templates (one-time dashboard setup)

Supabase's default auth emails hand the session back in a URL **hash fragment**,
which our server-side `/auth/confirm` route can't read (that's the "No token hash
or code" error on invites). The fix is to make each email link point straight at
our confirm route with a **token hash** in the normal query string. Our route
already verifies `invite` and `email_change` that way — this is purely a
template edit. (Magic-link sign-in already works via PKCE, so it's optional.)

Do this in **Dashboard → Authentication → Email Templates**. Re-do it on the
hosted project for go-live.

## The link pattern

Every template's button becomes this (only `type=` differs):

```
{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite
```

`{{ .RedirectTo }}` is the URL our server action already passes (with the right
origin + `next=`), so the same template works on localhost and in prod with no
changes. If your Supabase version doesn't expose `{{ .RedirectTo }}` in a given
template, use `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/welcome`
and set **Authentication → URL Configuration → Site URL** to the environment
you're testing.

## Invite user

- **Subject:** `You're invited to 357 Oasis Turnovers`
- **Body:**

```html
<h2>Join the cleaning turnover schedule</h2>
<p>
  Daniel is inviting you to help with turnovers at his 357 Oasis Airbnb in
  Seattle's Central District. This little web app lets you see upcoming
  turnovers, claim the cleanings you're available for, and get notified about
  new bookings and cancellations.
</p>
<p>Click below to confirm your email and activate your account.</p>
<p>
  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">
    Accept the invitation
  </a>
</p>
```

The invite lands the new cleaner on `/welcome` (the friendly first-run page).

## Change Email Address

- **Subject:** `Confirm your new email for 357 Oasis Turnovers`
- **Body:**

```html
<p>
  Confirm this is your new email for 357 Oasis Turnovers. If you didn't request
  this, you can safely ignore it.
</p>
<p>
  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email_change">
    Confirm new email
  </a>
</p>
```

> Note: Supabase's "Secure email change" setting (Authentication → Providers →
> Email) sends a confirmation to **both** the old and new address. Fine to leave
> on; just expect two emails. The app's "Update email" button works once this
> template is in place.

## Magic link (optional, for consistency)

It already works, but if you want the same server-side flow:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">Sign in</a>
```
