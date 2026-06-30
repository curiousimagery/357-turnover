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
import type { SupplyNote } from "@/components/supply-notes";
import {
  completeTurnover,
  saveCloseout,
  saveTurnoverLinens,
  setChecklistItem,
} from "@/app/turnover/actions";

type Item = { id: string; name: string; description: string; helper: string | null };
type LinenType = { id: string; kind: string; label: string };
type Holder = { id: string; name: string };
type BedLinen = { bed: number; sheetTypeId: string | null; duvetTypeId: string | null };

const selectClass = "h-12 rounded-md border border-input bg-background px-2 text-body";

/**
 * The whole closeout, flat on the page (no modal): rate the guest, leave
 * feedback, tick the "before you leave" list (persisted), flag anything low.
 * In "complete" mode the button marks the turnover complete (needs ≥1 item
 * ticked + a feedback note). In "edit" mode (a completed turnover) the fields are
 * pre-filled and "Save changes" updates them in place — status stays completed.
 */
export function CloseoutFlow({
  turnoverId,
  items,
  initialChecked,
  inventoryItems,
  mode = "complete",
  initialCleanliness = 0,
  initialNote = "",
  existingSupplyNotes = [],
  linenTypes = [],
  holders = [],
  defaultHolderId = null,
  initialBeds = [],
}: {
  turnoverId: string;
  items: Item[];
  initialChecked: Record<string, boolean>;
  inventoryItems: Item[];
  mode?: "complete" | "edit";
  initialCleanliness?: number;
  initialNote?: string;
  existingSupplyNotes?: SupplyNote[];
  linenTypes?: LinenType[];
  holders?: Holder[];
  defaultHolderId?: string | null;
  initialBeds?: BedLinen[];
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);
  const [cleanliness, setCleanliness] = useState(initialCleanliness);
  const [note, setNote] = useState(initialNote);
  const [supplyNote, setSupplyNote] = useState("");
  const [beds, setBeds] = useState<Record<number, { sheet: string; duvet: string }>>(() => {
    const init: Record<number, { sheet: string; duvet: string }> = {
      1: { sheet: "", duvet: "" },
      2: { sheet: "", duvet: "" },
    };
    for (const b of initialBeds) {
      if (b.bed === 1 || b.bed === 2) {
        init[b.bed] = { sheet: b.sheetTypeId ?? "", duvet: b.duvetTypeId ?? "" };
      }
    }
    return init;
  });
  const [holderId, setHolderId] = useState(defaultHolderId ?? "");
  const [pending, startTransition] = useTransition();

  const isEdit = mode === "edit";
  const checkedCount = items.filter((i) => checked[i.id]).length;
  const ready = checkedCount >= 1 && note.trim().length > 0;
  const nudge =
    "Tick at least one “before you leave” item and add guest feedback before marking complete.";

  const sheetTypes = linenTypes.filter((t) => t.kind === "sheet_set");
  const duvetTypes = linenTypes.filter((t) => t.kind === "duvet_set");
  const hasLinenSelection = [1, 2].some((b) => beds[b].sheet || beds[b].duvet);

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

  function submit() {
    if (!isEdit && !ready) {
      toast.error(nudge);
      return;
    }
    startTransition(async () => {
      const main = isEdit
        ? await saveCloseout({ turnoverId, cleanliness: cleanliness || null, note, supplyNote })
        : await completeTurnover({ turnoverId, cleanliness: cleanliness || null, note, supplyNote });
      if (!main.ok) {
        toast.error(main.error);
        return;
      }
      // Linens are secondary to the completion itself — a failure here is surfaced
      // but doesn't undo the save (matches "the schedule is authoritative").
      if (linenTypes.length > 0 && hasLinenSelection) {
        const lin = await saveTurnoverLinens({
          turnoverId,
          beds: [1, 2].map((bed) => ({
            bed,
            sheetTypeId: beds[bed].sheet || null,
            duvetTypeId: beds[bed].duvet || null,
          })),
          holderId: holderId || null,
        });
        if (!lin.ok) toast.error(`Saved, but linens didn’t record: ${lin.error}`);
      }
      toast.success(isEdit ? "Changes saved" : "Turnover marked complete");
      if (isEdit) setSupplyNote("");
      router.refresh();
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

      {linenTypes.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <Label>Fresh linens on the beds</Label>
            <span className="text-caption text-muted-foreground">
              What you just put on. The set you stripped goes with whoever’s washing.
            </span>
          </div>
          {[1, 2].map((bed) => (
            <div key={bed} className="flex flex-col gap-1">
              <span className="text-caption font-semibold text-foreground">Bed {bed}</span>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={selectClass}
                  value={beds[bed].sheet}
                  onChange={(e) =>
                    setBeds((b) => ({ ...b, [bed]: { ...b[bed], sheet: e.target.value } }))
                  }
                >
                  <option value="">Sheet set…</option>
                  {sheetTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={beds[bed].duvet}
                  onChange={(e) =>
                    setBeds((b) => ({ ...b, [bed]: { ...b[bed], duvet: e.target.value } }))
                  }
                >
                  <option value="">Duvet set…</option>
                  {duvetTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <Label htmlFor="laundry-holder">Who’s taking the laundry to wash?</Label>
            <select
              id="laundry-holder"
              className={selectClass}
              value={holderId}
              onChange={(e) => setHolderId(e.target.value)}
            >
              <option value="">No one / not sure</option>
              {holders.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="running-low">Anything running low?</Label>
          <WhatWeStockDialog items={inventoryItems} />
        </div>
        {existingSupplyNotes.length > 0 && (
          <div className="flex flex-col gap-1">
            {existingSupplyNotes.map((n) => (
              <p key={n.id} className="text-caption text-muted-foreground">
                • {n.body}
              </p>
            ))}
          </div>
        )}
        <Textarea
          id="running-low"
          value={supplyNote}
          onChange={(e) => setSupplyNote(e.target.value)}
          className="text-body"
          placeholder={
            isEdit
              ? "Add another if something else is low…"
              : "e.g. down to one roll of paper towels, almost out of coffee"
          }
        />
        <span className="text-caption text-muted-foreground">
          Added to the inventory list when you {isEdit ? "save" : "mark complete"}.
        </span>
      </div>

      <Button
        size="touch"
        onClick={submit}
        title={isEdit || ready ? undefined : nudge}
        className={cn(!isEdit && !ready && "opacity-60")}
      >
        {pending ? "Saving…" : isEdit ? "Save changes" : "Mark turnover complete"}
      </Button>
    </div>
  );
}
