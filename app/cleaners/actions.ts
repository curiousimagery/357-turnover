"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin-only cleaner management (Section 5.1 / 5.12). Inviting a cleaner
 * pre-provisions their account and emails them a sign-in link; their profile
 * row is created by the signup trigger (role defaults to 'cleaner').
 */
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
  return { ok: true as const, supabase, userId: user.id };
}

async function siteOrigin() {
  const h = await headers();
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function inviteCleaner(input: {
  email: string;
  displayName: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }

  const origin = await siteOrigin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName || email.split("@")[0] },
    redirectTo: `${origin}/auth/confirm?next=/welcome`,
  });

  if (error) {
    // The common case: re-inviting an address that already has an account.
    if (/already.*registered|already been registered|exists/i.test(error.message)) {
      return { ok: false, error: "That email already has an account." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/cleaners");
  return { ok: true };
}

export async function setCleanerActive(
  cleanerId: string,
  active: boolean,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (cleanerId === gate.userId) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  const { error } = await gate.supabase
    .from("profiles")
    .update({ active })
    .eq("id", cleanerId);

  if (error) return { ok: false, error: error.message };

  // Deactivating off-boards them: release any turnovers they hold so coverage
  // returns to the pool (never leave a turnover on an inactive person).
  if (!active) {
    await gate.supabase
      .from("turnover_assignments")
      .delete()
      .eq("cleaner_id", cleanerId);
  }

  revalidatePath("/cleaners");
  revalidatePath("/schedule");
  return { ok: true };
}

/** Permanently delete an account (mainly to purge test cleaners). Frees any
 *  turnovers they hold (back to unclaimed), then hard-deletes the auth user —
 *  the profile cascades. Guarded: never self, never another admin. */
export async function deleteCleaner(cleanerId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (cleanerId === gate.userId) {
    return { ok: false, error: "You can't delete your own account." };
  }

  const { data: target } = await gate.supabase
    .from("profiles")
    .select("role")
    .eq("id", cleanerId)
    .maybeSingle();
  if (target?.role === "admin") {
    return { ok: false, error: "Can't delete an admin account." };
  }

  // Release their claims first so the FK to profiles doesn't block the delete
  // (and the turnovers return to the unclaimed pool).
  await gate.supabase
    .from("turnover_assignments")
    .delete()
    .eq("cleaner_id", cleanerId);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(cleanerId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/cleaners");
  return { ok: true };
}

/** Admin changes a cleaner's sign-in email. Uses the auth admin API and confirms
 *  it immediately (no round-trip), since the admin is managing the account. */
export async function updateCleanerEmail(
  cleanerId: string,
  email: string,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return { ok: false, error: "Enter a valid email." };
  }

  const { error } = await createAdminClient().auth.admin.updateUserById(cleanerId, {
    email: clean,
    email_confirm: true,
  });
  if (error) {
    if (/already.*registered|already been registered|exists/i.test(error.message)) {
      return { ok: false, error: "Another account already uses that email." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/cleaners/${cleanerId}`);
  return { ok: true };
}

/** Set a cleaner's default per-turnover rate (prefills payments). */
export async function setDefaultRate(
  cleanerId: string,
  rate: number | null,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const { error } = await gate.supabase
    .from("cleaner_rates")
    .upsert(
      {
        cleaner_id: cleanerId,
        default_rate: rate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cleaner_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/cleaners/${cleanerId}`);
  return { ok: true };
}
