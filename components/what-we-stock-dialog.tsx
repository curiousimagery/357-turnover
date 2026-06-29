"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Item = { id: string; name: string; description: string; helper: string | null };

/** A lightweight reference of stocked inventory, behind a link so it's only there
 *  when wanted (e.g. while flagging something low). */
export function WhatWeStockDialog({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <Dialog>
      <DialogTrigger className="text-caption font-semibold text-muted-foreground underline-offset-2 hover:underline">
        What we stock
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-heading">What we stock</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {items.map((it) => (
            <div key={it.id} className="flex flex-col gap-1">
              <span className="text-body">
                <span className="font-semibold text-foreground">{it.name}:</span>{" "}
                <span className="text-foreground">{it.description}</span>
              </span>
              {it.helper && (
                <span className="text-caption text-muted-foreground">{it.helper}</span>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
