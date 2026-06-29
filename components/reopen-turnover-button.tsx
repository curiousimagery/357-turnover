"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reopenTurnover } from "@/app/turnover/actions";

/** Reopen a completed turnover for editing (unlocks the closeout again). */
export function ReopenTurnoverButton({ turnoverId }: { turnoverId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function reopen() {
    startTransition(async () => {
      const result = await reopenTurnover(turnoverId);
      if (result.ok) {
        toast.success("Turnover reopened for editing");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={reopen}>
      Edit turnover
    </Button>
  );
}
