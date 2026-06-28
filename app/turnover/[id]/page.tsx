import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Star } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { CleanerTag } from "@/components/cleaner-tag";
import { CloseoutChecklist } from "@/components/closeout-checklist";
import { SupplyNotes, type SupplyNote } from "@/components/supply-notes";
import { DeleteTurnoverButton } from "@/components/delete-turnover-button";
import { CleanerNoteForm } from "@/components/cleaner-note-form";
import { PaymentControls } from "@/components/payment-controls";
import { TurnoverActions } from "@/components/turnover-actions";
import { PrepNotes } from "@/components/prep-notes";
import { GuestFeedbackForm } from "@/components/guest-feedback-form";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { formatMonthDay, formatWeekday, formatNiceDate } from "@/lib/dates";

export const metadata = { title: "Turnover — 357 Oasis Turnovers" };

type Item = { id: string; name: string; description: string; helper: string | null };

function ItemList({
  items,
  checked,
}: {
  items: Item[];
  checked?: Record<string, boolean>;
}) {
  if (items.length === 0) {
    return <p className="text-caption text-muted-foreground">Nothing set up yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => {
        const done = !!checked?.[it.id];
        return (
          <div key={it.id} className="flex items-start gap-2">
            {checked && (
              <Check
                className={cn(
                  "mt-1 size-4 shrink-0",
                  done ? "text-success" : "text-muted-foreground/30",
                )}
              />
            )}
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  "text-body font-semibold",
                  done ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {it.name}
              </span>
              <span className="text-caption text-muted-foreground">{it.description}</span>
              {it.helper && (
                <span className="text-caption text-muted-foreground italic">{it.helper}</span>
              )}
            </div>
          </div>
        );
      })}
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
      "id, turnover_date, status, is_same_day, source, confirmation_code, notes, turnover_assignments ( cleaner_id, profiles ( display_name, color ) )",
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
  const canSeeNotes = isAdmin || isAssigned;

  const [
    { data: checklist },
    { data: inventory },
    { data: feedback },
    { data: payment },
    { data: cleanerRows },
    { data: completions },
    { data: supplyRows },
  ] = await Promise.all([
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
    supabase
      .from("payments")
      .select("amount, paid_at")
      .eq("turnover_id", id)
      .maybeSingle(),
    isAdmin
      ? supabase
          .from("profiles")
          .select("id, display_name, color")
          .eq("active", true)
          .eq("role", "cleaner")
          .order("display_name", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; display_name: string; color: string | null }[] }),
    // Persisted closeout ticks + supply flags. Defensive: empty if not yet migrated.
    supabase
      .from("turnover_checklist_completions")
      .select("item_id")
      .eq("turnover_id", id),
    supabase
      .from("supply_notes")
      .select("id, body, created_at, resolved, author_id")
      .eq("turnover_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const checkedItems: Record<string, boolean> = Object.fromEntries(
    (completions ?? []).map((c) => [c.item_id as string, true]),
  );

  // Resolve supply-note author names (cleaner or admin) in one lookup.
  const supplyAuthorIds = [
    ...new Set((supplyRows ?? []).map((n) => n.author_id).filter(Boolean)),
  ] as string[];
  const { data: supplyAuthors } = supplyAuthorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", supplyAuthorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const supplyNameById = new Map(
    (supplyAuthors ?? []).map((a) => [a.id, a.display_name as string]),
  );
  const supplyNotes: SupplyNote[] = (supplyRows ?? []).map((n) => ({
    id: n.id as string,
    body: n.body as string,
    authorName: n.author_id ? (supplyNameById.get(n.author_id as string) ?? null) : null,
    createdAt: n.created_at as string,
    resolved: !!n.resolved,
  }));

  // Admin→cleaner notes ride the notifications table; the recipient is the
  // assigned cleaner, so we read them with the service role (gated above).
  let cleanerNotes: { body: string; created_at: string }[] = [];
  if (canSeeNotes) {
    const { data } = await createAdminClient()
      .from("notifications")
      .select("body, created_at")
      .eq("turnover_id", id)
      .eq("type", "cleaner_note")
      .order("created_at", { ascending: false });
    cleanerNotes = (data ?? []) as { body: string; created_at: string }[];
  }

  const cleaners = (cleanerRows ?? []).map((c) => ({
    id: c.id as string,
    name: c.display_name as string,
    color: c.color as string | null,
  }));

  const paymentAmount = (payment?.amount as number | null) ?? null;
  const paid = !!payment?.paid_at;
  let prefillAmount = paymentAmount;
  if (isAdmin && prefillAmount == null && assignment?.cleaner_id) {
    const { data: rate } = await supabase
      .from("cleaner_rates")
      .select("default_rate")
      .eq("cleaner_id", assignment.cleaner_id)
      .maybeSingle();
    prefillAmount = (rate?.default_rate as number | null) ?? null;
  }

  const prepNotes = (turnover.notes as string | null) ?? "";

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 text-caption font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to schedule
        </Link>

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
          {status === "scheduled" && (
            <div className="pt-2">
              <TurnoverActions
                turnoverId={turnover.id as string}
                assigneeId={assignment?.cleaner_id ?? null}
                isAdmin={isAdmin}
                currentUserId={user.id}
                cleaners={cleaners}
              />
            </div>
          )}
        </div>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Before you leave</h2>
          {canComplete ? (
            <CloseoutChecklist
              turnoverId={turnover.id as string}
              items={(checklist ?? []) as Item[]}
              initialChecked={checkedItems}
            />
          ) : (
            <ItemList items={(checklist ?? []) as Item[]} checked={checkedItems} />
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-heading">Prep notes</h2>
            <p className="text-caption text-muted-foreground">
              Shared between you and Daniel — early check-in, special requests,
              lost &amp; found.
            </p>
          </div>
          <PrepNotes
            turnoverId={turnover.id as string}
            initial={prepNotes}
            canEdit={isAdmin || isAssigned}
          />
        </Card>

        {canSeeNotes && (
          <Card className="flex flex-col gap-4 p-6">
            <h2 className="text-heading">Follow-up notes from Daniel</h2>
            {cleanerNotes.length > 0 ? (
              <div className="flex flex-col gap-3">
                {cleanerNotes.map((n, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <p className="whitespace-pre-wrap text-body text-foreground">{n.body}</p>
                    <span className="text-caption text-muted-foreground">
                      {formatNiceDate(String(n.created_at).slice(0, 10))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-caption text-muted-foreground">No notes yet.</p>
            )}
            {isAdmin && assignee && (
              <CleanerNoteForm
                turnoverId={turnover.id as string}
                cleanerName={assignee.display_name}
              />
            )}
          </Card>
        )}

        {assignee && (isAdmin || isAssigned) && (
          <Card className="flex flex-col gap-4 p-6">
            <h2 className="text-heading">Payment</h2>
            {isAdmin ? (
              <PaymentControls
                turnoverId={turnover.id as string}
                initialAmount={prefillAmount}
                initialPaid={paid}
              />
            ) : (
              <p className="text-body text-foreground">
                {paid
                  ? `Paid${paymentAmount != null ? ` $${paymentAmount}` : ""}.`
                  : "Not paid yet."}
              </p>
            )}
          </Card>
        )}

        <Card className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-heading">Supplies</h2>
            <p className="text-caption text-muted-foreground">
              Flag anything running low — it goes on Daniel&apos;s supply list.
            </p>
          </div>
          <SupplyNotes
            turnoverId={turnover.id as string}
            notes={supplyNotes}
            canAdd={isAdmin || isAssigned}
            isAdmin={isAdmin}
          />
          {(inventory ?? []).length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="text-caption font-semibold text-muted-foreground">
                What we stock
              </h3>
              <ItemList items={(inventory ?? []) as Item[]} />
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Guest feedback</h2>
          {(feedback ?? []).length > 0 ? (
            (feedback ?? []).map((f, i) => (
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
            ))
          ) : (
            <p className="text-caption text-muted-foreground">No feedback yet.</p>
          )}
          {status === "completed" && (isAdmin || isAssigned) && (
            <div className="border-t border-border pt-4">
              <GuestFeedbackForm turnoverId={turnover.id as string} />
            </div>
          )}
        </Card>

        {isAdmin && turnover.source === "manual" && (
          <div>
            <DeleteTurnoverButton turnoverId={turnover.id as string} />
          </div>
        )}
      </main>
    </div>
  );
}
