import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import {
  ScheduleList,
  type ScheduleRow,
  type Cleaner,
} from "@/components/schedule-list";
import { ManualTurnoverDialog } from "@/components/manual-turnover-dialog";
import { SyncStatus } from "@/components/sync-status";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { todayInPropertyTz } from "@/lib/dates";
import type { TurnoverCardData } from "@/components/turnover-card";

export const metadata = { title: "Schedule — 357 Oasis Turnovers" };

type RawProfile = { id: string; display_name: string; color: string | null };
type RawAssignment = { cleaner_id: string; profiles: RawProfile | RawProfile[] | null };
type RawRow = {
  id: string;
  turnover_date: string;
  is_same_day: boolean;
  status: TurnoverCardData["status"];
  source: TurnoverCardData["source"];
  confirmation_code: string | null;
  notes: string | null;
  // PostgREST returns this as a single object (the unique(turnover_id)
  // constraint makes it a one-to-one), but be defensive about array too.
  turnover_assignments: RawAssignment | RawAssignment[] | null;
};

/** First element of a PostgREST embed, whether it came back as an object
 *  (to-one) or an array (to-many). */
function firstEmbed<T>(embed: T | T[] | null | undefined): T | null {
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed ?? null;
}

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = todayInPropertyTz();

  const [
    { data: profile },
    { data: rows, error },
    { data: feedbackRows },
    { data: syncState },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase
      .from("turnovers")
      .select(
        "id, turnover_date, is_same_day, status, source, confirmation_code, notes, turnover_assignments ( cleaner_id, profiles ( id, display_name, color ) )",
      )
      .neq("status", "cancelled")
      .order("turnover_date", { ascending: true }),
    supabase.from("guest_feedback").select("turnover_id"),
    supabase.from("sync_state").select("last_success_at").eq("id", 1).maybeSingle(),
  ]);

  const isAdmin = profile?.role === "admin";

  const feedbackSet = new Set(
    (feedbackRows ?? []).map((f) => f.turnover_id as string),
  );

  const { data: cleanerRows } = await supabase
    .from("profiles")
    .select("id, display_name, color")
    .eq("active", true)
    .order("display_name", { ascending: true });

  const cleaners: Cleaner[] = (cleanerRows ?? []).map((c) => ({
    id: c.id,
    name: c.display_name,
    color: c.color,
  }));

  const scheduleRows: ScheduleRow[] = ((rows ?? []) as unknown as RawRow[]).map(
    (t) => {
      const assignment = firstEmbed(t.turnover_assignments);
      const assignee = firstEmbed(assignment?.profiles);
      return {
        id: t.id,
        date: t.turnover_date,
        isSameDay: t.is_same_day,
        status: t.status,
        source: t.source,
        confirmationCode: t.confirmation_code,
        hasNotes: !!t.notes?.trim() || feedbackSet.has(t.id),
        assignee: assignee
          ? { name: assignee.display_name, color: assignee.color }
          : null,
        assigneeId: assignee?.id ?? null,
      };
    },
  );

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-display">Schedule</h1>
            {!error && (
              <SyncStatus lastSyncedAt={syncState?.last_success_at ?? null} />
            )}
          </div>
          <p className="text-body text-muted-foreground">
            Filter by who, when, and status. Same-day turnovers are flagged.
          </p>
          {isAdmin && (
            <div className="pt-2">
              <ManualTurnoverDialog />
            </div>
          )}
        </div>

        {error ? (
          <Card className="flex flex-col gap-2 p-6">
            <p className="text-body text-foreground">
              The schedule is not set up on this environment yet.
            </p>
            <p className="text-caption text-muted-foreground">
              Once the migrations are applied and the first sync runs, turnovers
              appear here automatically.
            </p>
          </Card>
        ) : (
          <ScheduleList
            rows={scheduleRows}
            currentUserId={user.id}
            isAdmin={isAdmin}
            cleaners={cleaners}
            today={today}
          />
        )}
      </main>
    </div>
  );
}
