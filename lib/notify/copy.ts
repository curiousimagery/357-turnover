/**
 * One place for every notification's subject + body (spec Section 5.4).
 *
 * Each entry is a pure builder: given the turnover date (and a couple of extras
 * for some types), it returns the `{ title, body }` that becomes both the in-app
 * inbox row and — when channel is email — the email subject + text. Dates are
 * formatted here (`formatNiceDate`) so callers pass raw `YYYY-MM-DD`.
 *
 * This is the single source of truth: the senders (`derive.ts`,
 * `assignment.ts`, `reminders.ts`), the spoof tool, and the `/test/emails`
 * preview page all read their copy from here. Edit voice + tone in one file.
 * The unit tests pin these strings, so a change here is intentional and visible.
 */
import { formatNiceDate } from "../dates";

export type NotificationCopy = { title: string; body: string };

export const notificationCopy = {
  /** A turnover was newly posted — every active cleaner is told it's claimable. */
  new: (dateIso: string): NotificationCopy => ({
    title: "New turnover available",
    body: `A turnover on ${formatNiceDate(dateIso)} is open to claim.`,
  }),

  /** A turnover reopened (released / unclaimed) — told to the other cleaners. */
  available: (dateIso: string): NotificationCopy => ({
    title: "A turnover is open",
    body: `The turnover on ${formatNiceDate(dateIso)} is open to claim.`,
  }),

  /** Admin assigned a specific cleaner. */
  assigned: (dateIso: string): NotificationCopy => ({
    title: "You've been assigned a turnover",
    body: `You're now on for the turnover on ${formatNiceDate(dateIso)}.`,
  }),

  /** Admin removed a cleaner from a turnover. */
  unassigned: (dateIso: string): NotificationCopy => ({
    title: "You've been taken off a turnover",
    body: `You're no longer assigned the turnover on ${formatNiceDate(dateIso)}.`,
  }),

  /** The date moved on a turnover the recipient had claimed (it reopens). */
  dateChanged: (
    previousDateIso: string | null | undefined,
    dateIso: string,
  ): NotificationCopy => ({
    title: "Turnover date changed",
    body: `Your turnover moved from ${
      previousDateIso ? formatNiceDate(previousDateIso) : "a previous date"
    } to ${formatNiceDate(dateIso)}. It's open to claim again.`,
  }),

  /** A turnover the recipient held was cancelled. */
  cancelled: (dateIso: string): NotificationCopy => ({
    title: "Turnover cancelled",
    body: `Your turnover on ${formatNiceDate(dateIso)} was cancelled.`,
  }),

  /** A relaxed turnover flipped to same-day (a guest checks in that day). */
  becameSameDay: (dateIso: string): NotificationCopy => ({
    title: "Heads up: now a same-day turnover",
    body: `Your turnover on ${formatNiceDate(
      dateIso,
    )} is now same-day — a guest checks in that day, so timing is tight.`,
  }),

  /** The ~2-days-out reminder for a turnover you're on. */
  reminder: (dateIso: string, isSameDay: boolean): NotificationCopy => ({
    title: "Reminder: turnover coming up",
    body: isSameDay
      ? `You're on for ${formatNiceDate(
          dateIso,
        )} — it's a same-day turnover, so timing is tight.`
      : `You're on for ${formatNiceDate(dateIso)}.`,
  }),

  /** A cleaner was paid for a turnover. */
  paymentSent: (dateIso: string, amount: number | null): NotificationCopy => ({
    title: "You've been paid",
    body: `Payment${amount != null ? ` of $${amount}` : ""} sent for the turnover on ${formatNiceDate(
      dateIso,
    )}.`,
  }),

  /** Admin's follow-up note to the assigned cleaner — the body is the note. */
  cleanerNote: (dateIso: string, note: string): NotificationCopy => ({
    title: `Follow-up note from Daniel — ${formatNiceDate(dateIso)} turnover`,
    body: note,
  }),

  /** (Admin) A cleaner released a turnover, so it needs coverage. */
  released: (dateIso: string, releasedByName: string): NotificationCopy => ({
    title: "A turnover needs coverage",
    body: `${releasedByName} released the turnover on ${formatNiceDate(
      dateIso,
    )}. It's back in the unclaimed pool.`,
  }),

  /** (Admin) A turnover was marked complete. */
  completed: (dateIso: string, cleanerName: string): NotificationCopy => ({
    title: "Turnover completed",
    body: `${cleanerName} marked the turnover on ${formatNiceDate(
      dateIso,
    )} complete.`,
  }),
};

/**
 * The footer `send.ts` appends to every *email* (not the in-app inbox). Exposed
 * so the preview page can show exactly what lands in the inbox. Keep in sync with
 * the `text:` template in `sendPendingNotifications`.
 */
export function emailFooter(appUrl: string): string {
  return `\n\nOpen the schedule: ${appUrl}/schedule\n\n—\nAutomated message; this address isn't monitored. Manage everything in the app.`;
}
