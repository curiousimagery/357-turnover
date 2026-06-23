import { cn } from "@/lib/utils";
import { formatRelativeMinutes } from "@/lib/dates";

/**
 * SyncStatus — the "synced N ago" chip (Section 3.4 / 6.3).
 * Visible staleness so a stalled poller is obvious to humans. Two poll cycles
 * (hourly = 120 min) is the health threshold; past it we flag it.
 */
const WARN_AFTER_MIN = 70; // just over one poll cycle
const STALE_AFTER_MIN = 130; // just over two poll cycles

export function SyncStatus({
  lastSyncedAt,
  now,
  className,
}: {
  lastSyncedAt: Date | string | null | undefined;
  now?: Date;
  className?: string;
}) {
  const current = now ?? new Date();
  const synced = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const minutes = synced
    ? Math.max(0, Math.floor((current.getTime() - synced.getTime()) / 60000))
    : null;

  let dotClass = "bg-success";
  let label: string;
  if (minutes === null) {
    dotClass = "bg-danger";
    label = "never synced";
  } else if (minutes >= STALE_AFTER_MIN) {
    dotClass = "bg-danger";
    label = `stale — synced ${formatRelativeMinutes(minutes)}`;
  } else if (minutes >= WARN_AFTER_MIN) {
    dotClass = "bg-warning";
    label = `synced ${formatRelativeMinutes(minutes)}`;
  } else {
    label = `synced ${formatRelativeMinutes(minutes)}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-caption text-muted-foreground",
        className,
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-md", dotClass)} aria-hidden="true" />
      {label}
    </span>
  );
}
