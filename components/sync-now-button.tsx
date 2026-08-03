"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { syncNow } from "@/app/schedule/actions";

/** Manual "check for new bookings now" — any signed-in user can trigger the same
 *  reconcile the hourly cron runs, so a just-made booking shows without waiting. */
export function SyncNowButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await syncNow();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const bits = [];
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
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={run}
      disabled={pending}
      title="Check for new bookings now"
    >
      <RefreshCw className={pending ? "animate-spin" : ""} />
      <span className="hidden sm:inline">{pending ? "Syncing…" : "Sync"}</span>
    </Button>
  );
}
