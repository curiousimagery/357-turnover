import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import {
  TurnoverCard,
  type TurnoverCardData,
} from "@/components/turnover-card";
import { SyncStatus } from "@/components/sync-status";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { todayInPropertyTz } from "@/lib/dates";

export const metadata = { title: "Schedule — Turnover" };

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = todayInPropertyTz();

  const { data: rows, error } = await supabase
    .from("turnovers")
    .select("id, turnover_date, is_same_day, status, source")
    .gte("turnover_date", today)
    .neq("status", "cancelled")
    .order("turnover_date", { ascending: true });

  const { data: syncState } = await supabase
    .from("sync_state")
    .select("last_success_at")
    .eq("id", 1)
    .maybeSingle();

  const cards: TurnoverCardData[] = (rows ?? []).map((t) => ({
    id: t.id,
    date: t.turnover_date,
    isSameDay: t.is_same_day,
    status: t.status as TurnoverCardData["status"],
    source: t.source as TurnoverCardData["source"],
    assignee: null,
  }));

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
            Upcoming turnovers. Same-day ones are flagged.
          </p>
        </div>

        {error ? (
          <Card className="flex flex-col gap-2 p-6">
            <p className="text-body text-foreground">
              The schedule is not set up on this environment yet.
            </p>
            <p className="text-caption text-muted-foreground">
              Once the Phase 1 migration is applied and the first sync runs,
              turnovers appear here automatically.
            </p>
          </Card>
        ) : cards.length === 0 ? (
          <Card className="flex flex-col gap-2 p-6">
            <p className="text-body text-foreground">No upcoming turnovers.</p>
            <p className="text-caption text-muted-foreground">
              When the Airbnb calendar has checkouts ahead, they show up here
              within an hour of being booked.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {cards.map((turnover) => (
              <TurnoverCard key={turnover.id} turnover={turnover} readOnly />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
