"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { formatNiceDate } from "@/lib/dates";
import {
  addSupplyNote,
  resolveSupplyNote,
} from "@/app/supplies/actions";

export type SupplyNote = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
  resolved: boolean;
};

/** Turnover-scoped "running low" notes: a list plus an add form. The assigned
 *  cleaner and the admin can add; only the admin can mark restocked. */
export function SupplyNotes({
  turnoverId,
  notes,
  canAdd,
  isAdmin,
}: {
  turnoverId: string;
  notes: SupplyNote[];
  canAdd: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await addSupplyNote({ turnoverId, body });
      if (result.ok) {
        setBody("");
        toast.success("Added to the supply list");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function resolve(id: string, resolved: boolean) {
    startTransition(async () => {
      const result = await resolveSupplyNote(id, resolved);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {notes.length === 0 ? (
        <p className="text-caption text-muted-foreground">Nothing flagged low.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="whitespace-pre-wrap text-body text-foreground">{n.body}</p>
                <span className="text-caption text-muted-foreground">
                  {n.authorName ?? "Someone"} · {formatNiceDate(n.createdAt.slice(0, 10))}
                  {n.resolved && " · restocked"}
                </span>
              </div>
              {n.resolved ? (
                <StatusBadge tone="success">Restocked</StatusBadge>
              ) : (
                isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => resolve(n.id, true)}
                  >
                    Mark restocked
                  </Button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="text-body"
            placeholder="Flag something running low…"
            aria-label="Flag something running low"
          />
          <div>
            <Button size="touch" variant="outline" disabled={pending || !body.trim()} onClick={add}>
              Add to supply list
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
