"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reopenTurnover } from "@/app/turnover/actions";

/** Admin-only: flip a completed turnover back to incomplete. (Editing the
 *  details in place doesn't need this — it's only to truly reopen the work.) */
export function ReopenTurnoverButton({ turnoverId }: { turnoverId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function reopen() {
    startTransition(async () => {
      const result = await reopenTurnover(turnoverId);
      if (result.ok) {
        toast.success("Marked incomplete");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={reopen}>
      Mark incomplete
    </Button>
  );
}
