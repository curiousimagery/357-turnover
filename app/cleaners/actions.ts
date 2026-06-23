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
    redirectTo: `${origin}/auth/confirm?next=/schedule`,
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
  revalidatePath("/cleaners");
  return { ok: true };
}
