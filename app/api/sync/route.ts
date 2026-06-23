import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/sync/reconcile";

/**
 * The sync endpoint. Triggered hourly by Supabase Cron (pg_cron + pg_net) and
 * usable for manual runs. Protected by SYNC_SECRET. Does the Airbnb iCal
 * fetch -> reconcile -> derive, writing as the service role (bypasses RLS).
 * Notifications are intentionally absent here (Phase 3); correctness lives in
 * the schedule, not in delivery.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const bearer = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const qp = new URL(req.url).searchParams.get("secret");
  return bearer === secret || qp === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const icalUrl = process.env.AIRBNB_ICAL_URL;
  if (!icalUrl) {
    return NextResponse.json(
      { error: "AIRBNB_ICAL_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const supabase = createAdminClient();
    const outcome = await runSync(supabase, icalUrl);
    return NextResponse.json(outcome, {
      status: outcome.status === "failed" ? 500 : 200,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "sync error";
    return NextResponse.json({ status: "failed", error }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
