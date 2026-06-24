/**
 * Persist sync-driven notifications. Called from reconcile inside a try/catch —
 * notifications are a convenience layer and must NEVER break the sync (the
 * schedule is already correct by the time this runs). The outbox's unique
 * dedupe_key makes the insert idempotent across hourly runs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { detectTurnoverChanges, type TurnoverState } from "./changes";
import { deriveNotifications } from "./derive";
import { todayInPropertyTz } from "../dates";

export async function enqueueSyncNotifications(
  supabase: SupabaseClient,
  input: {
    before: TurnoverState[];
    assignments: { turnoverId: string; cleanerId: string }[];
    cancelledBookingIds: string[];
  },
): Promise<number> {
  // AFTER state: the reconciled airbnb turnovers.
  const { data: afterRows } = await supabase
    .from("turnovers")
    .select("id, booking_out_id, turnover_date, is_same_day")
    .not("booking_out_id", "is", null);
  const after: TurnoverState[] = (afterRows ?? []).map((t) => ({
    id: t.id as string,
    bookingOutId: t.booking_out_id as string,
    date: t.turnover_date as string,
    isSameDay: t.is_same_day as boolean,
  }));

  const assigneeByTurnoverId = new Map<string, string | null>(
    input.assignments.map((a) => [a.turnoverId, a.cleanerId]),
  );

  const { changes, releaseTurnoverIds } = detectTurnoverChanges({
    before: input.before,
    after,
    assigneeByTurnoverId,
    cancelledBookingIds: input.cancelledBookingIds,
  });
  if (changes.length === 0) return 0;

  // A moved date frees the claim (availability can't be assumed for the new day).
  if (releaseTurnoverIds.length > 0) {
    await supabase
      .from("turnover_assignments")
      .delete()
      .in("turnover_id", releaseTurnoverIds);
  }

  // Only notify about turnovers today or later — never backfill past dates.
  const today = todayInPropertyTz();
  const futureChanges = changes.filter((c) => c.date >= today);
  if (futureChanges.length === 0) return 0;

  const { data: cleaners } = await supabase
    .from("profiles")
    .select("id")
    .eq("active", true)
    .eq("role", "cleaner");
  const cleanerIds = (cleaners ?? []).map((c) => c.id as string);

  const planned = deriveNotifications(futureChanges, cleanerIds);
  if (planned.length === 0) return 0;

  const rows = planned.map((n) => ({
    recipient_id: n.recipientId,
    type: n.type,
    channel: "email",
    turnover_id: n.turnoverId,
    title: n.title,
    body: n.body,
    status: "pending",
    dedupe_key: n.dedupeKey,
  }));

  await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  return rows.length;
}
