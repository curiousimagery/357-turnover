"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteTurnover } from "@/app/turnover/actions";

/** Admin-only: delete a manual turnover (with a confirm). */
export function DeleteTurnoverButton({ turnoverId }: { turnoverId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!window.confirm("Delete this manual turnover? This can't be undone.")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteTurnover(turnoverId);
      if (result.ok) {
        toast.success("Turnover deleted");
        router.push("/schedule");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      size="touch"
      variant="outline"
      disabled={pending}
      onClick={onDelete}
      className="text-danger"
    >
      Delete turnover
    </Button>
  );
}
