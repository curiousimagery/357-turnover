"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startTurnover } from "@/app/turnover/actions";

/** Primary CTA once a turnover is claimed: begin the work, which reveals the
 *  closeout flow. */
export function StartTurnoverButton({ turnoverId }: { turnoverId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startTurnover(turnoverId);
      if (result.ok) {
        toast.success("Turnover started");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button size="touch" disabled={pending} onClick={start}>
      {pending ? "Starting…" : "Start turnover"}
    </Button>
  );
}
