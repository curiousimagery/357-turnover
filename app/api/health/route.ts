import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public health check for an external uptime watcher (Section 3.4). Reports
 * whether a sync succeeded recently. Returns 503 when the last success is stale
 * or the DB is unreachable, so a monitor pinging this URL alerts on a stuck
 * poller — the failure mode that would silently drop turnovers.
 */
const STALE_MINUTES = 180; // hourly cron; allow ~2 missed runs before alarming

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("sync_state")
      .select("last_success_at, last_synced_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const lastSuccess = data?.last_success_at
      ? new Date(data.last_success_at)
      : null;
    const ageMinutes = lastSuccess
      ? Math.floor((Date.now() - lastSuccess.getTime()) / 60000)
      : null;
    const ok = ageMinutes !== null && ageMinutes <= STALE_MINUTES;

    return NextResponse.json(
      {
        ok,
        lastSuccessAt: data?.last_success_at ?? null,
        lastSyncedAt: data?.last_synced_at ?? null,
        ageMinutes,
        staleThresholdMinutes: STALE_MINUTES,
      },
      { status: ok ? 200 : 503 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "health error" },
      { status: 503 },
    );
  }
}
