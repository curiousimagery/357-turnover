"use client";

export type WhoFilter = string; // "everyone" | "mine" | <cleanerId>
export type WhenFilter = "upcoming" | "historic" | "all";
export type StatusFilter = "all" | "claimed" | "unclaimed";

type Cleaner = { id: string; name: string };

const selectClass =
  "h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-caption font-semibold text-foreground";

/**
 * Three independent lenses on the schedule (Section 5.3): Who, When, and Status.
 * One dropdown each, on a single anchored row. Default is everyone / upcoming /
 * all; selections persist (see ScheduleList). Option labels are self-describing
 * so the row needs no separate field labels.
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
    <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
      <select
        aria-label="Who"
        value={who}
        onChange={(e) => onWho(e.target.value)}
        className={selectClass}
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
      <select
        aria-label="When"
        value={when}
        onChange={(e) => onWhen(e.target.value as WhenFilter)}
        className={selectClass}
      >
        <option value="upcoming">Upcoming</option>
        <option value="historic">Past</option>
        <option value="all">Any time</option>
      </select>
      <select
        aria-label="Status"
        value={status}
        onChange={(e) => onStatus(e.target.value as StatusFilter)}
        className={selectClass}
      >
        <option value="all">Any status</option>
        <option value="claimed">Claimed</option>
        <option value="unclaimed">Unclaimed</option>
      </select>
    </div>
  );
}
