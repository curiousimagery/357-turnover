import * as React from "react";

import { cn } from "@/lib/utils";
import { formatMonthDay, formatWeekday } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { CleanerTag } from "@/components/cleaner-tag";

export type TurnoverStatus =
  | "scheduled"
  | "claimed"
  | "completed"
  | "cancelled";

export type TurnoverCardData = {
  id: string;
  /** date-only ISO, e.g. "2026-06-25" */
  date: string;
  isSameDay: boolean;
  status: TurnoverStatus;
  source: "airbnb" | "manual";
  assignee?: { name: string; color?: string | null } | null;
};

/**
 * TurnoverCard — the schedule's first-class object (Section 6.3).
 * Same-day is unmistakable; the cleaner tag reads at a glance; the primary
 * action (claim) is one tap and thumb-reachable.
 */
export function TurnoverCard({
  turnover,
  action,
  className,
}: {
  turnover: TurnoverCardData;
  /** Interactive claim/manage control. Falls back to a static Claim button. */
  action?: React.ReactNode;
  className?: string;
}) {
  const { date, isSameDay, status, source, assignee } = turnover;
  const isOpen = status === "scheduled" && !assignee;
  const isActive = status === "scheduled" || status === "claimed";

  return (
    <Card
      className={cn(
        "flex items-start justify-between gap-4 p-4",
        isSameDay && "border-urgent",
        status === "cancelled" && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <div>
          <div className="text-display">{formatMonthDay(date)}</div>
          <div className="text-caption text-muted-foreground">
            {formatWeekday(date)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSameDay ? (
            <StatusBadge tone="urgent">Same-day</StatusBadge>
          ) : (
            isActive && <StatusBadge tone="neutral">Relaxed</StatusBadge>
          )}
          {status === "scheduled" && !assignee && (
            <StatusBadge tone="warning">Unclaimed</StatusBadge>
          )}
          {status === "completed" && (
            <StatusBadge tone="success">Completed</StatusBadge>
          )}
          {status === "cancelled" && (
            <StatusBadge tone="danger">Cancelled</StatusBadge>
          )}
          {source === "manual" && (
            <StatusBadge tone="outline">Manual</StatusBadge>
          )}
        </div>

        {isActive && (
          <p className="text-caption text-muted-foreground">
            Arrive 11:30–noon · finish by 4:00
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {assignee ? (
          <CleanerTag name={assignee.name} color={assignee.color} withName />
        ) : isOpen ? (
          (action ?? (
            <Button size="touch" variant="default">
              Claim
            </Button>
          ))
        ) : null}
      </div>
    </Card>
  );
}
