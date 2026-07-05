"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { adminCompleteTurnover } from "@/app/turnover/actions";

/** Admin-only shortcut to mark a past turnover completed for the record, even
 *  with no cleaner assigned — so it drops out of the unclaimed/active filters.
 *  Reversible via "Mark incomplete." */
export function AdminCompleteButton({ turnoverId }: { turnoverId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function complete() {
    startTransition(async () => {
      const result = await adminCompleteTurnover(turnoverId);
      if (result.ok) {
        toast.success("Marked completed");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button size="touch" variant="outline" disabled={pending} onClick={complete}>
      Mark completed
    </Button>
  );
}
