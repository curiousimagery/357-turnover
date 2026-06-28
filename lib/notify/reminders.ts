/**
 * Reminders for claimed turnovers coming up (spec Section 5.4). Default: ~2 days
 * out. Enqueued during the hourly sync; the unique dedupe_key
 * (`reminder:<turnover>:<cleaner>`) means each claim is reminded exactly once,
 * no matter how many syncs run inside the window. Per-cleaner cadence is a
 * backlog item — for now everyone gets the 2-day default.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { todayInPropertyTz } from "../dates";
import { notificationCopy } from "./copy";

export const REMINDER_DAYS = 2;

export type ClaimedTurnover = {
  turnoverId: string;
  date: string;
  isSameDay: boolean;
  cleanerId: string;
};

export type PlannedReminder = {
  recipientId: string;
  turnoverId: string;
  title: string;
  body: string;
  dedupeKey: string;
};

/** Pure: one reminder per claimed turnover, deduped per (turnover, cleaner). */
export function planReminders(claimed: ClaimedTurnover[]): PlannedReminder[] {
  return claimed.map((c) => {
    const copy = notificationCopy.reminder(c.date, c.isSameDay);
    return {
      recipientId: c.cleanerId,
      turnoverId: c.turnoverId,
      title: copy.title,
      body: copy.body,
      dedupeKey: `reminder:${c.turnoverId}:${c.cleanerId}`,
    };
  });
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function enqueueReminders(
  supabase: SupabaseClient,
): Promise<number> {
  const today = todayInPropertyTz();
  const horizon = addDaysIso(today, REMINDER_DAYS);

  const { data: rows } = await supabase
    .from("turnovers")
    .select("id, turnover_date, is_same_day, turnover_assignments ( cleaner_id )")
    .gte("turnover_date", today)
    .lte("turnover_date", horizon)
    .eq("status", "scheduled");
  if (!rows || rows.length === 0) return 0;

  const claimed: ClaimedTurnover[] = [];
  for (const t of rows) {
    const embed = (t as { turnover_assignments: unknown }).turnover_assignments;
    const assignment = Array.isArray(embed) ? embed[0] : embed;
    const cleanerId = (assignment as { cleaner_id?: string } | null)?.cleaner_id;
    if (!cleanerId) continue;
    claimed.push({
      turnoverId: t.id as string,
      date: t.turnover_date as string,
      isSameDay: t.is_same_day as boolean,
      cleanerId,
    });
  }
  if (claimed.length === 0) return 0;

  const insertRows = planReminders(claimed).map((r) => ({
    recipient_id: r.recipientId,
    type: "reminder",
    channel: "email",
    turnover_id: r.turnoverId,
    title: r.title,
    body: r.body,
    status: "pending",
    dedupe_key: r.dedupeKey,
  }));

  await supabase
    .from("notifications")
    .upsert(insertRows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  return insertRows.length;
}
