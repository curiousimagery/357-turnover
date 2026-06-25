"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const STATES = ["on_beds", "with_cleaner", "clean_backup", "in_wash"];

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

export async function addLinenSet(input: {
  kind: string;
  label: string;
  color: string;
  brand: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const kind = input.kind === "duvet_set" ? "duvet_set" : "sheet_set";
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Give the set a label." };
  const { error } = await gate.supabase.from("linen_sets").insert({
    kind,
    label,
    color: input.color.trim() || null,
    brand: input.brand.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/linens");
  return { ok: true };
}

export async function deleteLinenSet(id: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const { error } = await gate.supabase.from("linen_sets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/linens");
  return { ok: true };
}

/** Move a set to a new state and (when it's out) who holds it. Any signed-in
 *  user may do this — cleaners shuffle linens. */
export async function updateLinen(
  id: string,
  input: { state: string; heldBy: string | null },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };
  if (!STATES.includes(input.state)) {
    return { ok: false, error: "Unknown state." };
  }
  const heldBy =
    input.state === "with_cleaner" || input.state === "in_wash"
      ? input.heldBy
      : null;
  const { error } = await supabase
    .from("linen_sets")
    .update({ state: input.state, held_by: heldBy })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/linens");
  return { ok: true };
}
