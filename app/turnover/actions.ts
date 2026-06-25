"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminsCompleted } from "@/lib/notify/assignment";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
