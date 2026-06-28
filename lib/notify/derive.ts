/**
 * Pure notification derivation (spec Section 5.4). Given what changed in a sync
 * — described as a list of turnover changes — and the set of active cleaners,
 * decide who gets told what. No I/O, no database: this is the load-bearing,
 * testable core. The caller persists the result into the notifications outbox
 * (idempotent via `dedupeKey`).
 *
 * Rules (Daniel's matrix):
 *  - new turnover        -> tell every active cleaner a date is open
 *  - cancelled           -> tell the cleaner who had it (quiet if unclaimed)
 *  - date moved          -> tell the prior claimer it moved + reopened; tell
 *                           the other active cleaners a new date is open
 *  - relaxed -> same-day -> high-priority heads-up to the assigned cleaner
 *
 * Reminders and payment notifications are time-/action-driven (not sync-diff
 * driven) and are produced elsewhere.
 */
import { notificationCopy } from "./copy";

export type TurnoverChangeKind =
  | "new"
  | "cancelled"
  | "date_changed"
  | "became_same_day";

export type TurnoverChange = {
  turnoverId: string;
  kind: TurnoverChangeKind;
  /** current (new) turnover date, YYYY-MM-DD */
  date: string;
  /** prior date, for date_changed */
  previousDate?: string | null;
  /** who currently holds / held the turnover, if anyone */
  assigneeId?: string | null;
};

export type PlannedNotification = {
  recipientId: string;
  type: TurnoverChangeKind;
  turnoverId: string;
  title: string;
  body: string;
  /** stable key — a unique index makes re-running a sync a no-op */
  dedupeKey: string;
};

export function deriveNotifications(
  changes: TurnoverChange[],
  activeCleanerIds: string[],
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const seen = new Set<string>();

  const push = (n: PlannedNotification) => {
    if (seen.has(n.dedupeKey)) return; // collapse dupes within one run
    seen.add(n.dedupeKey);
    out.push(n);
  };

  for (const c of changes) {
    switch (c.kind) {
      case "new": {
        const copy = notificationCopy.new(c.date);
        for (const id of activeCleanerIds) {
          push({
            recipientId: id,
            type: "new",
            turnoverId: c.turnoverId,
            title: copy.title,
            body: copy.body,
            dedupeKey: `new:${c.turnoverId}:${id}`,
          });
        }
        break;
      }

      case "cancelled": {
        if (c.assigneeId) {
          const copy = notificationCopy.cancelled(c.date);
          push({
            recipientId: c.assigneeId,
            type: "cancelled",
            turnoverId: c.turnoverId,
            title: copy.title,
            body: copy.body,
            dedupeKey: `cancelled:${c.turnoverId}:${c.assigneeId}`,
          });
        }
        break; // quiet when unclaimed
      }

      case "date_changed": {
        if (c.assigneeId) {
          const copy = notificationCopy.dateChanged(c.previousDate, c.date);
          push({
            recipientId: c.assigneeId,
            type: "date_changed",
            turnoverId: c.turnoverId,
            title: copy.title,
            body: copy.body,
            dedupeKey: `date_changed:${c.turnoverId}:${c.assigneeId}:${c.date}`,
          });
        }
        // The cleaners who didn't hold it just see a fresh open date.
        const open = notificationCopy.new(c.date);
        for (const id of activeCleanerIds) {
          if (id === c.assigneeId) continue; // already told above
          push({
            recipientId: id,
            type: "date_changed",
            turnoverId: c.turnoverId,
            title: open.title,
            body: open.body,
            dedupeKey: `date_changed:${c.turnoverId}:${id}:${c.date}`,
          });
        }
        break;
      }

      case "became_same_day": {
        if (c.assigneeId) {
          const copy = notificationCopy.becameSameDay(c.date);
          push({
            recipientId: c.assigneeId,
            type: "became_same_day",
            turnoverId: c.turnoverId,
            title: copy.title,
            body: copy.body,
            dedupeKey: `became_same_day:${c.turnoverId}:${c.assigneeId}`,
          });
        }
        break;
      }
    }
  }

  return out;
}
