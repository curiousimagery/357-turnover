"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addGuestFeedback } from "@/app/turnover/actions";

/** Add guest feedback (cleanliness + note) any time — including after a turnover
 *  is complete. Available to the assigned cleaner and the admin. */
export function GuestFeedbackForm({ turnoverId }: { turnoverId: string }) {
  const router = useRouter();
  const [cleanliness, setCleanliness] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await addGuestFeedback({ turnoverId, cleanliness, note });
      if (result.ok) {
        toast.success("Feedback added");
        setNote("");
        setCleanliness(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-caption text-muted-foreground">How clean?</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} of 5`}
              onClick={() => setCleanliness(n)}
            >
              <Star
                className={cn(
                  "size-6",
                  cleanliness != null && n <= cleanliness
                    ? "fill-warning text-warning"
                    : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-body"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Any problem areas, damage, or house-rule concerns?"
      />
      <div>
        <Button size="touch" disabled={pending} onClick={submit}>
          {pending ? "Adding…" : "Add feedback"}
        </Button>
      </div>
    </div>
  );
}
