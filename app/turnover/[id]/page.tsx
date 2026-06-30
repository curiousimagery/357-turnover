import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Star } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { CleanerTag } from "@/components/cleaner-tag";
import { CloseoutFlow } from "@/components/closeout-flow";
import { StartTurnoverButton } from "@/components/start-turnover-button";
import { ReopenTurnoverButton } from "@/components/reopen-turnover-button";
import type { SupplyNote } from "@/components/supply-notes";
import { DeleteTurnoverButton } from "@/components/delete-turnover-button";
import { CleanerNoteForm } from "@/components/cleaner-note-form";
import { PaymentControls } from "@/components/payment-controls";
import { TurnoverActions } from "@/components/turnover-actions";
import { PrepNotes } from "@/components/prep-notes";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { formatMonthDay, formatWeekday, formatNiceDate } from "@/lib/dates";

export const metadata = { title: "Turnover — 357 Oasis Turnovers" };

type Item = { id: string; name: string; description: string; helper: string | null };

/** Read-only render of a list (checklist results / stock reference). One line:
 *  **Name:** description; helper below in muted (non-italic) text. */
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
                className={`text-body ${
                  done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                <span className="font-semibold">{it.name}:</span> {it.description}
              </span>
              {it.helper && (
                <span className="text-caption text-muted-foreground">{it.helper}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeedbackList({
  feedback,
}: {
  feedback: { cleanliness: number | null; note: string | null }[];
}) {
  if (feedback.length === 0) {
    return <p className="text-caption text-muted-foreground">No feedback yet.</p>;
  }
  return (
    <>
      {feedback.map((f, i) => (
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
          {f.note && <p className="text-body text-foreground">{f.note}</p>}
        </div>
      ))}
    </>
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
      "id, turnover_date, status, is_same_day, source, confirmation_code, created_by, started_at, notes, turnover_assignments ( cleaner_id, profiles ( display_name, color ) )",
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
  const isClaimed = !!assignment;
  const started = !!turnover.started_at;
  const canWork = isAdmin || isAssigned;
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

  // Names for the manual creator + supply-note authors, in one lookup.
  const peopleIds = [
    ...new Set([
      ...((supplyRows ?? []).map((n) => n.author_id)),
      (turnover.created_by as string | null) ?? null,
    ].filter(Boolean)),
  ] as string[];
  const { data: people } = peopleIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", peopleIds)
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.display_name as string]));

  const creatorName = turnover.created_by
    ? (nameById.get(turnover.created_by as string) ?? null)
    : null;
  const supplyNotes: SupplyNote[] = (supplyRows ?? []).map((n) => ({
    id: n.id as string,
    body: n.body as string,
    authorName: n.author_id ? (nameById.get(n.author_id as string) ?? null) : null,
    createdAt: n.created_at as string,
    resolved: !!n.resolved,
  }));

  // Admin→cleaner notes ride the notifications table; read with the service role.
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

  // Sole-admin first name for "Paid … by …" (full multi-admin name handling is
  // backlogged as open-source prep).
  const { data: adminRow } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("role", "admin")
    .eq("active", true)
    .order("display_name", { ascending: true })
    .limit(1)
    .maybeSingle();
  const adminFirst =
    (adminRow?.display_name as string | undefined)?.split(" ")[0] || "the admin";
  const paidDate = payment?.paid_at
    ? formatNiceDate(String(payment.paid_at).slice(0, 10))
    : null;

  const prepNotes = (turnover.notes as string | null) ?? "";
  const checklistItems = (checklist ?? []) as Item[];
  const inventoryItems = (inventory ?? []) as Item[];
  const feedbackList = (feedback ?? []) as { cleanliness: number | null; note: string | null }[];
  const latestFeedback = feedbackList[0];
  const initialCleanliness = latestFeedback?.cleanliness ?? 0;
  const initialNote = latestFeedback?.note ?? "";

  const isActive = status === "scheduled";

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

        {/* Booking details */}
        <div className="flex flex-col gap-2">
          <div className="text-display">{formatMonthDay(turnover.turnover_date as string)}</div>
          <div className="text-caption text-muted-foreground">
            {formatWeekday(turnover.turnover_date as string)}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {turnover.is_same_day ? (
              <StatusBadge tone="urgent">Same-day</StatusBadge>
            ) : (
              isActive && <StatusBadge tone="neutral">Relaxed</StatusBadge>
            )}
            {status === "completed" && <StatusBadge tone="success">Completed</StatusBadge>}
            {status === "cancelled" && <StatusBadge tone="danger">Cancelled</StatusBadge>}
            {assignee && (
              <CleanerTag name={assignee.display_name} color={assignee.color} withName />
            )}
          </div>
          {isActive && (
            <p className="text-caption text-muted-foreground">
              Arrive 11:30–noon · finish by 4:00
            </p>
          )}
          {turnover.confirmation_code && (
            <p className="text-caption text-muted-foreground">
              Airbnb · {turnover.confirmation_code as string}
            </p>
          )}
          {turnover.source === "manual" && (
            <p className="text-caption text-muted-foreground">
              {creatorName ? `Manually added by ${creatorName}` : "Manually added"}
            </p>
          )}
        </div>

        {/* Prep notes — reads as a paragraph about the turnover, right above the
            claim / start / release actions */}
        <PrepNotes
          turnoverId={turnover.id as string}
          initial={prepNotes}
          canEdit={isAdmin || isAssigned}
        />

        {/* Claim / start / release */}
        {isActive && (isAdmin || !isClaimed || isAssigned) && (
          <div className="flex flex-wrap gap-2">
            {isClaimed && !started && canWork && (
              <StartTurnoverButton turnoverId={turnover.id as string} />
            )}
            <TurnoverActions
              turnoverId={turnover.id as string}
              assigneeId={assignment?.cleaner_id ?? null}
              isAdmin={isAdmin}
              currentUserId={user.id}
              cleaners={cleaners}
            />
          </div>
        )}

        {/* The closeout work appears once started */}
        {isActive && started && canWork && (
          <Card className="flex flex-col gap-6 p-6">
            <h2 className="text-heading">Close out the turnover</h2>
            <CloseoutFlow
              turnoverId={turnover.id as string}
              items={checklistItems}
              initialChecked={checkedItems}
              inventoryItems={inventoryItems}
              initialCleanliness={initialCleanliness}
              initialNote={initialNote}
              existingSupplyNotes={supplyNotes}
            />
          </Card>
        )}

        {/* After completion, the main info is the follow-up notes + payment. */}
        {status === "completed" && assignee && canSeeNotes && (
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

        {status === "completed" && assignee && (isAdmin || isAssigned) && (
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
                  ? `Paid${paymentAmount != null ? ` $${paymentAmount}` : ""} by ${adminFirst} on ${paidDate}.`
                  : "Not paid yet."}
              </p>
            )}
          </Card>
        )}

        {/* Everything captured during the turnover, collapsed by default. The
            assigned cleaner / admin can edit it in place (stays completed). */}
        {status === "completed" && (
          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer text-heading">Turnover details</summary>
            <div className="flex flex-col gap-6 pt-4">
              {canWork ? (
                <CloseoutFlow
                  turnoverId={turnover.id as string}
                  items={checklistItems}
                  initialChecked={checkedItems}
                  inventoryItems={inventoryItems}
                  mode="edit"
                  initialCleanliness={initialCleanliness}
                  initialNote={initialNote}
                  existingSupplyNotes={supplyNotes}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-heading">Guest feedback</h3>
                    <FeedbackList feedback={feedbackList} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-heading">Before you leave</h3>
                    <ItemList items={checklistItems} checked={checkedItems} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-heading">Flagged low</h3>
                    {supplyNotes.length > 0 ? (
                      supplyNotes.map((n) => (
                        <p key={n.id} className="text-body text-foreground">
                          {n.body}
                        </p>
                      ))
                    ) : (
                      <p className="text-caption text-muted-foreground">Nothing flagged.</p>
                    )}
                  </div>
                </>
              )}
              {isAdmin && (
                <div className="border-t border-border pt-4">
                  <ReopenTurnoverButton turnoverId={turnover.id as string} />
                </div>
              )}
            </div>
          </details>
        )}

        {isAdmin && turnover.source === "manual" && (
          <div>
            <DeleteTurnoverButton turnoverId={turnover.id as string} />
          </div>
        )}
      </main>
    </div>
  );
}
