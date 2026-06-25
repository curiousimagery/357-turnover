"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  markAllRead,
  archiveNotification,
  archiveAll,
} from "@/app/inbox/actions";

export type InboxItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  timeLabel: string;
  readAt: string | null;
  turnoverId: string | null;
};

/**
 * The cleaner/admin inbox. Opening it marks everything read (clearing the
 * badge); items keep a "new" accent for this view. Notifications that point at a
 * turnover link to it on the schedule; users can archive to declutter.
 */
export function InboxList({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [wasUnread] = useState(
    () => new Set(items.filter((i) => !i.readAt).map((i) => i.id)),
  );
  const [filter, setFilter] = useState<"all" | "notes">("all");

  useEffect(() => {
    if (wasUnread.size > 0) {
      markAllRead().then(() => router.refresh());
    }
    // run once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function archive(id: string) {
    startTransition(async () => {
      await archiveNotification(id);
      router.refresh();
    });
  }

  function clearAll() {
    startTransition(async () => {
      await archiveAll();
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col gap-2 p-6">
        <p className="text-body text-foreground">No notifications.</p>
        <p className="text-caption text-muted-foreground">
          New bookings, cancellations, date changes, and reminders show up here.
        </p>
      </Card>
    );
  }

  const shown =
    filter === "notes"
      ? items.filter((i) => i.type === "cleaner_note")
      : items;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={filter === "all" ? "secondary" : "ghost"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "notes" ? "secondary" : "ghost"}
            onClick={() => setFilter("notes")}
          >
            Notes
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={clearAll}
        >
          Clear all
        </Button>
      </div>

      {shown.length === 0 ? (
        <Card className="p-6">
          <p className="text-caption text-muted-foreground">
            {filter === "notes" ? "No notes." : "Nothing here."}
          </p>
        </Card>
      ) : (
        shown.map((item) => {
        const isNew = wasUnread.has(item.id);
        const urgent = item.type === "became_same_day";
        return (
          <Card
            key={item.id}
            className={cn(
              "flex items-start gap-3 p-4",
              isNew && "border-primary",
              urgent && "border-urgent",
            )}
          >
            {isNew && (
              <span
                className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-label="new"
              />
            )}
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-body font-semibold text-foreground">
                  {item.title}
                </span>
                <span className="text-caption text-muted-foreground">
                  {item.timeLabel}
                </span>
              </div>
              <p className="text-caption text-muted-foreground">{item.body}</p>
              {item.turnoverId && (
                <Link
                  href={`/schedule?focus=${item.turnoverId}`}
                  className="text-caption font-semibold text-primary hover:underline"
                >
                  View turnover →
                </Link>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Archive"
              disabled={pending}
              onClick={() => archive(item.id)}
            >
              <X />
            </Button>
          </Card>
          );
        })
      )}
    </div>
  );
}
