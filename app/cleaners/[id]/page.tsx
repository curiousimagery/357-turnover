import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Star } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { CleanerTag } from "@/components/cleaner-tag";
import { RateForm } from "@/components/rate-form";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { formatMonthDay } from "@/lib/dates";

export const metadata = { title: "Cleaner — 357 Oasis Turnovers" };

export default async function CleanerHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: cleaner } = await supabase
    .from("profiles")
    .select("display_name, color, role, active")
    .eq("id", id)
    .maybeSingle();
  if (!cleaner) notFound();

  const [{ data: assignments }, { data: feedback }, { data: payments }, { data: rate }] =
    await Promise.all([
      supabase
        .from("turnover_assignments")
        .select("turnovers ( id, turnover_date, status )")
        .eq("cleaner_id", id),
      supabase
        .from("guest_feedback")
        .select("turnover_id, cleanliness, note, created_at")
        .eq("created_by", id)
        .order("created_at", { ascending: false }),
      supabase.from("payments").select("amount, paid_at").eq("cleaner_id", id),
      supabase
        .from("cleaner_rates")
        .select("default_rate")
        .eq("cleaner_id", id)
        .maybeSingle(),
    ]);

  const year = new Date().getFullYear();
  const yearTotal = (payments ?? []).reduce((sum, p) => {
    const when = p.paid_at as string | null;
    if (when && new Date(when).getFullYear() === year && p.amount != null) {
      return sum + Number(p.amount);
    }
    return sum;
  }, 0);

  // Notes are notifications addressed to the cleaner — only the recipient can
  // read them under RLS, so use the admin client here (page is admin-gated).
  const { data: notes } = await createAdminClient()
    .from("notifications")
    .select("turnover_id, body, created_at")
    .eq("recipient_id", id)
    .eq("type", "cleaner_note")
    .order("created_at", { ascending: false })
    .limit(50);

  type Turn = { id: string; turnover_date: string; status: string };
  const turnovers = (assignments ?? [])
    .map((a) => {
      const t = (a as { turnovers: unknown }).turnovers;
      return (Array.isArray(t) ? t[0] : t) as Turn | null;
    })
    .filter((t): t is Turn => !!t)
    .sort((a, b) => (a.turnover_date < b.turnover_date ? 1 : -1));

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex items-center gap-3">
          <CleanerTag name={cleaner.display_name} color={cleaner.color} withName />
          {cleaner.role === "admin" && <StatusBadge tone="outline">Admin</StatusBadge>}
          {!cleaner.active && <StatusBadge tone="neutral">Inactive</StatusBadge>}
        </div>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Pay</h2>
          <RateForm
            cleanerId={id}
            initial={(rate?.default_rate as number | null) ?? null}
          />
          <p className="text-caption text-muted-foreground">
            Paid in {year}:{" "}
            <span className="font-semibold text-foreground">
              ${yearTotal.toFixed(2)}
            </span>
          </p>
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <h2 className="text-heading">Turnovers ({turnovers.length})</h2>
          {turnovers.length === 0 ? (
            <p className="text-caption text-muted-foreground">None yet.</p>
          ) : (
            turnovers.map((t) => (
              <Link
                key={t.id}
                href={`/turnover/${t.id}`}
                className="flex items-center justify-between gap-2 hover:underline"
              >
                <span className="text-body text-foreground">
                  {formatMonthDay(t.turnover_date)}
                </span>
                <span className="text-caption text-muted-foreground">
                  {t.status}
                </span>
              </Link>
            ))
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <h2 className="text-heading">Guest feedback they filed</h2>
          {(feedback ?? []).length === 0 ? (
            <p className="text-caption text-muted-foreground">None yet.</p>
          ) : (
            (feedback ?? []).map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                {f.cleanliness != null && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          "size-4",
                          n <= (f.cleanliness as number)
                            ? "fill-warning text-warning"
                            : "text-muted-foreground",
                        )}
                      />
                    ))}
                  </div>
                )}
                {f.note && <p className="text-body text-foreground">{f.note as string}</p>}
              </div>
            ))
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <h2 className="text-heading">Notes you&apos;ve sent</h2>
          {(notes ?? []).length === 0 ? (
            <p className="text-caption text-muted-foreground">None yet.</p>
          ) : (
            (notes ?? []).map((n, i) => (
              <p key={i} className="text-body text-foreground">
                {n.body as string}
              </p>
            ))
          )}
        </Card>
      </main>
    </div>
  );
}
