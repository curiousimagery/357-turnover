"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { markAllRead } from "@/app/inbox/actions";

export type InboxItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  timeLabel: string;
  readAt: string | null;
};

/**
 * The cleaner's notification inbox. Opening it marks everything read (clearing
 * the header badge); the items that were new in *this* view keep an accent so
 * you can still see what arrived.
 */
export function InboxList({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  // Snapshot what was unread on first render — survives the refresh below.
  const [wasUnread] = useState(
    () => new Set(items.filter((i) => !i.readAt).map((i) => i.id)),
  );

  useEffect(() => {
    if (wasUnread.size > 0) {
      markAllRead().then(() => router.refresh());
    }
    // run once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) {
    return (
      <Card className="flex flex-col gap-2 p-6">
        <p className="text-body text-foreground">No notifications yet.</p>
        <p className="text-caption text-muted-foreground">
          New bookings, cancellations, date changes, and reminders show up here.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
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
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-body font-semibold text-foreground">
                  {item.title}
                </span>
                <span className="text-caption text-muted-foreground">
                  {item.timeLabel}
                </span>
              </div>
              <p className="text-caption text-muted-foreground">{item.body}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
