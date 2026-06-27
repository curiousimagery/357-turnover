"use client";

import { useMemo, useState, useTransition } from "react";
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
  ScheduleFilters,
  type WhoFilter,
  type WhenFilter,
  type StatusFilter,
} from "@/components/schedule-filters";
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
 * The interactive schedule (Section 5.3). Three independent filters — Who /
 * When (incl. historic) / Status — run on the client over the full list. Claim /
 * release / reassign call server actions; the database's unique(turnover_id)
 * constraint is what actually prevents a double-booking.
 */
export function ScheduleList({
  rows,
  currentUserId,
  isAdmin,
  cleaners,
  today,
}: {
  rows: ScheduleRow[];
  currentUserId: string;
  isAdmin: boolean;
  cleaners: Cleaner[];
  today: string;
}) {
  const [who, setWho] = useState<WhoFilter>("everyone");
  const [when, setWhen] = useState<WhenFilter>("upcoming");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (who === "mine" && r.assigneeId !== currentUserId) return false;
        if (who !== "mine" && who !== "everyone" && r.assigneeId !== who) return false;

        if (when === "upcoming" && r.date < today) return false;
        if (when === "historic" && r.date >= today) return false;

        if (status === "claimed" && r.assigneeId === null) return false;
        if (status === "unclaimed" && !(r.assigneeId === null && r.status === "scheduled"))
          return false;

        return true;
      }),
    [rows, who, when, status, currentUserId, today],
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
      <ScheduleFilters
        who={who}
        when={when}
        status={status}
        onWho={setWho}
        onWhen={setWhen}
        onStatus={setStatus}
        cleaners={cleaners}
        isAdmin={isAdmin}
      />

      {visible.length === 0 ? (
        <Card className="flex flex-col gap-2 p-6">
          <p className="text-body text-foreground">Nothing here.</p>
          <p className="text-caption text-muted-foreground">
            No turnovers match these filters.
          </p>
        </Card>
      ) : (
        visible.map((row) => (
          <TurnoverCard
            key={row.id}
            turnover={row}
            href={`/turnover/${row.id}`}
            readOnly={when === "historic"}
            action={
              when === "historic" ? undefined : (
                <RowAction
                  row={row}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  cleaners={cleaners}
                  pending={pending}
                  run={run}
                />
              )
            }
          />
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

  // No claim/reassign affordance once it's done or cancelled.
  if (row.status !== "scheduled") return null;

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
