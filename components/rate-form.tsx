"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setDefaultRate } from "@/app/cleaners/actions";

/** Admin sets a cleaner's default per-turnover rate. */
export function RateForm({
  cleanerId,
  initial,
}: {
  cleanerId: string;
  initial: number | null;
}) {
  const [rate, setRate] = useState(initial != null ? String(initial) : "");
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const v = rate.trim() === "" ? null : Number(rate);
    if (v != null && (Number.isNaN(v) || v < 0)) {
      toast.error("Enter a valid rate.");
      return;
    }
    startTransition(async () => {
      const result = await setDefaultRate(cleanerId, v);
      if (result.ok) toast.success("Default rate saved");
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={save} className="flex items-end gap-2">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="default-rate">Default rate ($ per turnover)</Label>
        <Input
          id="default-rate"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="h-14 text-body"
          placeholder="120"
        />
      </div>
      <Button type="submit" size="touch" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
