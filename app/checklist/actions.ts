"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { LIST_DEFAULTS, type ListKind } from "@/lib/content/closeout-defaults";

export type ActionResult = { ok: true } | { ok: false; error: string };

const TABLE: Record<ListKind, string> = {
  checklist: "checklist_items",
  inventory: "inventory_items",
};

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

export async function seedDefaults(list: ListKind): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const { count } = await gate.supabase
    .from(TABLE[list])
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    return { ok: false, error: "This list already has items." };
  }

  const rows = LIST_DEFAULTS[list].map((d, i) => ({
    name: d.name,
    description: d.description,
    helper: d.helper ?? null,
    position: i,
  }));
  const { error } = await gate.supabase.from(TABLE[list]).insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/checklist");
  return { ok: true };
}

export async function addItem(
  list: ListKind,
  input: { name: string; description: string; helper: string },
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name || !description) {
    return { ok: false, error: "Name and description are required." };
  }

  const { data: last } = await gate.supabase
    .from(TABLE[list])
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await gate.supabase.from(TABLE[list]).insert({
    name,
    description,
    helper: input.helper.trim() || null,
    position,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/checklist");
  return { ok: true };
}

export async function updateItem(
  list: ListKind,
  id: string,
  input: { name: string; description: string; helper: string },
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name || !description) {
    return { ok: false, error: "Name and description are required." };
  }
  const { error } = await gate.supabase
    .from(TABLE[list])
    .update({ name, description, helper: input.helper.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/checklist");
  return { ok: true };
}

export async function deleteItem(
  list: ListKind,
  id: string,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const { error } = await gate.supabase.from(TABLE[list]).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/checklist");
  return { ok: true };
}

export async function setItemActive(
  list: ListKind,
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const { error } = await gate.supabase
    .from(TABLE[list])
    .update({ active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/checklist");
  return { ok: true };
}

/** Move an item up/down by swapping its position with its neighbor. */
export async function moveItem(
  list: ListKind,
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const { data: items } = await gate.supabase
    .from(TABLE[list])
    .select("id, position")
    .order("position", { ascending: true });
  if (!items) return { ok: false, error: "Could not load the list." };

  const i = items.findIndex((it) => it.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return { ok: true }; // at an edge — no-op

  const a = items[i];
  const b = items[j];
  // Swap positions in two updates.
  await gate.supabase
    .from(TABLE[list])
    .update({ position: b.position })
    .eq("id", a.id);
  await gate.supabase
    .from(TABLE[list])
    .update({ position: a.position })
    .eq("id", b.id);
  revalidatePath("/checklist");
  return { ok: true };
}
