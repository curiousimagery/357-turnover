"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPendingNotifications, senderConfigFromEnv } from "@/lib/notify/send";
import { deriveNotifications, type TurnoverChange } from "@/lib/notify/derive";
import { todayInPropertyTz } from "@/lib/dates";

/** Marker stored in a spoof turnover's notes so the tool can find + clean them
 *  up. Distinctive enough that a real manual turnover won't collide. */
const SPOOF_MARKER = "[SPOOF-TEST]";

/**
 * Admin test harness (no real Airbnb feed touched): drop a sample notification
 * of any type into someone's inbox to verify delivery, content, the deep link,
 * and email — and a "send emails now" button so you don't wait for the hourly
 * drain. The notification diff logic itself is covered by unit tests.
 */
export type TestResult =
  | { ok: true; sent?: number; failed?: number; summary?: string }
  | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Please sign in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false as const, error: "Admins only." };
  }
  return { ok: true as const, supabase };
}

function sample(type: string, date: string): { title: string; body: string } {
  switch (type) {
    case "new":
      return { title: "New turnover available", body: `A turnover on ${date} is open to claim.` };
    case "available":
      return { title: "A turnover is open", body: `The turnover on ${date} is open to claim.` };
    case "assigned":
      return { title: "You've been assigned a turnover", body: `You're now on for the turnover on ${date}.` };
    case "unassigned":
      return { title: "You've been taken off a turnover", body: `You're no longer assigned the turnover on ${date}.` };
    case "date_changed":
      return { title: "Turnover date changed", body: `Your turnover moved to ${date}. It's open to claim again.` };
    case "cancelled":
      return { title: "Turnover cancelled", body: `Your turnover on ${date} was cancelled.` };
    case "became_same_day":
      return { title: "Heads up: now a same-day turnover", body: `Your turnover on ${date} is now same-day.` };
    case "reminder":
      return { title: "Reminder: turnover coming up", body: `You're on for ${date}.` };
    case "cleaner_note":
      return { title: "A note from Daniel", body: `A test note about the turnover on ${date}.` };
    case "released":
      return { title: "A turnover needs coverage", body: `A cleaner released the turnover on ${date}.` };
    default:
      return { title: "Test notification", body: `A test for ${date}.` };
  }
}

export async function sendTestNotification(input: {
  type: string;
  recipientId: string;
}): Promise<TestResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (!input.recipientId) return { ok: false, error: "Pick a recipient." };

  // Use the soonest real upcoming turnover so the "View turnover" link works.
  const { data: t } = await gate.supabase
    .from("turnovers")
    .select("id, turnover_date")
    .gte("turnover_date", todayInPropertyTz())
    .neq("status", "cancelled")
    .order("turnover_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  const date = (t?.turnover_date as string | undefined) ?? "an upcoming date";

  const s = sample(input.type, date);
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    recipient_id: input.recipientId,
    type: input.type,
    channel: "email",
    turnover_id: (t?.id as string | undefined) ?? null,
    title: s.title,
    body: s.body,
    status: "pending",
    dedupe_key: `test:${input.type}:${input.recipientId}:${Date.now()}`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function drainEmailsNow(): Promise<TestResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const config = senderConfigFromEnv();
  if (!config) {
    return { ok: false, error: "Resend isn't configured (set RESEND_API_KEY)." };
  }
  const result = await sendPendingNotifications(createAdminClient(), config);
  return { ok: true, sent: result.sent, failed: result.failed };
}

/** A YYYY-MM-DD date `daysAhead` from today in property-local time. */
function futureDate(daysAhead: number): string {
  const [y, m, d] = todayInPropertyTz().split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + daysAhead);
  return dt.toISOString().slice(0, 10);
}

/** Create a clearly-marked spoof turnover (source 'manual' so the real sync never
 *  touches it). Returns its id. */
