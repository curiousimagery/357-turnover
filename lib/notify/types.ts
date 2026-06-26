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

/**
 * Preference categories shown in settings. Many notification `type`s share one
 * intent ("there's a turnover to claim" / "something changed on one you're on"),
 * so we group them: one toggle per category fans out to its member types. The
 * message copy stays specific per type; only the *controls* consolidate.
 * `adminOnly` categories are hidden from cleaners.
 */
export type NotificationCategory = {
  key: string;
  label: string;
  description: string;
  types: string[];
  adminOnly: boolean;
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "claimable",
    label: "Turnovers open to claim",
    description: "A new turnover, a reopened one, or a date that moved.",
    types: ["new", "available", "date_changed"],
    adminOnly: false,
  },
  {
    key: "my_turnover",
    label: "Changes to a turnover you're on",
    description: "You were assigned or removed, it was cancelled, or it became same-day.",
    types: ["assigned", "unassigned", "cancelled", "became_same_day"],
    adminOnly: false,
  },
  {
    key: "reminders",
    label: "Reminders (2 days before)",
    description: "A heads-up before a turnover you're on.",
    types: ["reminder"],
    adminOnly: false,
  },
  {
    key: "notes",
    label: "Follow-up notes from Daniel",
    description: "A note about a turnover after it's done.",
    types: ["cleaner_note"],
    adminOnly: false,
  },
  {
    key: "payments",
    label: "Payments",
    description: "When you've been paid for a turnover.",
    types: ["payment_sent"],
    adminOnly: false,
  },
  {
    key: "coverage",
    label: "Coverage & completion",
    description: "When a cleaner releases a turnover or marks one complete.",
    types: ["released", "completed"],
    adminOnly: true,
  },
];
