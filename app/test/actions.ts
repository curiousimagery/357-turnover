"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPendingNotifications, senderConfigFromEnv } from "@/lib/notify/send";
import { todayInPropertyTz } from "@/lib/dates";

/**
 * Admin test harness (no real Airbnb feed touched): drop a sample notification
 * of any type into someone's inbox to verify delivery, content, the deep link,
 * and email — and a "send emails now" button so you don't wait for the hourly
 * drain. The notification diff logic itself is covered by unit tests.
 */
export type TestResult =
  | { ok: true; sent?: number; failed?: number }
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