async function createSpoofTurnover(
  admin: SupabaseClient,
  args: { date: string; isSameDay?: boolean },
): Promise<string> {
  const { data, error } = await admin
    .from("turnovers")
    .insert({
      turnover_date: args.date,
      source: "manual",
      status: "scheduled",
      is_same_day: args.isSameDay ?? false,
      notes: `${SPOOF_MARKER} simulated turnover from the test tool — safe to clean up`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Simulate a calendar-driven change end to end: create a real (spoof) turnover in
 * the right state, then fire the REAL notification derivation — so you see the
 * real copy, the real recipient fan-out, and a working deep link, exactly as the
 * hourly sync would produce them. Clean up after with `cleanupSpoofTurnovers`.
 */
export async function simulateScenario(input: {
  scenario: "new" | "date_changed" | "cancelled" | "became_same_day";
  cleanerId?: string;
}): Promise<TestResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();

  const { data: cleaners } = await admin
    .from("profiles")
    .select("id")
    .eq("active", true)
    .eq("role", "cleaner");
  const cleanerIds = (cleaners ?? []).map((c) => c.id as string);

  const date = futureDate(30);
  let change: TurnoverChange;
  let summary: string;

  try {
    switch (input.scenario) {
      case "new": {
        const turnoverId = await createSpoofTurnover(admin, { date });
        change = { turnoverId, kind: "new", date, assigneeId: null };
        summary = `Posted a spoof turnover on ${date}.`;
        break;
      }
      case "date_changed": {
        const cleanerId = input.cleanerId;
        if (!cleanerId) return { ok: false, error: "Pick the cleaner who's on this turnover first." };
        const turnoverId = await createSpoofTurnover(admin, { date });
        await admin
          .from("turnover_assignments")
          .insert({ turnover_id: turnoverId, cleaner_id: cleanerId });
        change = {
          turnoverId,
          kind: "date_changed",
          date,
          previousDate: futureDate(23),
          assigneeId: cleanerId,
        };
        // A moved date frees the claim, exactly like the real sync.
        await admin.from("turnover_assignments").delete().eq("turnover_id", turnoverId);
        summary = `Moved a claimed spoof turnover to ${date} and reopened it.`;
        break;
      }
      case "cancelled": {
        const cleanerId = input.cleanerId;
        if (!cleanerId) return { ok: false, error: "Pick the cleaner who's on this turnover first." };
        const turnoverId = await createSpoofTurnover(admin, { date });
        await admin
          .from("turnover_assignments")
          .insert({ turnover_id: turnoverId, cleaner_id: cleanerId });
        await admin.from("turnovers").update({ status: "cancelled" }).eq("id", turnoverId);
        change = { turnoverId, kind: "cancelled", date, assigneeId: cleanerId };
        summary = `Cancelled a claimed spoof turnover on ${date}.`;
        break;
      }
      case "became_same_day": {
        const cleanerId = input.cleanerId;
        if (!cleanerId) return { ok: false, error: "Pick the cleaner who's on this turnover first." };
        const turnoverId = await createSpoofTurnover(admin, { date, isSameDay: true });
        await admin
          .from("turnover_assignments")
          .insert({ turnover_id: turnoverId, cleaner_id: cleanerId });
        change = { turnoverId, kind: "became_same_day", date, assigneeId: cleanerId };
        summary = `Flipped a claimed spoof turnover on ${date} to same-day.`;
        break;
      }
      default:
        return { ok: false, error: "Unknown scenario." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Scenario failed." };
  }

  const planned = deriveNotifications([change], cleanerIds);
  if (planned.length > 0) {
    const { error } = await admin.from("notifications").insert(
      planned.map((n) => ({
        recipient_id: n.recipientId,
        type: n.type,
        channel: "email",
        turnover_id: n.turnoverId,
        title: n.title,
        body: n.body,
        status: "pending",
        dedupe_key: n.dedupeKey,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, summary: `${summary} Sent ${planned.length} notification(s).` };
}

/** Delete every spoof turnover — and, via the on-delete cascade, their
 *  assignments and notifications. The one-button reset after testing. */
export async function cleanupSpoofTurnovers(): Promise<TestResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { data: rows, error: findErr } = await admin
    .from("turnovers")
    .select("id")
    .ilike("notes", `%${SPOOF_MARKER}%`);
  if (findErr) return { ok: false, error: findErr.message };
  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return { ok: true, summary: "No spoof turnovers to clean up." };
  const { error } = await admin.from("turnovers").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    summary: `Removed ${ids.length} spoof turnover(s) and their notifications.`,
  };
}
