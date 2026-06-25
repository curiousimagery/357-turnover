"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addLinenSet,
  deleteLinenSet,
  updateLinen,
  type ActionResult,
} from "@/app/linens/actions";

export type LinenSet = {
  id: string;
  kind: string;
  label: string;
  color: string | null;
  brand: string | null;
  state: string;
  heldById: string | null;
};
type Cleaner = { id: string; name: string };

const STATES = [
  { value: "on_beds", label: "On beds" },
  { value: "clean_backup", label: "Clean backup" },
  { value: "with_cleaner", label: "With cleaner" },
  { value: "in_wash", label: "In wash" },
];
const KIND_LABEL: Record<string, string> = {
  sheet_set: "Sheet set",
  duvet_set: "Duvet set",
};
const LOW_STOCK = 2;
const smallSelect =
  "h-10 rounded-md border border-input bg-background px-2 text-caption";
const bigSelect =
  "h-14 rounded-md border border-input bg-background px-3 text-body";

export function LinensManager({
  sets,
  cleaners,
  isAdmin,
}: {
  sets: LinenSet[];
  cleaners: Cleaner[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState("sheet_set");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");

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
      const result = await addLinenSet({ kind, label, color, brand });
      if (result.ok) {
        toast.success("Set added");
        setLabel("");
        setColor("");
        setBrand("");
      } else {
        toast.error(result.error);
      }
    });
  }

  const warnings = (["sheet_set", "duvet_set"] as const)
    .map((k) => {
      const backups = sets.filter(
        (s) => s.kind === k && s.state === "clean_backup",
      ).length;
      return backups < LOW_STOCK
        ? `Only ${backups} clean ${KIND_LABEL[k].toLowerCase()} backup${backups === 1 ? "" : "s"} left.`
        : null;
    })
    .filter((w): w is string => !!w);

  return (
    <div className="flex flex-col gap-8">
      {warnings.length > 0 && (
        <Card className="flex flex-col gap-1 border-warning p-4">
          {warnings.map((w, i) => (
            <p key={i} className="text-body text-foreground">
              ⚠️ {w}
            </p>
          ))}
        </Card>
      )}

      {isAdmin && (
        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Add a set</h2>
          <form onSubmit={add} className="flex flex-col gap-3">
            <select
              className={bigSelect}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="sheet_set">Sheet set</option>
              <option value="duvet_set">Duvet set</option>
            </select>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-14 text-body"
              placeholder="Label (e.g. White #1)"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-14 text-body"
              placeholder="Color (optional)"
            />
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-14 text-body"
              placeholder="Brand (optional)"
            />
            <div>
              <Button
                type="submit"
                size="touch"
                disabled={pending || !label.trim()}
              >
                Add set
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="flex flex-col">
        {sets.length === 0 ? (
          <p className="p-6 text-caption text-muted-foreground">
            No linen sets yet.
          </p>
        ) : (
          sets.map((s, i) => (
            <div
              key={s.id}
              className={i > 0 ? "border-t border-border" : ""}
            >
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-body font-semibold text-foreground">
                      {s.label}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {KIND_LABEL[s.kind]}
                      {s.color ? ` · ${s.color}` : ""}
                      {s.brand ? ` · ${s.brand}` : ""}
                    </span>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Remove “${s.label}”?`)) {
                          run(() => deleteLinenSet(s.id), "Removed");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={smallSelect}
                    value={s.state}
                    disabled={pending}
                    onChange={(e) =>
                      run(
                        () =>
                          updateLinen(s.id, {
                            state: e.target.value,
                            heldBy: s.heldById,
                          }),
                        "Updated",
                      )
                    }
                  >
                    {STATES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                  {(s.state === "with_cleaner" || s.state === "in_wash") && (
                    <select
                      className={smallSelect}
                      value={s.heldById ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        run(
                          () =>
                            updateLinen(s.id, {
                              state: s.state,
                              heldBy: e.target.value || null,
                            }),
                          "Updated",
                        )
                      }
                    >
                      <option value="">— holder —</option>
                      {cleaners.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
