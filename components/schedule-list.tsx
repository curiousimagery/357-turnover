"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { TurnoverCard, type TurnoverCardData } from "@/components/turnover-card";
import {
  ScheduleFilter,
  type ScheduleFilterValue,
} from "@/components/schedule-filter";
import { CleanerTag } from "@/components/cleaner-tag";
import { todayInPropertyTz } from "@/lib/dates";
import {
  claimTurnover,
  unclaimTurnover,
  assignTurnover,
  unassignTurnover,
  type ActionResult,
} from "@/app/schedule/actions";

export type ScheduleRow = TurnoverCardData & { assigneeId: string | null };
export type Cleaner = { id: string; name: string; color?: string | null };

/**
 * The interactive schedule (Section 5.3). Filtering happens on the client over
 * the full list; claim / release / reassign call server actions, and the
 * database's unique(turnover_id) constraint is what actually prevents a
 * double-booking — the UI just reports the result.
 */
export function ScheduleList({
  rows,
  currentUserId,
  isAdmin,
  cleaners,
  focusId,
}: {
  rows: ScheduleRow[];
  currentUserId: string;
  isAdmin: boolean;
  cleaners: Cleaner[];
  focusId?: string | null;
}) {
  const [filter, setFilter] = useState<ScheduleFilterValue>("all");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`turnover-${focusId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId]);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (filter === "mine") return r.assigneeId === currentUserId;
        if (filter === "unclaimed")
          return r.assigneeId === null && r.status === "scheduled";
        return true;
      }),
    [rows, filter, currentUserId],
  );

  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ScheduleFilter value={filter} onValueChange={setFilter} />

      {visible.length === 0 ? (
        <Card className="flex flex-col gap-2 p-6">
          <p className="text-body text-foreground">Nothing here.</p>
          <p className="text-caption text-muted-foreground">
            {filter === "mine"
              ? "You haven't claimed any upcoming turnovers yet."
              : filter === "unclaimed"
                ? "Every upcoming turnover is claimed."
                : "No upcoming turnovers."}
          </p>
        </Card>
      ) : (
        visible.map((row) => (
          <div key={row.id} id={`turnover-${row.id}`}>
            <TurnoverCard
              turnover={row}
              className={row.id === focusId ? "ring-2 ring-primary" : undefined}
              action={
                <RowAction
                  row={row}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  cleaners={cleaners}
                  pending={pending}
                  run={run}
                />
              }
            />
          </div>
        ))
      )}
    </div>
  );
}

function RowAction({
  row,
  currentUserId,
  isAdmin,
  cleaners,
  pending,
  run,
}: {
  row: ScheduleRow;
  currentUserId: string;
  isAdmin: boolean;
  cleaners: Cleaner[];
  pending: boolean;
  run: (action: () => Promise<ActionResult>, success: string) => void;
}) {
  const open = row.assigneeId === null && row.status === "scheduled";
  const mine = row.assigneeId === currentUserId;

  if (isAdmin) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="touch"
            variant={open ? "default" : "outline"}
            disabled={pending}
          >
            {open ? "Assign" : "Reassign"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Assign to</DropdownMenuLabel>
          {cleaners.map((c) => (
            <DropdownMenuItem
              key={c.id}
              disabled={c.id === row.assigneeId}
              onSelect={() =>
                run(
                  () => assignTurnover(row.id, c.id),
                  `${formatDate(row.date)} → ${c.name}`,
                )
              }
            >
              <CleanerTag name={c.name} color={c.color} withName />
            </DropdownMenuItem>
          ))}
          {!open && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  run(() => unassignTurnover(row.id), "Returned to unclaimed")
                }
              >
                Make unclaimed
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (open) {
    return (
      <Button
        size="touch"
        disabled={pending}
        onClick={() =>
          run(
            () => claimTurnover(row.id),
            `You're on for ${formatDate(row.date)}`,
          )
        }
      >
        Claim
      </Button>
    );
  }

  if (mine) {
    return (
      <Button
        size="touch"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (isSoon(row.date)) {
            const ok = window.confirm(
              `This turnover is ${soonLabel(row.date)}. Release it so someone else can pick it up?`,
            );
            if (!ok) return;
          }
          run(() => unclaimTurnover(row.id), "Released");
        }}
      >
        Release
      </Button>
    );
  }

  // Claimed by someone else — the cleaner tag already tells the story.
  return null;
}

function daysUntil(dateIso: string): number {
  const today = new Date(`${todayInPropertyTz()}T00:00:00`);
  const target = new Date(`${dateIso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function isSoon(dateIso: string): boolean {
  return daysUntil(dateIso) <= 2;
}

function soonLabel(dateIso: string): string {
  const d = daysUntil(dateIso);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

function formatDate(dateIso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateIso}T00:00:00`));
}
