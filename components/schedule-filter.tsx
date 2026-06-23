"use client";

import { cn } from "@/lib/utils";

/**
 * ScheduleFilter — All / Mine / Unclaimed segmented control (Section 5.3 / 6.3).
 * The cleaner's primary lens on the schedule. Default is the full list.
 */
export type ScheduleFilterValue = "all" | "mine" | "unclaimed";

const OPTIONS: { value: ScheduleFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "unclaimed", label: "Unclaimed" },
];

export function ScheduleFilter({
  value,
  onValueChange,
  className,
}: {
  value: ScheduleFilterValue;
  onValueChange: (value: ScheduleFilterValue) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter turnovers"
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-caption font-semibold transition-colors",
              selected
                ? "bg-background text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
