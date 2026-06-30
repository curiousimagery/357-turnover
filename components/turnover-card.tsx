import * as React from "react";
import Link from "next/link";
import { StickyNote } from "lucide-react";

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
  /** Airbnb confirmation code, for cross-reference. Null for manual turnovers. */
  confirmationCode?: string | null;
  /** Admin who added a manual turnover (shown like the reservation code). */
  createdByName?: string | null;
  assignee?: { name: string; color?: string | null } | null;
  /** Has prep notes or guest feedback — shows a small indicator. */
  hasNotes?: boolean;
};

/**
 * TurnoverCard — the schedule's first-class object (Section 6.3).
 * Same-day is unmistakable; the cleaner tag reads at a glance; the action area
 * (claim / release / reassign) is one tap and thumb-reachable.
 */
export function TurnoverCard({
  turnover,
  action,
  readOnly = false,
  href,
  className,
}: {
  turnover: TurnoverCardData;
  /** Interactive control(s): claim, release, or the admin reassign menu. */
  action?: React.ReactNode;
  /** Read-only schedule: no claim affordance. */
  readOnly?: boolean;
  /** If set, the date links here (the turnover detail / closeout page). */
  href?: string;
  className?: string;
}) {
  const { date, isSameDay, status, source, confirmationCode, createdByName, assignee, hasNotes } =
    turnover;
  const isOpen = status === "scheduled" && !assignee;
  const isActive = status === "scheduled" || status === "claimed";
  const cta = !readOnly
    ? (action ?? (isOpen ? <Button size="touch" variant="default">Claim</Button> : null))
    : null;

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
        {href ? (
          <Link href={href} className="hover:underline">
            <div className="text-display">{formatMonthDay(date)}</div>
            <div className="text-caption text-muted-foreground">
              {formatWeekday(date)}
            </div>
          </Link>
        ) : (
          <div>
            <div className="text-display">{formatMonthDay(date)}</div>
            <div className="text-caption text-muted-foreground">
              {formatWeekday(date)}
            </div>
          </div>
        )}

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
          {hasNotes && (
            <span
              className="inline-flex items-center gap-1 text-caption text-muted-foreground"
              title="Has notes or feedback"
            >
              <StickyNote className="size-4" />
              Notes
            </span>
          )}
        </div>

        {isActive && (
          <p className="text-caption text-muted-foreground">
            Arrive 11:30–noon · finish by 4:00
          </p>
        )}

        {confirmationCode && (
          <p className="text-caption text-muted-foreground">
            Airbnb · {confirmationCode}
          </p>
        )}
        {source === "manual" && (
          <p className="text-caption text-muted-foreground">
            {createdByName ? `Manually added by ${createdByName}` : "Manually added"}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
        {assignee && (
          <CleanerTag name={assignee.name} color={assignee.color} withName />
        )}
        {/* Pin the CTA to the bottom-right so it doesn't move when a cleaner tag appears. */}
        {cta && <div className="mt-auto">{cta}</div>}
      </div>
    </Card>
  );
}
