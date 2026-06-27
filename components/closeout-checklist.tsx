"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type Item = { id: string; name: string; description: string; helper: string | null };

/**
 * Interactive "before you leave" checklist: tick items off, then mark complete
 * (with optional guest feedback). Ticks are in-session — a forgiving nudge, not
 * a hard gate; completing with items left prompts a gentle confirm.
 */
export function CloseoutChecklist({
  turnoverId,
  items,
}: {
  turnoverId: string;
  items: Item[];
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [cleanliness, setCleanliness] = useState(0);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const remaining = items.filter((i) => !checked[i.id]).length;

  function toggle(id: string, v: boolean) {
    setChecked((c) => ({ ...c, [id]: v }));
  }

  function openComplete() {
    if (remaining > 0) {
      const ok = window.confirm(
        `${remaining} item${remaining > 1 ? "s" : ""} still unchecked. Mark complete anyway?`,
      );
      if (!ok) return;
    }
    setOpen(true);
  }

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
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          No checklist items set up yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((it) => (
            <div key={it.id} className="flex items-start gap-3">
              <Checkbox
                id={`chk-${it.id}`}
                checked={!!checked[it.id]}
                onCheckedChange={(v) => toggle(it.id, v === true)}
                className="mt-1"
              />
              <Label
                htmlFor={`chk-${it.id}`}
                className="flex cursor-pointer flex-col gap-1"
              >
                <span
                  className={cn(
                    "text-body font-semibold",
                    checked[it.id]
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {it.name}
                </span>
                <span className="text-caption font-normal text-muted-foreground">
                  {it.description}
                </span>
                {it.helper && (
                  <span className="text-caption font-normal italic text-muted-foreground">
                    {it.helper}
                  </span>
                )}
              </Label>
            </div>
          ))}
        </div>
      )}

      <Button size="touch" onClick={openComplete}>
        {remaining > 0 && items.length > 0
          ? `Mark complete · ${remaining} left`
          : "Mark turnover complete"}
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
            <Button type="button" size="touch" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Mark complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
