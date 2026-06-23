"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createManualTurnover } from "@/app/schedule/actions";
import { todayInPropertyTz } from "@/lib/dates";

/**
 * Admin-only: add a turnover for an off-Airbnb stay (friends / family) that the
 * calendar sync will never produce (Section 5.3 / 5.12). Lives behind a dialog
 * so it stays out of the cleaners' way.
 */
export function ManualTurnoverDialog() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createManualTurnover({ date, notes });
      if (result.ok) {
        toast.success("Manual turnover added");
        setDate("");
        setNotes("");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="touch">
          Add manual turnover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-heading">Manual turnover</DialogTitle>
          <DialogDescription className="text-caption">
            For a stay that isn&apos;t on the Airbnb calendar. It joins the
            schedule like any other and can be claimed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="turnover-date">Turnover date</Label>
            <Input
              id="turnover-date"
              type="date"
              min={todayInPropertyTz()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-14 text-body"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="turnover-notes">Notes (optional)</Label>
            <Textarea
              id="turnover-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. friends staying the weekend"
              className="text-body"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" size="touch">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="touch" disabled={pending || !date}>
              {pending ? "Adding…" : "Add turnover"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
