"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { StatusBadge } from "@/components/status-badge";
import {
  addItem,
  updateItem,
  deleteItem,
  setItemActive,
  moveItem,
  seedDefaults,
  type ActionResult,
} from "@/app/checklist/actions";
import type { ListKind } from "@/lib/content/closeout-defaults";

export type EditableItem = {
  id: string;
  name: string;
  description: string;
  helper: string | null;
  active: boolean;
};

export function ItemsEditor({
  list,
  title,
  blurb,
  items,
}: {
  list: ListKind;
  title: string;
  blurb: string;
  items: EditableItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [helper, setHelper] = useState("");

  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  function openAdd() {
    setEditing(null);
    setName("");
    setDescription("");
    setHelper("");
    setDialogOpen(true);
  }

  function openEdit(item: EditableItem) {
    setEditing(item);
    setName(item.name);
    setDescription(item.description);
    setHelper(item.helper ?? "");
    setDialogOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, description, helper };
    startTransition(async () => {
      const result = editing
        ? await updateItem(list, editing.id, payload)
        : await addItem(list, payload);
      if (result.ok) {
        toast.success(editing ? "Item updated" : "Item added");
        setDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">{title}</h2>
          <p className="text-caption text-muted-foreground">{blurb}</p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd} disabled={pending}>
          Add item
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-body text-foreground">This list is empty.</p>
          <Button
            size="touch"
            disabled={pending}
            onClick={() =>
              run(() => seedDefaults(list), "Starter items loaded")
            }
          >
            Load starter items
          </Button>
        </Card>
      ) : (
        <Card className="flex flex-col">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 border-b border-border p-4 last:border-b-0"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-foreground">
                    {item.name}
                  </span>
                  {!item.active && (
                    <StatusBadge tone="neutral">Hidden</StatusBadge>
                  )}
                </div>
                <p className="text-caption text-muted-foreground">
                  {item.description}
                </p>
                {item.helper && (
                  <p className="text-caption text-muted-foreground italic">
                    {item.helper}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Move up"
                  disabled={pending || i === 0}
                  onClick={() => run(() => moveItem(list, item.id, "up"), "Moved")}
                >
                  <ChevronUp />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Move down"
                  disabled={pending || i === items.length - 1}
                  onClick={() =>
                    run(() => moveItem(list, item.id, "down"), "Moved")
                  }
                >
                  <ChevronDown />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => openEdit(item)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setItemActive(list, item.id, !item.active),
                      item.active ? "Hidden" : "Shown",
                    )
                  }
                >
                  {item.active ? "Hide" : "Show"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Delete “${item.name}”?`)) {
                      run(() => deleteItem(list, item.id), "Deleted");
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-heading">
              {editing ? "Edit item" : "Add item"}
            </DialogTitle>
            <DialogDescription className="text-caption">
              Name is bold; description always shows; helper is the smaller hint.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-14 text-body"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-description">Description</Label>
              <Textarea
                id="item-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-body"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-helper">Helper (optional)</Label>
              <Textarea
                id="item-helper"
                value={helper}
                onChange={(e) => setHelper(e.target.value)}
                className="text-body"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="touch"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="touch" disabled={pending || !name}>
                {pending ? "Saving…" : editing ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
