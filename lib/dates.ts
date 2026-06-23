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
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });

export function formatMonthDay(iso: string): string {
  return MONTH_DAY.format(parseDateOnly(iso));
}

export function formatWeekday(iso: string): string {
  return WEEKDAY.format(parseDateOnly(iso));
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
