"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { CleanerTag } from "@/components/cleaner-tag";
import {
  claimTurnover,
  unclaimTurnover,
  assignTurnover,
  unassignTurnover,
  type ActionResult,
} from "@/app/schedule/actions";

type Cleaner = { id: string; name: string; color?: string | null };

/** Claim / release (cleaner) or assign / reassign (admin) on the turnover page.
 *  Mirrors the schedule row controls; refreshes the page on success. */
export function TurnoverActions({
  turnoverId,
  assigneeId,
  isAdmin,
  currentUserId,
  cleaners,
}: {
  turnoverId: string;
  assigneeId: string | null;
  isAdmin: boolean;
  currentUserId: string;
  cleaners: Cleaner[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const open = assigneeId === null;
  const mine = assigneeId === currentUserId;

  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (isAdmin) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="touch" variant={open ? "default" : "outline"} disabled={pending}>
            {open ? "Assign" : "Reassign"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Assign to</DropdownMenuLabel>
          {cleaners.map((c) => (
            <DropdownMenuItem
              key={c.id}
              disabled={c.id === assigneeId}
              onSelect={() => run(() => assignTurnover(turnoverId, c.id), `Assigned to ${c.name}`)}
            >
              <CleanerTag name={c.name} color={c.color} withName />
            </DropdownMenuItem>
          ))}
          {!open && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => run(() => unassignTurnover(turnoverId), "Returned to unclaimed")}
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
        onClick={() => run(() => claimTurnover(turnoverId), "You're on for this turnover")}
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
        onClick={() => run(() => unclaimTurnover(turnoverId), "Released")}
      >
        Release
      </Button>
    );
  }

  return null;
}
