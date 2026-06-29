"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyAdminsCompleted,
  notifyCleanerNote,
  notifyManualCancelled,
  notifyPaid,
} from "@/lib/notify/assignment";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Admin records / updates a turnover's payment. Notifies the cleaner the first
 *  time it's marked paid. */
export async function recordPayment(input: {
  turnoverId: string;
  amount: number | null;
  paid: boolean;
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

  const { data: assignment } = await supabase
    .from("turnover_assignments")
    .select("cleaner_id")
    .eq("turnover_id", input.turnoverId)
    .maybeSingle();
  const cleanerId = assignment?.cleaner_id as string | undefined;
  if (!cleanerId) {
    return { ok: false, error: "No cleaner is assigned to this turnover." };
  }

  const { data: existing } = await supabase
    .from("payments")
    .select("paid_at")
    .eq("turnover_id", input.turnoverId)
    .maybeSingle();
  const wasPaid = !!existing?.paid_at;
  const paidAt = input.paid
    ? ((existing?.paid_at as string | undefined) ?? new Date().toISOString())
    : null;

  const { error } = await supabase.from("payments").upsert(
    {
      turnover_id: input.turnoverId,
      cleaner_id: cleanerId,
      amount: input.amount,
      paid_at: paidAt,
    },
    { onConflict: "turnover_id" },
  );
  if (error) return { ok: false, error: error.message };

  if (input.paid && !wasPaid) {
    try {
      const { data: t } = await supabase
        .from("turnovers")
        .select("turnover_date")
        .eq("id", input.turnoverId)
        .maybeSingle();
      await notifyPaid(createAdminClient(), {
        turnoverId: input.turnoverId,
        date: (t?.turnover_date as string | undefined) ?? "the turnover",
        cleanerId,
        amount: input.amount,
      });
    } catch (e) {
      console.error("payment notice failed:", e);
    }
  }

  revalidatePath(`/turnover/${input.turnoverId}`);
  return { ok: true };
}

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
 * Delete a turnover. Only the admin, and only **manual** turnovers — Airbnb
 * turnovers are owned by the calendar sync (deleting one would just reappear on
 * the next sync, or worse, mask a real booking). The delete cascades to the
 * assignment, feedback, and notifications.
 */
export async function deleteTurnover(turnoverId: string): Promise<ActionResult> {
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

  const { data: t } = await supabase
    .from("turnovers")
    .select("source, turnover_date")
    .eq("id", turnoverId)
    .maybeSingle();
  if (!t) return { ok: false, error: "Turnover not found." };
  if (t.source !== "manual") {
    return {
      ok: false,
      error: "Only manual turnovers can be deleted — Airbnb ones are managed by the calendar sync.",
    };
  }

  // Tell whoever was on it before it disappears — same as a cancellation.
  const { data: assignment } = await supabase
    .from("turnover_assignments")
    .select("cleaner_id")
    .eq("turnover_id", turnoverId)
    .maybeSingle();
  const cleanerId = assignment?.cleaner_id as string | undefined;

  const admin = createAdminClient();
  if (cleanerId) {
    try {
      await notifyManualCancelled(admin, {
        date: t.turnover_date as string,
        cleanerId,
      });
    } catch (e) {
      console.error("manual-delete notice failed:", e);
    }
  }

  const { error } = await admin.from("turnovers").delete().eq("id", turnoverId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/schedule");
  return { ok: true };
}

/** Was the current user an admin or the turnover's assigned cleaner? */
async function adminOrAssigned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  turnoverId: string,
): Promise<{ isAdmin: boolean; isAssigned: boolean }> {
  const [{ data: me }, { data: assignment }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("turnover_assignments")
      .select("cleaner_id")
      .eq("turnover_id", turnoverId)
      .maybeSingle(),
  ]);
  return {
    isAdmin: me?.role === "admin",
    isAssigned: assignment?.cleaner_id === userId,
  };
}

/**
 * Shared "prep notes" on a turnover (early check-in, special requests, lost &
 * found). Both the admin and the assigned cleaner can edit; stored on
 * `turnovers.notes`. Written via the admin client after gating, since cleaners
 * can't write turnovers directly.
 */
export async function savePrepNotes(input: {
  turnoverId: string;
  notes: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { isAdmin, isAssigned } = await adminOrAssigned(
    supabase,
    user.id,
    input.turnoverId,
  );
  if (!isAdmin && !isAssigned) {
    return { ok: false, error: "Only the assigned cleaner or an admin can edit notes." };
  }

  const { error } = await createAdminClient()
    .from("turnovers")
    .update({ notes: input.notes.trim() || null })
    .eq("id", input.turnoverId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/turnover/${input.turnoverId}`);
  revalidatePath("/schedule");
  return { ok: true };
}

/**
 * Tick / untick a closeout checklist item for a turnover. Persists per-item so
 * the ticks survive a reload and the admin can see what was checked. Gated to the
 * assigned cleaner or an admin; written via the admin client.
 */
export async function setChecklistItem(input: {
  turnoverId: string;
  itemId: string;
  checked: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { isAdmin, isAssigned } = await adminOrAssigned(
    supabase,
    user.id,
    input.turnoverId,
  );
  if (!isAdmin && !isAssigned) {
    return { ok: false, error: "Only the assigned cleaner or an admin can do this." };
  }

  const admin = createAdminClient();
  if (input.checked) {
    const { error } = await admin
      .from("turnover_checklist_completions")
      .upsert(
        {
          turnover_id: input.turnoverId,
          item_id: input.itemId,
          checked_by: user.id,
          checked_at: new Date().toISOString(),
        },
        { onConflict: "turnover_id,item_id" },
      );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin
      .from("turnover_checklist_completions")
      .delete()
      .eq("turnover_id", input.turnoverId)
      .eq("item_id", input.itemId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/turnover/${input.turnoverId}`);
  return { ok: true };
}

/**
 * File guest feedback (cleanliness + note) independent of marking complete, so
 * it can be added or added-to any time — including after a turnover is done.
 * Gated to the assigned cleaner or admin.
 */
export async function addGuestFeedback(input: {
  turnoverId: string;
  cleanliness: number | null;
  note: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { isAdmin, isAssigned } = await adminOrAssigned(
    supabase,
    user.id,
    input.turnoverId,
  );
  if (!isAdmin && !isAssigned) {
    return { ok: false, error: "Only the assigned cleaner or an admin can add feedback." };
  }

  const cleanliness =
    input.cleanliness && input.cleanliness >= 1 && input.cleanliness <= 5
      ? input.cleanliness
      : null;
  if (!cleanliness && !input.note.trim()) {
    return { ok: false, error: "Add a rating or a note." };
  }

  const { error } = await createAdminClient().from("guest_feedback").insert({
    turnover_id: input.turnoverId,
    cleanliness,
    note: input.note.trim() || null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

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
  /** Optional "anything running low?" flag filed as a supply note on complete. */
  supplyNote?: string;
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

  // A "running low" flag rides along as a supply note. Defensive: a failure here
  // must never block the completion itself.
  if (input.supplyNote?.trim()) {
    try {
      await admin.from("supply_notes").insert({
        turnover_id: input.turnoverId,
        author_id: user.id,
        body: input.supplyNote.trim(),
      });
    } catch (e) {
      console.error("supply note on complete failed:", e);
    }
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
