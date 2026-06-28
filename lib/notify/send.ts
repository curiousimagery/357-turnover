/**
 * Drain the notification outbox by email (Resend). Called from the sync route
 * after reconcile, so the hourly cron both enqueues and delivers. Defensive and
 * idempotent: only `pending` email rows are sent, each flips to `sent`/`failed`
 * so it's never sent twice, and any failure here can't affect the schedule.
 *
 * Uses Resend's REST API directly (no SDK dependency — keep it lean).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SenderConfig = {
  apiKey: string; // RESEND_API_KEY
  from: string; // verified sender, e.g. "357 Oasis Turnovers <turnovers@yourdomain>"
  appUrl: string; // for the "view the schedule" link
};

export function senderConfigFromEnv(): SenderConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null; // not configured yet — sending is a no-op
  return {
    apiKey,
    from: process.env.NOTIFY_FROM ?? "357 Oasis Turnovers <onboarding@resend.dev>",
    appUrl: (
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://357-turnover.vercel.app"
    ).replace(/\/$/, ""),
  };
}

export async function sendPendingNotifications(
  supabase: SupabaseClient,
  config: SenderConfig,
  limit = 50,
): Promise<{ sent: number; failed: number }> {
  const { data: pending } = await supabase
    .from("notifications")
    .select("id, recipient_id, type, title, body")
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!pending || pending.length === 0) return { sent: 0, failed: 0 };

  const userIds = [...new Set(pending.map((n) => n.recipient_id as string))];

  // Email opt-outs: (user, type) pairs the recipient turned off for email.
  const { data: muted } = await supabase
    .from("notification_preferences")
    .select("user_id, type")
    .in("user_id", userIds)
    .eq("email", false);
  const emailMuted = new Set(
    (muted ?? []).map((m) => `${m.user_id}|${m.type}`),
  );

  // Resolve each recipient's current email once.
  const emailById = new Map<string, string | null>();
  for (const id of userIds) {
    const { data } = await supabase.auth.admin.getUserById(id);
    emailById.set(id, data.user?.email ?? null);
  }

  let sent = 0;
  let failed = 0;
  for (const n of pending) {
    // Opted out of email for this type — delivered in-app only; don't retry.
    if (emailMuted.has(`${n.recipient_id}|${n.type}`)) {
      await supabase
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", n.id);
      continue;
    }
    const to = emailById.get(n.recipient_id as string);
    if (!to) {
      await markFailed(supabase, n.id as string);
      failed += 1;
      continue;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [to],
          subject: n.title as string,
          text: `${n.body}\n\nOpen the schedule: ${config.appUrl}/schedule\n\n—\nAutomated message; this address isn't monitored. Manage everything in the app.`,
        }),
      });
      if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
      await supabase
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", n.id);
      sent += 1;
    } catch (e) {
      console.error("notification send failed:", e);
      await markFailed(supabase, n.id as string);
      failed += 1;
    }
  }
  return { sent, failed };
}

async function markFailed(supabase: SupabaseClient, id: string) {
  await supabase.from("notifications").update({ status: "failed" }).eq("id", id);
}
