/**
 * The notification types a user can receive, with friendly labels for the
 * preferences matrix. Keep in sync with the `type` strings the enqueue paths use
 * (lib/notify/*, app/schedule/actions). Default for any type is both channels on.
 */
export const NOTIFICATION_TYPES = [
  { type: "new", label: "New turnover available" },
  { type: "available", label: "A turnover reopened" },
  { type: "assigned", label: "You were assigned a turnover" },
  { type: "unassigned", label: "You were taken off a turnover" },
  { type: "date_changed", label: "A turnover's date changed" },
  { type: "cancelled", label: "A turnover was cancelled" },
  { type: "became_same_day", label: "A turnover became same-day" },
  { type: "reminder", label: "Reminder (2 days before)" },
  { type: "payment_sent", label: "You've been paid" },
  { type: "cleaner_note", label: "Follow-up note from Daniel" },
  { type: "released", label: "A cleaner released a turnover (admin)" },
  { type: "completed", label: "A turnover was completed (admin)" },
] as const;

export type NotificationChannel = "in_app" | "email";
