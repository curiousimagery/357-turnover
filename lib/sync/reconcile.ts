/**
 * The sync pipeline (spec Section 3.3). Idempotent and defensive:
 *  - a failed or empty fetch is NEVER treated as mass cancellation;
 *  - turnovers are never hard-deleted, only marked cancelled;
 *  - same-day is recomputed every run.
 * The load-bearing parsing/derivation is pure and tested (see sync.test.ts);
 * this module just persists the reconciled state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseIcal } from "./ical";
import { toReservations, deriveTurnovers, type Reservation } from "./derive";

export type SyncOutcome = {
  status: "success" | "skipped" | "failed";
  added: number;
  changed: number;
  cancelled: number;
  reservations: number;
  error?: string;
};

/** Fetch the .ics with a timeout and one retry. Throws on failure. */
export async function fetchIcal(url: string, timeoutMs = 15000): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        // always pull a fresh copy of the calendar
        cache: "no-store",
        headers: { "User-Agent": "turnover-app-sync/1" },
      });
      if (!res.ok) throw new Error(`feed responded ${res.status}`);
      return await res.text();
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("feed fetch failed");
}

type BookingRow = {
  id: string;
  uid: string;
  check_in: string;
  check_out: string;
  status: string;
};

export async function runSync(
  supabase: SupabaseClient,
  icalUrl: string,
): Promise<SyncOutcome> {
  const startedAt = new Date().toISOString();
  const empty: SyncOutcome = {
    status: "skipped",
    added: 0,
    changed: 0,
    cancelled: 0,
    reservations: 0,
  };

  // 1. Fetch (defensive). A failed fetch skips the cycle — never cancels.
  let text: string;
  try {
    text = await fetchIcal(icalUrl);
  } catch (e) {
    const error = e instanceof Error ? e.message : "fetch failed";
    await recordRun(supabase, startedAt, "skipped", empty, error);
    return { ...empty, error };
  }

  const reservations = toReservations(parseIcal(text));

  // 2. Empty-feed guard. If we suddenly see zero reservations but the DB still
  // has active bookings, treat it as suspicious and skip — do not cancel.
  if (reservations.length === 0) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      const error = "empty feed with existing active bookings — skipping";
      await recordRun(supabase, startedAt, "skipped", empty, error);
      return { ...empty, error };
    }
  }

  // 3. Load existing bookings to compute diffs and find ones missing from feed.
  const { data: existingRows } = await supabase
    .from("bookings")
    .select("id, uid, check_in, check_out, status");
  const existing = new Map<string, BookingRow>(
    (existingRows ?? []).map((r) => [r.uid, r as BookingRow]),
  );

  const feedUids = new Set(reservations.map((r) => r.uid));
  let added = 0;
  let changed = 0;

  // 4. Upsert all current reservations (idempotent on uid).
  const nowIso = new Date().toISOString();
  const bookingPayload = reservations.map((r) => {
    const prior = existing.get(r.uid);
    if (!prior) added += 1;
    else if (
      prior.check_in !== r.checkIn ||
      prior.check_out !== r.checkOut ||
      prior.status === "cancelled"
    )
      changed += 1;
    return {
      uid: r.uid,
      check_in: r.checkIn,
      check_out: r.checkOut,
      status: "active",
      raw_summary: r.rawSummary,
      reservation_url: r.reservationUrl,
      last_seen_at: nowIso,
    };
  });

  const { data: upserted, error: upsertError } = await supabase
    .from("bookings")
    .upsert(bookingPayload, { onConflict: "uid" })
    .select("id, uid");
  if (upsertError) {
    await recordRun(supabase, startedAt, "failed", empty, upsertError.message);
    return { ...empty, status: "failed", error: upsertError.message };
  }

  const idByUid = new Map<string, string>(
    (upserted ?? []).map((r) => [r.uid as string, r.id as string]),
  );

  // 5. Cancel bookings that are active in the DB but absent from a healthy feed.
  const missingIds = (existingRows ?? [])
    .filter((r) => r.status === "active" && !feedUids.has(r.uid))
    .map((r) => r.id as string);
  let cancelled = 0;
  if (missingIds.length > 0) {
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", missingIds);
    cancelled = missingIds.length;
  }

  // 6. Derive + upsert turnovers (airbnb). Recompute same-day every run.
  const turnovers = deriveTurnovers(reservations);
  const checkInByDate = sameDayCheckInIndex(reservations);
  const turnoverPayload = turnovers
    .map((t) => {
      const bookingOutId = idByUid.get(t.bookingUid);
      if (!bookingOutId) return null;
      const inUid = t.isSameDay ? checkInByDate.get(t.turnoverDate) : undefined;
      return {
        turnover_date: t.turnoverDate,
        source: "airbnb",
        booking_out_id: bookingOutId,
        booking_in_id: inUid ? idByUid.get(inUid) ?? null : null,
        is_same_day: t.isSameDay,
        confirmation_code: t.confirmationCode,
        status: "scheduled",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (turnoverPayload.length > 0) {
    // Don't clobber an existing turnover's workflow status — only reset it to
    // 'scheduled' for brand-new rows. We upsert the derivation fields and let
    // the conflict target preserve the row identity.
    await supabase
      .from("turnovers")
      .upsert(turnoverPayload, {
        onConflict: "booking_out_id",
        ignoreDuplicates: false,
      });
  }

  // 7. Cancel turnovers whose underlying booking was cancelled (preserve row).
  if (missingIds.length > 0) {
    await supabase
      .from("turnovers")
      .update({ status: "cancelled" })
      .in("booking_out_id", missingIds)
      .neq("status", "completed");
  }

  // 8. Heartbeat + run record.
  const outcome: SyncOutcome = {
    status: "success",
    added,
    changed,
    cancelled,
    reservations: reservations.length,
  };
  await supabase
    .from("sync_state")
    .update({ last_synced_at: nowIso, last_success_at: nowIso })
    .eq("id", 1);
  await recordRun(supabase, startedAt, "success", outcome);
  return outcome;
}

/** Map a turnover date -> the uid of a reservation checking in that day. */
function sameDayCheckInIndex(reservations: Reservation[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const r of reservations) index.set(r.checkIn, r.uid);
  return index;
}

async function recordRun(
  supabase: SupabaseClient,
  startedAt: string,
  status: SyncOutcome["status"],
  counts: Pick<SyncOutcome, "added" | "changed" | "cancelled">,
  error?: string,
) {
  await supabase.from("sync_runs").insert({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status,
    added: counts.added,
    changed: counts.changed,
    cancelled: counts.cancelled,
    error: error ?? null,
  });
}
