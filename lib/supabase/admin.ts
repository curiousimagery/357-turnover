import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the secret (service-role) key. It bypasses
 * RLS for system writes (the sync engine). NEVER import this into client code,
 * and never expose SUPABASE_SECRET_KEY to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (server only).",
    );
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
