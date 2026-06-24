/**
 * Notices for admin-driven assignment changes (assign / reassign / unassign).
 * Unlike sync notifications these are discrete, user-triggered events, so the
 * dedupe_key carries a timestamp (always unique — no idempotent collapsing).
 * Must be inserted with the service-role (admin) client: RLS lets only the
 * system write notifications. Delivered by the same outbox (inbox now, email on
 * the next sync drain).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifyAssigned(
  admin: SupabaseClient,
  args: { turnoverId: string; date: string; cleanerId: string },
): Promise<void> {
  await admin.from("notifications").insert({
    recipient_id: args.cleanerId,
    type: "assigned",
    channel: "email",
    turnover_id: args.turnoverId,
    title: "You've been assigned a turnover",
    body: `You're now on for the turnover on ${args.date}.`,
    status: "pending",
    dedupe_key: `assigned:${args.turnoverId}:${args.cleanerId}:${Date.now()}`,
  });
}

export async function notifyRemoved(
  admin: SupabaseClient,
  args: { turnoverId: string; date: string; cleanerId: string },
): Promise<void> {
  await admin.from("notifications").insert({
    recipient_id: args.cleanerId,
    type: "unassigned",
    channel: "email",
    turnover_id: args.turnoverId,
    title: "You've been taken off a turnover",
    body: `You're no longer assigned the turnover on ${args.date}.`,
    status: "pending",
    dedupe_key: `unassigned:${args.turnoverId}:${args.cleanerId}:${Date.now()}`,
  });
}

/** A turnover reopened (released/unclaimed) — tell the active cleaners it's open
 *  to claim, except whoever just let it go. */
export async function notifyAvailable(
  admin: SupabaseClient,
  args: { turnoverId: string; date: string; excludeCleanerId?: string | null },
): Promise<void> {
  const { data: cleaners } = await admin
    .from("profiles")
    .select("id")
    .eq("active", true)
    .eq("role", "cleaner");
  const recipients = (cleaners ?? [])
    .map((c) => c.id as string)
    .filter((id) => id !== args.excludeCleanerId);
  if (recipients.length === 0) return;

  const stamp = Date.now();
  await admin.from("notifications").insert(
    recipients.map((id) => ({
      recipient_id: id,
      type: "available",
      channel: "email",
      turnover_id: args.turnoverId,
      title: "A turnover is open",
      body: `The turnover on ${args.date} is open to claim.`,
      status: "pending",
      dedupe_key: `available:${args.turnoverId}:${id}:${stamp}`,
    })),
  );
}
