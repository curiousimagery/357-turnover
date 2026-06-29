/**
 * Emails sent by systems we configure but don't author in code — currently the
 * **Supabase Auth** templates (sign-in magic link, invite, change-email). They
 * live in the Supabase dashboard (Authentication → Email Templates), NOT in
 * `notificationCopy`. They're listed here so `/test/emails` is the one place to
 * review *all* outbound copy. Treat the wording below as the working draft for a
 * voice & tone pass, then paste the final into the dashboard — the full HTML +
 * the required `token_hash` link pattern are in `docs/AUTH_EMAIL_SETUP.md`.
 */
export type ExternalEmail = {
  label: string;
  system: string;
  audience: string;
  subject: string;
  /** Plain-text rendering of the template body; [bracketed] bits are buttons. */
  body: string;
  /** Anything notable about its current state / delivery. */
  note?: string;
};

export const externalEmails: ExternalEmail[] = [
  {
    label: "Sign-in link (magic link)",
    system: "Supabase Auth",
    audience: "Anyone signing in",
    subject: "Your 357 Oasis Turnovers sign-in link",
    body: `Here's your link to sign in to 357 Oasis Turnovers. It works once and expires shortly.\n\n[ Sign in ]\n\nDidn't try to sign in? You can ignore this email — nothing happens without the link.`,
    note: "Today this sends as Supabase's default — sender \"Supabase Auth\", generic copy. Paste this subject/body into the dashboard, and set custom SMTP (Resend) so it sends from your domain.",
  },
  {
    label: "Invite",
    system: "Supabase Auth",
    audience: "A newly invited cleaner",
    subject: "You're invited to 357 Oasis Turnovers",
    body: `Join the cleaning turnover schedule\n\nDaniel is inviting you to help with turnovers at his 357 Oasis Airbnb in Seattle's Central District. This little web app lets you see upcoming turnovers, claim the cleanings you're available for, and get notified about new bookings and cancellations.\n\nClick below to confirm your email and activate your account.\n\n[ Accept the invitation ]`,
    note: "Lands the new cleaner on the /welcome first-run page.",
  },
  {
    label: "Change email — confirm",
    system: "Supabase Auth",
    audience: "A user changing their sign-in email",
    subject: "Confirm your new email for 357 Oasis Turnovers",
    body: `Confirm this is your new email for 357 Oasis Turnovers. If you didn't request this, you can safely ignore it.\n\n[ Confirm new email ]`,
    note: "With \"Secure email change\" on, Supabase sends this to both the old and new address — expect two.",
  },
];
