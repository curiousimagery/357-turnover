"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { savePrepNotes } from "@/app/turnover/actions";

/**
 * Shared prep notes on a turnover — both the admin and the assigned cleaner can
 * edit. Everyone else sees them read-only.
 */
export function PrepNotes({
  turnoverId,
  initial,
  canEdit,
}: {
  turnoverId: string;
  initial: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return initial.trim() ? (
      <p className="whitespace-pre-wrap text-body text-foreground">{initial}</p>
    ) : (
      <p className="text-caption text-muted-foreground">No notes yet.</p>
    );
  }

  function save() {
    startTransition(async () => {
      const result = await savePrepNotes({ turnoverId, notes });
      if (result.ok) {
        toast.success("Notes saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-body"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Early check-in, luggage drop, special requests, anything left behind…"
      />
      <div>
        <Button size="touch" disabled={pending || notes === initial} onClick={save}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  );
}
