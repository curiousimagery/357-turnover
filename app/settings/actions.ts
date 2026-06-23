"use server";

import { createClient } from "@/lib/supabase/server";
import { isCleanerTagColor } from "@/lib/cleaner-tags";

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Persist the parts of a profile a user may edit themselves (Section 4.2):
 * display name, payment preference, and tag color. RLS guarantees a user can
 * only update their own row; we also scope by id defensively.
 */
export async function saveProfile(input: {
  displayName: string;
  paymentPreference: string;
  color: string;
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

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      payment_preference: input.paymentPreference.trim() || null,
      color: input.color,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
