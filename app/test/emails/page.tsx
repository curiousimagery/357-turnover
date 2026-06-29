import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { notificationCopy, emailFooter } from "@/lib/notify/copy";
import { externalEmails } from "@/lib/notify/external-emails";

export const metadata = { title: "Email copy — 357 Oasis Turnovers" };

/** A sample turnover date (10 days out) so the copy reads naturally. */
function sampleDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  return d.toISOString().slice(0, 10);
}

type Sample = {
  label: string;
  audience: string;
  title: string;
  body: string;
  system?: string;
  note?: string;
};

function samples(): { cleaner: Sample[]; admin: Sample[] } {
  const date = sampleDateIso();
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 7);
  const prevIso = prev.toISOString().slice(0, 10);

  const cleaner: Sample[] = [
    { label: "New turnover available", audience: "All cleaners", ...notificationCopy.new(date) },
    { label: "A turnover reopened", audience: "The other cleaners", ...notificationCopy.available(date) },
    { label: "You were assigned", audience: "The assigned cleaner", ...notificationCopy.assigned(date) },
    { label: "You were taken off", audience: "The removed cleaner", ...notificationCopy.unassigned(date) },
    { label: "Date changed (you held it)", audience: "The cleaner who had it", ...notificationCopy.dateChanged(prevIso, date) },
    { label: "Turnover cancelled", audience: "The cleaner who had it", ...notificationCopy.cancelled(date) },
    { label: "Became same-day", audience: "The assigned cleaner", ...notificationCopy.becameSameDay(date) },
    { label: "Reminder — relaxed", audience: "The assigned cleaner", ...notificationCopy.reminder(date, false) },
    { label: "Reminder — same-day", audience: "The assigned cleaner", ...notificationCopy.reminder(date, true) },
    { label: "You've been paid", audience: "The paid cleaner", ...notificationCopy.paymentSent(date, 85) },
    {
      label: "Follow-up note from Daniel",
      audience: "The assigned cleaner",
      ...notificationCopy.cleanerNote(date, "Thanks for the quick turn — the guest mentioned the shower drain was slow, can you take a look next time?"),
    },
  ];

  const admin: Sample[] = [
    { label: "A turnover needs coverage", audience: "Admins", ...notificationCopy.released(date, "Tiffany") },
    { label: "Turnover completed", audience: "Admins", ...notificationCopy.completed(date, "Tiffany") },
  ];

  return { cleaner, admin };
}

function EmailCard({ s }: { s: Sample }) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-heading">{s.label}</span>
        <span className="text-caption text-muted-foreground">
          {s.system ? `${s.system} · ` : ""}to {s.audience}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-caption font-semibold text-muted-foreground">Subject</span>
        <p className="text-body text-foreground">{s.title}</p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-caption font-semibold text-muted-foreground">Body</span>
        <p className="whitespace-pre-wrap rounded-md bg-muted p-4 text-body text-foreground">
          {s.body}
        </p>
      </div>
      {s.note && <p className="text-caption italic text-muted-foreground">{s.note}</p>}
    </Card>
  );
}

export default async function EmailCopyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") redirect("/schedule");

  const { cleaner, admin } = samples();
  const footer = emailFooter("https://357-turnover.vercel.app").trim();

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <Link
          href="/test"
          className="inline-flex items-center gap-1 text-caption font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to test tools
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="text-display">Email &amp; notification copy</h1>
          <p className="text-body text-muted-foreground">
            Every email this project can send — the app&apos;s own notifications
            plus the Supabase sign-in/account emails — with sample values filled
            in, for a voice &amp; tone pass. App copy is the same text as the
            in-app inbox row; edit it in{" "}
            <span className="font-semibold">lib/notify/copy.ts</span>. The Supabase
            ones are edited in the dashboard (drafts in{" "}
            <span className="font-semibold">lib/notify/external-emails.ts</span>).
          </p>
        </div>

        <Card className="flex flex-col gap-2 p-6">
          <span className="text-caption font-semibold text-muted-foreground">
            Footer appended to every email
          </span>
          <p className="whitespace-pre-wrap rounded-md bg-muted p-4 text-caption text-muted-foreground">
            {footer}
          </p>
          <p className="text-caption text-muted-foreground">
            This footer is on the app&apos;s own emails only — the Supabase
            sign-in/account emails further down don&apos;t include it.
          </p>
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-heading">Cleaner-facing</h2>
          {cleaner.map((s) => (
            <EmailCard key={s.label} s={s} />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-heading">Admin-facing</h2>
          {admin.map((s) => (
            <EmailCard key={s.label} s={s} />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-heading">Sign-in &amp; account (Supabase)</h2>
          <p className="text-caption text-muted-foreground">
            Sent by Supabase Auth, not this app. Edit in the dashboard
            (Authentication → Email Templates); see{" "}
            <span className="font-semibold">docs/AUTH_EMAIL_SETUP.md</span>.
          </p>
          {externalEmails.map((e) => (
            <EmailCard
              key={e.label}
              s={{
                label: e.label,
                audience: e.audience,
                title: e.subject,
                body: e.body,
                system: e.system,
                note: e.note,
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
