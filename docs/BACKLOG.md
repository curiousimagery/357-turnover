# Backlog (not yet scheduled into a phase)

Small but real items captured mid-build, to fold into the right phase later.

## Auth & onboarding UX

- **Invite email flow is broken with the server-side confirm route.** The default
  Supabase invite email links to `/auth/v1/verify?...&type=invite&redirect_to=...`,
  which returns the session in a URL **hash fragment**. Our `/auth/confirm` is a
  server route that only reads `?code=` / `?token_hash=` from the query string, so
  it errors "No token hash or code". (Magic-link sign-in works because it's
  browser-initiated PKCE → `?code=`.) Two fixes to choose from:
  - **A.** Override the Invite email template to the server-side token-hash URL:
    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/schedule`.
    Our existing route handles this. Caveat: `.SiteURL` is one configured value, so
    local vs. prod needs care.
  - **B.** _(preferred for a passwordless app)_ Admin "invite" just **provisions**
    the account (`createUser`); cleaners sign in via the normal magic link (already
    works). Send a friendly "you've been added" email via **Resend (Phase 3)**.
  - **Workaround today:** the invited account already exists, so the cleaner can
    sign in via `/auth/login` with their email (the magic-link flow works).

- **Better UX copy for auth emails + confirmation/error pages.** The current
  invite/magic-link emails are the stock Supabase copy ("You've been invited to
  create an account…"), and `/auth/error` is terse. Once Resend is in (Phase 3),
  write warm, on-brand copy for: invite, magic link, the post-click confirmation,
  and the error page. Keep it plainspoken and reassuring (these land on a phone,
  mid-turnover). Pairs naturally with fix **B** above.

## (add more here as they come up)
