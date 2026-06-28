"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Resolve the caller and whether they may write to a given turnover (admin, or
 *  the cleaner currently assigned to it). For a standalone note (no turnover),
 *  only the admin qualifies. */
async function gateForTurnover(turnoverId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Please sign in." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = me?.role === "admin";
  if (isAdmin) return { ok: true as const, userId: user.id, isAdmin: true };

  if (!turnoverId) {
    return { ok: false as const, error: "Admins only." };
  }
  const { data: assignment } = await supabase
    .from("turnover_assignments")
    .select("cleaner_id")
    .eq("turnover_id", turnoverId)
    .maybeSingle();
  if (assignment?.cleaner_id !== user.id) {
    return {
      ok: false as const,
      error: "Only the assigned cleaner or an admin can add a note here.",
    };
  }
  return { ok: true as const, userId: user.id, isAdmin: false };
}

/** File a "running low" note. Tied to a turnover (cleaner at closeout / admin on a
 *  turnover page) or standalone (admin from /supplies). */
export async function addSupplyNote(input: {
  turnoverId: string | null;
  body: string;
}): Promise<ActionResult> {
  const gate = await gateForTurnover(input.turnoverId);
  if (!gate.ok) return gate;

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write a note first." };

  const { error } = await createAdminClient().from("supply_notes").insert({
    turnover_id: input.turnoverId,
    author_id: gate.userId,
    body,
  });
  if (error) return { ok: false, error: error.message };

  if (input.turnoverId) revalidatePath(`/turnover/${input.turnoverId}`);
  revalidatePath("/supplies");
  return { ok: true };
}

/** Admin marks a supply note restocked (or reopens it). */
export async function resolveSupplyNote(
  id: string,
  resolved: boolean,
): Promise<ActionResult> {
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

  const { error } = await createAdminClient()
    .from("supply_notes")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? user.id : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/supplies");
  revalidatePath("/schedule");
  return { ok: true };
}

/** Admin removes a supply note outright. */
export async function deleteSupplyNote(id: string): Promise<ActionResult> {
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

  const { error } = await createAdminClient()
    .from("supply_notes")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/supplies");
  return { ok: true };
}
