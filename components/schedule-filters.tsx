"use client";

import { cn } from "@/lib/utils";

export type WhoFilter = string; // "everyone" | "mine" | <cleanerId>
export type WhenFilter = "upcoming" | "historic" | "all";
export type StatusFilter = "all" | "claimed" | "unclaimed";

type Cleaner = { id: string; name: string };

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-caption font-semibold transition-colors",
              selected
                ? "bg-background text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Three independent lenses on the schedule (Section 5.3): Who, When, and Status.
 * Default is everyone / upcoming / all — i.e. all upcoming turnovers.
 */
export function ScheduleFilters({
  who,
  when,
  status,
  onWho,
  onWhen,
  onStatus,
  cleaners,
  isAdmin,
}: {
  who: WhoFilter;
  when: WhenFilter;
  status: StatusFilter;
  onWho: (v: WhoFilter) => void;
  onWhen: (v: WhenFilter) => void;
  onStatus: (v: StatusFilter) => void;
  cleaners: Cleaner[];
  isAdmin: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-caption font-semibold text-muted-foreground">Who</span>
        <select
          aria-label="Who"
          value={who}
          onChange={(e) => onWho(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-caption font-semibold"
        >
          <option value="everyone">Everyone</option>
          <option value="mine">Mine</option>
          {isAdmin &&
            cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-caption font-semibold text-muted-foreground">When</span>
        <Segmented
          ariaLabel="When"
          value={when}
          onChange={onWhen}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "historic", label: "Historic" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-caption font-semibold text-muted-foreground">Status</span>
        <Segmented
          ariaLabel="Status"
          value={status}
          onChange={onStatus}
          options={[
            { value: "all", label: "All" },
            { value: "claimed", label: "Claimed" },
            { value: "unclaimed", label: "Unclaimed" },
          ]}
        />
      </div>
    </div>
  );
}
