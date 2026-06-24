/**
 * Pure: diff turnover state before vs. after a sync into notification changes.
 * Keeps the DB reads in reconcile and the decision logic here, testable.
 *
 * The Airbnb feed is date-only, so the only things that matter are:
 *  - a turnover whose booking is brand-new            -> "new"
 *  - a turnover whose checkout date moved             -> "date_changed" (+release)
 *  - a turnover that flipped relaxed -> same-day      -> "became_same_day"
 *  - a turnover whose booking was cancelled this run  -> "cancelled"
 * Same-date edits (extra guest, early check-in) never move the date, so they
 * produce no change and the claim stays put.
 */
import type { TurnoverChange } from "./derive";

export type TurnoverState = {
  id: string;
  bookingOutId: string;
  date: string; // turnover_date, YYYY-MM-DD
  isSameDay: boolean;
};

export function detectTurnoverChanges(args: {
  before: TurnoverState[];
  after: TurnoverState[];
  assigneeByTurnoverId: Map<string, string | null>;
  cancelledBookingIds: string[];
}): { changes: TurnoverChange[]; releaseTurnoverIds: string[] } {
  const { before, after, assigneeByTurnoverId } = args;
  const cancelled = new Set(args.cancelledBookingIds);
  const beforeByBooking = new Map(before.map((t) => [t.bookingOutId, t]));

  const changes: TurnoverChange[] = [];
  const releaseTurnoverIds: string[] = [];

  for (const a of after) {
    if (cancelled.has(a.bookingOutId)) continue; // handled as a cancellation below
    const prior = beforeByBooking.get(a.bookingOutId);
    if (!prior) {
      changes.push({
        turnoverId: a.id,
        kind: "new",
        date: a.date,
        assigneeId: null,
      });
      continue;
    }
    const assigneeId = assigneeByTurnoverId.get(prior.id) ?? null;
    if (prior.date !== a.date) {
      changes.push({
        turnoverId: a.id,
        kind: "date_changed",
        date: a.date,
        previousDate: prior.date,
        assigneeId,
      });
      // Can't assume the cleaner is free on the new date — free the turnover.
      if (assigneeId) releaseTurnoverIds.push(a.id);
    } else if (!prior.isSameDay && a.isSameDay) {
      changes.push({
        turnoverId: a.id,
        kind: "became_same_day",
        date: a.date,
        assigneeId,
      });
    }
  }

  for (const b of before) {
    if (!cancelled.has(b.bookingOutId)) continue;
    changes.push({
      turnoverId: b.id,
      kind: "cancelled",
      date: b.date,
      assigneeId: assigneeByTurnoverId.get(b.id) ?? null,
    });
  }

  return { changes, releaseTurnoverIds };
}
