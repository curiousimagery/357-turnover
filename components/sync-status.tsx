"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRelativeMinutes } from "@/lib/dates";
import { useSyncNow } from "@/components/use-sync-now";

/**
 * SyncStatus — the "synced N ago" chip (Section 3.4 / 6.3), and also the sync
 * control: tap it to run the sync now (a spinner replaces the label while it
 * runs). Visible staleness keeps a stalled poller obvious; two poll cycles
 * (hourly = 120 min) is the health threshold.
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
  const { syncing, sync } = useSyncNow();

  const current = now ?? new Date();
  const synced = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const minutes = synced
    ? Math.max(0, Math.floor((current.getTime() - synced.getTime()) / 60000))
    : null;

  let dotClass = "bg-success";
  let leading: string | null = null; // always-shown (e.g. "stale · ")
  let main: string; // the relative time, always shown
  let showSynced = true; // the "synced" word — hidden on small screens
  if (minutes === null) {
    dotClass = "bg-danger";
    main = "never synced";
    showSynced = false;
  } else {
    main = formatRelativeMinutes(minutes);
    if (minutes >= STALE_AFTER_MIN) {
      dotClass = "bg-danger";
      leading = "stale · ";
    } else if (minutes >= WARN_AFTER_MIN) {
      dotClass = "bg-warning";
    }
  }

  return (
    <button
      type="button"
      onClick={sync}
      disabled={syncing}
      title="Tap to sync now"
      aria-label="Sync now"
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-border px-2 py-1 text-caption text-muted-foreground transition-colors hover:bg-muted disabled:opacity-100",
        className,
      )}
    >
      {syncing ? (
        <>
          <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
          <span>Syncing…</span>
        </>
      ) : (
        <>
          <span className={cn("h-2 w-2 shrink-0 rounded-md", dotClass)} aria-hidden="true" />
          <span>
            {leading}
            {showSynced && <span className="hidden sm:inline">synced </span>}
            {main}
          </span>
        </>
      )}
    </button>
  );
}
