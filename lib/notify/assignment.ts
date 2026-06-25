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

/** Tell the admins a turnover lost its cleaner so they can ensure coverage —
 *  especially for last-minute releases. */
export async function notifyAdminsReleased(
  admin: SupabaseClient,
  args: { turnoverId: string; date: string; releasedByName: string },
): Promise<void> {
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("active", true);
  const recipients = (admins ?? []).map((a) => a.id as string);
  if (recipients.length === 0) return;

  const stamp = Date.now();
  await admin.from("notifications").insert(
    recipients.map((id) => ({
      recipient_id: id,
      type: "released",
      channel: "email",
      turnover_id: args.turnoverId,
      title: "A turnover needs coverage",
      body: `${args.releasedByName} released the turnover on ${args.date}. It's back in the unclaimed pool.`,
      status: "pending",
      dedupe_key: `released:${args.turnoverId}:${id}:${stamp}`,
    })),
  );
}

/** Tell a cleaner they've been paid for a turnover. */
export async function notifyPaid(
  admin: SupabaseClient,
  args: { turnoverId: string; date: string; cleanerId: string; amount: number | null },
): Promise<void> {
  const money = args.amount != null ? ` of $${args.amount}` : "";
  await admin.from("notifications").insert({
    recipient_id: args.cleanerId,
    type: "payment_sent",
    channel: "email",
    turnover_id: args.turnoverId,
    title: "You've been paid",
    body: `Payment${money} sent for the turnover on ${args.date}.`,
    status: "pending",
    dedupe_key: `payment_sent:${args.turnoverId}:${args.cleanerId}:${Date.now()}`,
  });
}

/** Admin leaves a private note for the cleaner about a turnover (cross-refs the
 *  date via the linked turnover). Reuses the inbox + email engine. */
export async function notifyCleanerNote(
  admin: SupabaseClient,
  args: { turnoverId: string; date: string; cleanerId: string; note: string },
): Promise<void> {
  await admin.from("notifications").insert({
    recipient_id: args.cleanerId,
    type: "cleaner_note",
    channel: "email",
    turnover_id: args.turnoverId,
    title: `A note from Daniel — ${args.date} turnover`,
    body: args.note,
    status: "pending",
    dedupe_key: `cleaner_note:${args.turnoverId}:${args.cleanerId}:${Date.now()}`,
  });
}

/** Tell the admins a turnover was marked complete. */
export async function notifyAdminsCompleted(
  admin: SupabaseClient,
  args: { turnoverId: string; date: string; cleanerName: string },
): Promise<void> {
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("active", true);
  const recipients = (admins ?? []).map((a) => a.id as string);
  if (recipients.length === 0) return;

  const stamp = Date.now();
  await admin.from("notifications").insert(
    recipients.map((id) => ({
      recipient_id: id,
      type: "completed",
      channel: "email",
      turnover_id: args.turnoverId,
      title: "Turnover completed",
      body: `${args.cleanerName} marked the turnover on ${args.date} complete.`,
      status: "pending",
      dedupe_key: `completed:${args.turnoverId}:${id}:${stamp}`,
    })),
  );
}
