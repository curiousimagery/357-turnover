"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  return { ok: true as const, userId: user.id };
}

/** Add a linen type to the inventory: a kind + label + how many we own. */
export async function addLinenType(input: {
  kind: string;
  label: string;
  count: number;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const kind = input.kind === "duvet_set" ? "duvet_set" : "sheet_set";
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Give the type a label." };
  const count = Number.isFinite(input.count) ? Math.max(0, Math.round(input.count)) : 0;
  const { error } = await createAdminClient()
    .from("linen_types")
    .insert({ kind, label, count });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/linens");
  return { ok: true };
}

/** Edit a type's label / owned count. */
export async function updateLinenType(
  id: string,
  input: { label: string; count: number },
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Give the type a label." };
  const count = Number.isFinite(input.count) ? Math.max(0, Math.round(input.count)) : 0;
  const { error } = await createAdminClient()
    .from("linen_types")
    .update({ label, count })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/linens");
  return { ok: true };
}

/** Remove a type from the inventory. Its holdings cascade; past closeout records
 *  keep the row but null the reference (so history stays readable). */
export async function deleteLinenType(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const { error } = await createAdminClient().from("linen_types").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/linens");
  return { ok: true };
}

/**
 * Restock: a holder (or the admin) marks the linens they have out as returned to
 * the closet — clears all of that holder's `linen_holdings`. The closet count is
 * derived, so removing the holdings is all it takes.
 */
export async function restockHolder(holderId: string): Promise<ActionResult> {
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
  const isAdmin = me?.role === "admin";
  if (!isAdmin && user.id !== holderId) {
    return { ok: false, error: "You can only return your own linens." };
  }
  const { error } = await createAdminClient()
    .from("linen_holdings")
    .delete()
    .eq("holder_id", holderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/linens");
  return { ok: true };
}
