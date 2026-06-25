"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyAdminsCompleted,
  notifyCleanerNote,
} from "@/lib/notify/assignment";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Admin leaves a private note for the turnover's assigned cleaner. */
export async function addCleanerNote(input: {
  turnoverId: string;
  note: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") return { ok: false, error: "Admins only." };

  const note = input.note.trim();
  if (!note) return { ok: false, error: "Write a note first." };

  const { data: turnover } = await supabase
    .from("turnovers")
    .select("turnover_date")
    .eq("id", input.turnoverId)
    .maybeSingle();
  const { data: assignment } = await supabase
    .from("turnover_assignments")
    .select("cleaner_id")
    .eq("turnover_id", input.turnoverId)
    .maybeSingle();
  const cleanerId = assignment?.cleaner_id as string | undefined;
  if (!cleanerId) {
    return { ok: false, error: "No cleaner is assigned to this turnover." };
  }

  try {
    await notifyCleanerNote(createAdminClient(), {
      turnoverId: input.turnoverId,
      date: (turnover?.turnover_date as string | undefined) ?? "this",
      cleanerId,
      note,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed." };
  }
  revalidatePath(`/turnover/${input.turnoverId}`);
  return { ok: true };
}

/**
 * Mark a turnover complete and (optionally) file guest feedback. Gated to the
 * assigned cleaner or an admin; the writes go through the admin client since
 * cleaners don't have direct write access to turnovers.
 */
export async function completeTurnover(input: {
  turnoverId: string;
  cleanliness: number | null;
  note: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { data: turnover } = await supabase
    .from("turnovers")
    .select("id, turnover_date, status")
    .eq("id", input.turnoverId)
    .maybeSingle();
  if (!turnover) return { ok: false, error: "Turnover not found." };
  if (turnover.status === "completed") {
    return { ok: false, error: "Already marked complete." };
  }

  const { data: assignment } = await supabase
    .from("turnover_assignments")
    .select("cleaner_id")
    .eq("turnover_id", input.turnoverId)
    .maybeSingle();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = me?.role === "admin";
  const isAssigned = assignment?.cleaner_id === user.id;
  if (!isAdmin && !isAssigned) {
    return {
      ok: false,
      error: "Only the assigned cleaner or an admin can complete this.",
    };
  }

  const admin = createAdminClient();
  const { error: upErr } = await admin
    .from("turnovers")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", input.turnoverId);
  if (upErr) return { ok: false, error: upErr.message };

  const cleanliness =
    input.cleanliness && input.cleanliness >= 1 && input.cleanliness <= 5
      ? input.cleanliness
      : null;
  if (cleanliness || input.note.trim()) {
    await admin.from("guest_feedback").insert({
      turnover_id: input.turnoverId,
      cleanliness,
      note: input.note.trim() || null,
      created_by: user.id,
    });
  }

  try {
    await notifyAdminsCompleted(admin, {
      turnoverId: input.turnoverId,
      date: turnover.turnover_date as string,
      cleanerName: (me?.display_name as string | undefined) ?? "A cleaner",
    });
  } catch (e) {
    console.error("completion notice failed:", e);
  }

  revalidatePath("/schedule");
  revalidatePath(`/turnover/${input.turnoverId}`);
  return { ok: true };
}
