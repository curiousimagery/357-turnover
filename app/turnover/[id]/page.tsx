import { notFound, redirect } from "next/navigation";
import { Star } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { CleanerTag } from "@/components/cleaner-tag";
import { CloseoutActions } from "@/components/closeout-actions";
import { CleanerNoteForm } from "@/components/cleaner-note-form";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatMonthDay, formatWeekday } from "@/lib/dates";

export const metadata = { title: "Turnover — 357 Oasis Turnovers" };

type Item = { id: string; name: string; description: string; helper: string | null };

function ItemList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-caption text-muted-foreground">Nothing set up yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.id} className="flex flex-col gap-1">
          <span className="text-body font-semibold text-foreground">{it.name}</span>
          <span className="text-caption text-muted-foreground">{it.description}</span>
          {it.helper && (
            <span className="text-caption text-muted-foreground italic">{it.helper}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function TurnoverDetailPage({
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
  const isAdmin = me?.role === "admin";

  const { data: turnover } = await supabase
    .from("turnovers")
    .select(
      "id, turnover_date, status, is_same_day, source, confirmation_code, turnover_assignments ( cleaner_id, profiles ( display_name, color ) )",
    )
    .eq("id", id)
    .maybeSingle();
  if (!turnover) notFound();

  const embed = (turnover as { turnover_assignments: unknown }).turnover_assignments;
  const assignment = (Array.isArray(embed) ? embed[0] : embed) as
    | { cleaner_id: string; profiles: { display_name: string; color: string | null } | null }
    | null;
  const assignee = assignment?.profiles ?? null;
  const isAssigned = assignment?.cleaner_id === user.id;
  const status = turnover.status as string;
  const canComplete = (isAdmin || isAssigned) && status === "scheduled";

  const [{ data: checklist }, { data: inventory }, { data: feedback }] =
    await Promise.all([
      supabase
        .from("checklist_items")
        .select("id, name, description, helper")
        .eq("active", true)
        .order("position", { ascending: true }),
      supabase
        .from("inventory_items")
        .select("id, name, description, helper")
        .eq("active", true)
        .order("position", { ascending: true }),
      supabase
        .from("guest_feedback")
        .select("cleanliness, note, created_at")
        .eq("turnover_id", id)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <div className="text-display">{formatMonthDay(turnover.turnover_date as string)}</div>
          <div className="text-caption text-muted-foreground">
            {formatWeekday(turnover.turnover_date as string)}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {turnover.is_same_day ? (
              <StatusBadge tone="urgent">Same-day</StatusBadge>
            ) : (
              status !== "completed" && <StatusBadge tone="neutral">Relaxed</StatusBadge>
            )}
            {status === "completed" && <StatusBadge tone="success">Completed</StatusBadge>}
            {status === "cancelled" && <StatusBadge tone="danger">Cancelled</StatusBadge>}
            {turnover.source === "manual" && <StatusBadge tone="outline">Manual</StatusBadge>}
            {turnover.confirmation_code && (
              <span className="text-caption text-muted-foreground">
                Airbnb · {turnover.confirmation_code as string}
              </span>
            )}
            {assignee && (
              <CleanerTag name={assignee.display_name} color={assignee.color} withName />
            )}
          </div>
        </div>

        {canComplete && (
          <Card className="flex flex-col gap-3 p-6">
            <p className="text-body text-foreground">Done with this turnover?</p>
            <CloseoutActions turnoverId={turnover.id as string} />
          </Card>
        )}

        {isAdmin && assignee && (
          <Card className="flex flex-col gap-4 p-6">
            <h2 className="text-heading">Note for the cleaner</h2>
            <CleanerNoteForm
              turnoverId={turnover.id as string}
              cleanerName={assignee.display_name}
            />
          </Card>
        )}

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Before you leave</h2>
          <ItemList items={(checklist ?? []) as Item[]} />
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Inventory refills</h2>
          <p className="text-caption text-muted-foreground">
            Flag anything low to Daniel.
          </p>
          <ItemList items={(inventory ?? []) as Item[]} />
        </Card>

        {(feedback ?? []).length > 0 && (
          <Card className="flex flex-col gap-3 p-6">
            <h2 className="text-heading">Guest feedback</h2>
            {(feedback ?? []).map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                {f.cleanliness != null && (
                  <div className="flex gap-1" aria-label={`${f.cleanliness} of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          "size-5",
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
            ))}
          </Card>
        )}
      </main>
    </div>
  );
}
