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
import { WhatWeStockDialog } from "@/components/what-we-stock-dialog";
import { completeTurnover, setChecklistItem } from "@/app/turnover/actions";

type Item = { id: string; name: string; description: string; helper: string | null };

/**
 * The whole closeout, flat on the page (no modal): rate the guest, leave
 * feedback, tick the "before you leave" list (persisted), flag anything low, then
 * mark complete. Complete needs ≥1 checklist item ticked and a feedback note —
 * the button nudges (hover title / tap toast) until both are there.
 */
export function CloseoutFlow({
  turnoverId,
  items,
  initialChecked,
  inventoryItems,
}: {
  turnoverId: string;
  items: Item[];
  initialChecked: Record<string, boolean>;
  inventoryItems: Item[];
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);
  const [cleanliness, setCleanliness] = useState(0);
  const [note, setNote] = useState("");
  const [supplyNote, setSupplyNote] = useState("");
  const [pending, startTransition] = useTransition();

  const checkedCount = items.filter((i) => checked[i.id]).length;
  const ready = checkedCount >= 1 && note.trim().length > 0;
  const nudge =
    "Tick at least one “before you leave” item and add guest feedback before marking complete.";

  function toggle(id: string, v: boolean) {
    setChecked((c) => ({ ...c, [id]: v }));
    startTransition(async () => {
      const result = await setChecklistItem({ turnoverId, itemId: id, checked: v });
      if (!result.ok) {
        setChecked((c) => ({ ...c, [id]: !v }));
        toast.error(result.error);
      }
    });
  }

  function complete() {
    if (!ready) {
      toast.error(nudge);
      return;
    }
    startTransition(async () => {
      const result = await completeTurnover({
        turnoverId,
        cleanliness: cleanliness || null,
        note,
        supplyNote,
      });
      if (result.ok) {
        toast.success("Turnover marked complete");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
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
                  n <= cleanliness ? "fill-warning text-warning" : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="guest-feedback">
          Guest feedback: problem areas, damage, bin sorting, house-rule flags
        </Label>
        <Textarea
          id="guest-feedback"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="text-body"
          placeholder="Anything Daniel should know about how the guest left it?"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-heading">Before you leave</h3>
        {items.length === 0 ? (
          <p className="text-caption text-muted-foreground">No checklist items set up yet.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="flex items-start gap-3">
              <Checkbox
                id={`chk-${it.id}`}
                checked={!!checked[it.id]}
                onCheckedChange={(v) => toggle(it.id, v === true)}
                className="mt-1"
              />
              <Label htmlFor={`chk-${it.id}`} className="flex cursor-pointer flex-col gap-1">
                <span
                  className={`text-body ${
                    checked[it.id] ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  <span className="font-semibold">{it.name}:</span> {it.description}
                </span>
                {it.helper && (
                  <span className="text-caption font-normal text-muted-foreground">
                    {it.helper}
                  </span>
                )}
              </Label>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="running-low">Anything running low?</Label>
          <WhatWeStockDialog items={inventoryItems} />
        </div>
        <Textarea
          id="running-low"
          value={supplyNote}
          onChange={(e) => setSupplyNote(e.target.value)}
          className="text-body"
          placeholder="e.g. down to one roll of paper towels, almost out of coffee"
        />
        <span className="text-caption text-muted-foreground">
          Added to the inventory list when you mark complete.
        </span>
      </div>

      <Button
        size="touch"
        onClick={complete}
        title={ready ? undefined : nudge}
        className={cn(!ready && "opacity-60")}
      >
        {pending ? "Saving…" : "Mark turnover complete"}
      </Button>
    </div>
  );
}
