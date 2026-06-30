"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addLinenType,
  deleteLinenType,
  restockHolder,
  updateLinenType,
  type ActionResult,
} from "@/app/linens/actions";
import type { LinenLocation } from "@/lib/linens/derive";

const KIND_LABEL: Record<string, string> = {
  sheet_set: "Sheet set",
  duvet_set: "Duvet set",
};
const bigSelect = "h-14 rounded-md border border-input bg-background px-3 text-body";

export function LinensManager({
  locations,
  isAdmin,
  currentUserId,
}: {
  locations: LinenLocation[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState("sheet_set");
  const [label, setLabel] = useState("");
  const [count, setCount] = useState("1");
  const [editing, setEditing] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>, ok: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(ok);
      else toast.error(result.error);
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addLinenType({ kind, label, count: Number(count) });
      if (result.ok) {
        toast.success("Type added");
        setLabel("");
        setCount("1");
      } else {
        toast.error(result.error);
      }
    });
  }

  // Who currently has linens out, for the restock control.
  const outByHolder = new Map<string, { name: string; items: { label: string; qty: number }[] }>();
  for (const loc of locations) {
    for (const h of loc.holders) {
      const entry = outByHolder.get(h.holderId) ?? { name: h.holderName, items: [] };
      entry.items.push({ label: loc.type.label, qty: h.qty });
      outByHolder.set(h.holderId, entry);
    }
  }
  const holdersOut = [...outByHolder.entries()];

  return (
    <div className="flex flex-col gap-8">
      {isAdmin && (
        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Add a type</h2>
          <form onSubmit={add} className="flex flex-col gap-3">
            <select className={bigSelect} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="sheet_set">Sheet set</option>
              <option value="duvet_set">Duvet set</option>
            </select>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-14 text-body"
              placeholder={
                kind === "duvet_set" ? "Label (e.g. Terracotta linen)" : "Label (e.g. White IKEA queen)"
              }
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="h-14 w-24 text-body"
              />
              <span className="text-caption text-muted-foreground">how many we own</span>
            </div>
            <div>
              <Button type="submit" size="touch" disabled={pending || !label.trim()}>
                Add type
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="flex flex-col">
        {locations.length === 0 ? (
          <p className="p-6 text-caption text-muted-foreground">No linen types yet.</p>
        ) : (
          locations.map((loc, i) => (
            <div key={loc.type.id} className={i > 0 ? "border-t border-border" : ""}>
              {editing === loc.type.id ? (
                <EditRow
                  loc={loc}
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSave={(label, count) =>
                    startTransition(async () => {
                      const result = await updateLinenType(loc.type.id, { label, count });
                      if (result.ok) {
                        toast.success("Saved");
                        setEditing(null);
                      } else {
                        toast.error(result.error);
                      }
                    })
                  }
                  onRemove={() => {
                    if (window.confirm(`Remove “${loc.type.label}”?`)) {
                      run(() => deleteLinenType(loc.type.id), "Removed");
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col">
                      <span className="text-body font-semibold text-foreground">
                        {loc.type.label}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {KIND_LABEL[loc.type.kind]} · {loc.type.count} owned
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 text-caption text-muted-foreground">
                      <span>On beds: {loc.onBeds}</span>
                      <span>
                        With cleaner: {loc.withCleaner}
                        {loc.holders.length > 0 && (
                          <> ({loc.holders.map((h) => `${h.holderName} ${h.qty}`).join(", ")})</>
                        )}
                      </span>
                      <span>Closet: {loc.closet}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setEditing(loc.type.id)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      {holdersOut.length > 0 && (
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-heading">Out to wash</h2>
            <p className="text-caption text-muted-foreground">
              Mark linens returned once they’re back in the closet.
            </p>
          </div>
          {holdersOut.map(([holderId, entry]) => {
            const canReturn = isAdmin || holderId === currentUserId;
            return (
              <div key={holderId} className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-body font-semibold text-foreground">{entry.name}</span>
                  <span className="text-caption text-muted-foreground">
                    {entry.items.map((it) => `${it.qty} ${it.label}`).join(", ")}
                  </span>
                </div>
                {canReturn && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => restockHolder(holderId), "Returned to closet")}
                  >
                    Returned to closet
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/** Inline edit of a type's label + owned count (admin). */
function EditRow({
  loc,
  pending,
  onCancel,
  onSave,
  onRemove,
}: {
  loc: LinenLocation;
  pending: boolean;
  onCancel: () => void;
  onSave: (label: string, count: number) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(loc.type.label);
  const [count, setCount] = useState(String(loc.type.count));

  return (
    <div className="flex flex-col gap-3 p-4">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-12 text-body"
      />
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="h-12 w-24 text-body"
        />
        <span className="text-caption text-muted-foreground">owned</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={pending || !label.trim()}
          onClick={() => onSave(label, Number(count))}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={onRemove}
          className="text-destructive"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
