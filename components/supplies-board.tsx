"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatNiceDate } from "@/lib/dates";
import {
  addSupplyNote,
  resolveSupplyNote,
  deleteSupplyNote,
} from "@/app/supplies/actions";

export type BoardNote = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
  resolved: boolean;
  turnoverId: string | null;
  turnoverDate: string | null;
};

function Meta({ n }: { n: BoardNote }) {
  return (
    <span className="text-caption text-muted-foreground">
      {n.authorName ?? "Someone"} · {formatNiceDate(n.createdAt.slice(0, 10))}
      {n.turnoverId && n.turnoverDate && (
        <>
          {" · "}
          <Link href={`/turnover/${n.turnoverId}`} className="hover:underline">
            {formatNiceDate(n.turnoverDate)} turnover
          </Link>
        </>
      )}
    </span>
  );
}

/** Admin shopping-list view of every "running low" flag across turnovers: the
 *  open ones up top (with restock + a standalone add), restocked ones below. */
export function SuppliesBoard({ notes }: { notes: BoardNote[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const open = notes.filter((n) => !n.resolved);
  const done = notes.filter((n) => n.resolved);

  function add() {
    startTransition(async () => {
      const result = await addSupplyNote({ turnoverId: null, body });
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

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteSupplyNote(id);
      if (result.ok) {
        toast.success("Removed");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">Running low ({open.length})</h2>
          <p className="text-caption text-muted-foreground">
            Everything flagged by you or a cleaner. Mark restocked once you&apos;ve
            replaced it.
          </p>
        </div>
        {open.length === 0 ? (
          <p className="text-caption text-muted-foreground">
            Nothing flagged — all stocked up.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex flex-col gap-1">
                  <p className="whitespace-pre-wrap text-body text-foreground">{n.body}</p>
                  <Meta n={n} />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => resolve(n.id, true)}
                >
                  Mark restocked
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="text-body"
            placeholder="Add something to restock (not tied to a turnover)…"
            aria-label="Add a supply note"
          />
          <div>
            <Button size="touch" variant="outline" disabled={pending || !body.trim()} onClick={add}>
              Add to supply list
            </Button>
          </div>
        </div>
      </Card>

      {done.length > 0 && (
        <Card className="flex flex-col gap-3 p-6">
          <h2 className="text-heading">Restocked</h2>
          {done.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="whitespace-pre-wrap text-body text-muted-foreground line-through">
                  {n.body}
                </p>
                <Meta n={n} />
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => resolve(n.id, false)}
                >
                  Reopen
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => remove(n.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
