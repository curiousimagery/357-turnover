"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { syncNow } from "@/app/schedule/actions";

/** Shared "run the sync now" behavior for the tappable synced-badge and
 *  pull-to-refresh. `syncing` drives the spinner; `sync()` runs it once. */
export function useSyncNow() {
  const router = useRouter();
  const [syncing, startTransition] = useTransition();

  const sync = useCallback(() => {
    startTransition(async () => {
      const result = await syncNow();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const bits: string[] = [];
      if (result.added) bits.push(`${result.added} new`);
      if (result.changed) bits.push(`${result.changed} updated`);
      if (result.cancelled) bits.push(`${result.cancelled} cancelled`);
      toast.success(
        result.status === "skipped"
          ? "Checked — feed unavailable, no changes"
          : bits.length
            ? `Synced — ${bits.join(", ")}`
            : "Synced — already up to date",
      );
      router.refresh();
    });
  }, [router]);

  return { syncing, sync };
}
