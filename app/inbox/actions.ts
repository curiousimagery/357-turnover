"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/** Mark all of the signed-in user's notifications read. RLS scopes it to their
 *  own rows; we also filter to unread so it's a cheap no-op when there's nothing
 *  new. Used when the inbox is opened. */
export async function markAllRead(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // Only touch read_at — `status` belongs to the email-delivery lifecycle, so a
  // not-yet-sent (pending) email must stay sendable after the user reads it.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) return { ok: false };
  revalidatePath("/inbox");
  return { ok: true };
}

/** Archive one notification (drops out of the inbox + badge; stays as history). */
export async function archiveNotification(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", user.id);
  if (error) return { ok: false };
  revalidatePath("/inbox");
  return { ok: true };
}

/** Clear the inbox — archive everything still showing. */
export async function archiveAll(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("archived_at", null);
  if (error) return { ok: false };
  revalidatePath("/inbox");
  return { ok: true };
}
