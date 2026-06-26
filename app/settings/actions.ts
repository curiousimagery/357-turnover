"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { isCleanerTagColor } from "@/lib/cleaner-tags";
import { NOTIFICATION_CATEGORIES } from "@/lib/notify/types";

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

/**
 * One save for everything about you: the editable profile fields (display name,
 * payment preference, tag color) AND notification preferences, in a single call
 * so the settings page has one consistent save model. Notification categories
 * fan out to their member `type`s. RLS scopes both writes to the current user.
 */
export async function saveAccountSettings(input: {
  displayName: string;
  paymentPreference: string;
  color: string;
  prefs: Record<string, { in_app: boolean; email: boolean }>;
}): Promise<SaveProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "You need to be signed in." };

  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: "Display name is required." };
  if (!isCleanerTagColor(input.color)) {
    return { ok: false, error: "Pick a tag color from the palette." };
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      payment_preference: input.paymentPreference.trim() || null,
      color: input.color,
    })
    .eq("id", user.id);
  if (profileErr) return { ok: false, error: profileErr.message };

  // A category toggle persists every notification `type` it covers.
  const rows: { user_id: string; type: string; in_app: boolean; email: boolean }[] = [];
  for (const cat of NOTIFICATION_CATEGORIES) {
    const v = input.prefs[cat.key];
    if (!v) continue; // category not shown to this user
    for (const type of cat.types) {
      rows.push({ user_id: user.id, type, in_app: v.in_app, email: v.email });
    }
  }
  if (rows.length > 0) {
    const { error: prefErr } = await supabase
      .from("notification_preferences")
      .upsert(rows, { onConflict: "user_id,type" });
    if (prefErr) return { ok: false, error: prefErr.message };
  }

  return { ok: true };
}

/**
 * Change the email you sign in with. Supabase emails the NEW address a
 * confirmation link; the change only takes effect once it's clicked. (That
 * link uses the "Change Email Address" template, which needs the same
 * token-hash treatment as the invite — see docs/AUTH_EMAIL_SETUP.md.)
 */
export async function updateEmail(newEmail: string): Promise<SaveProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const email = newEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (email === user.email) {
    return { ok: false, error: "That's already your email." };
  }

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    ?? (host ? `${proto}://${host}` : "http://localhost:3000");

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${origin}/auth/confirm?next=/settings` },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
