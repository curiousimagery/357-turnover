"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCleanerNote } from "@/app/turnover/actions";

/** Admin-only: send a private note to the turnover's assigned cleaner. */
export function CleanerNoteForm({
  turnoverId,
  cleanerName,
}: {
  turnoverId: string;
  cleanerName: string;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await addCleanerNote({ turnoverId, note });
      if (result.ok) {
        toast.success(`Note sent to ${cleanerName}`);
        setNote("");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor="cleaner-note">Private note for {cleanerName}</Label>
      <Textarea
        id="cleaner-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="text-body"
        placeholder="e.g. please relock the cleaning closet next time"
      />
      <p className="text-caption text-muted-foreground">
        Only you and {cleanerName} can see this. They&apos;ll get it as a
        notification.
      </p>
      <div className="pt-2">
        <Button type="submit" size="touch" disabled={pending || !note.trim()}>
          {pending ? "Sending…" : "Send note"}
        </Button>
      </div>
    </form>
  );
}
