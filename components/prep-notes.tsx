"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { savePrepNotes } from "@/app/turnover/actions";

/**
 * Shared prep notes on a turnover — both the admin and the assigned cleaner can
 * edit. Display-first: the note itself is featured; an "Add note" / "Add to note"
 * button opens an editable field. Everyone else just sees it read-only.
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
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initial);
  const [pending, startTransition] = useTransition();

  const hasNote = initial.trim().length > 0;

  function save() {
    startTransition(async () => {
      const result = await savePrepNotes({ turnoverId, notes });
      if (result.ok) {
        toast.success("Notes saved");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          autoFocus
          className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-body"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Early check-in, luggage drop, special requests…"
        />
        <div className="flex gap-2">
          <Button size="touch" disabled={pending || notes === initial} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="touch"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setNotes(initial);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {hasNote ? (
        <p className="whitespace-pre-wrap text-body text-foreground">{initial}</p>
      ) : (
        !canEdit && <p className="text-body text-muted-foreground">No prep notes.</p>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setNotes(initial);
            setEditing(true);
          }}
          className="inline-flex w-fit items-center gap-1 text-caption font-semibold text-muted-foreground hover:text-foreground"
        >
          {hasNote ? "Add to note" : "Add note"}
        </button>
      )}
    </div>
  );
}
