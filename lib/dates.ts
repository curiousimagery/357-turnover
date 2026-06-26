/**
 * Date helpers. Turnover dates are date-only (no time) and interpreted in
 * property-local time (America/Los_Angeles) per the data model. We parse them
 * into a local Date at midnight so display never shifts across a day boundary.
 */
export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const NICE_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });

export function formatMonthDay(iso: string): string {
  return MONTH_DAY.format(parseDateOnly(iso));
}

/** Friendly, unambiguous date for human-facing messages: "Jul 10, 2026".
 *  Use in notification copy; keep raw ISO (YYYY-MM-DD) for dedupe keys + sorting. */
export function formatNiceDate(iso: string): string {
  return NICE_DATE.format(parseDateOnly(iso));
}

export function formatWeekday(iso: string): string {
  return WEEKDAY.format(parseDateOnly(iso));
}

/** Today's date ('YYYY-MM-DD') in property-local time. Same-day math and the
 *  schedule's "upcoming" cutoff must use property time, not the server's UTC. */
export function todayInPropertyTz(
  tz: string = process.env.PROPERTY_TIMEZONE ?? "America/Los_Angeles",
): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "synced 3 min ago" style relative label from minutes elapsed. */
export function formatRelativeMinutes(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
