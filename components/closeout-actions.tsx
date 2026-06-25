"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { completeTurnover } from "@/app/turnover/actions";

/** Mark a turnover complete with optional guest feedback (5-star + note). */
export function CloseoutActions({ turnoverId }: { turnoverId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cleanliness, setCleanliness] = useState(0);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await completeTurnover({
        turnoverId,
        cleanliness: cleanliness || null,
        note,
      });
      if (result.ok) {
        toast.success("Turnover marked complete");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <Button size="touch" onClick={() => setOpen(true)}>
        Mark turnover complete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-heading">Mark complete</DialogTitle>
            <DialogDescription className="text-caption">
              A little guest feedback helps Daniel rate the guest. Both fields are
              optional.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label>How clean did the guest leave it?</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => setCleanliness(n)}
                    className="p-1"
                  >
                    <Star
                      className={cn(
                        "size-8",
                        n <= cleanliness
                          ? "fill-warning text-warning"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback-note">
                Notes — problem areas, damage, bin sorting, house-rule flags
              </Label>
              <Textarea
                id="feedback-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-body"
                placeholder="Anything Daniel should know about how the guest left it?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="touch"
              disabled={pending}
              onClick={submit}
            >
              {pending ? "Saving…" : "Mark complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
