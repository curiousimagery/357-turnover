import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Handles both Supabase email flows so auth works whatever
 * the project's template emits:
 *   - PKCE:        ?code=...                 -> exchangeCodeForSession
 *   - token_hash:  ?token_hash=...&type=...  -> verifyOtp
 * `next` is constrained to a relative path to avoid open redirects.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") ? nextParam : "/";

  const fail = (message: string) =>
    NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(message)}`,
    );

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail(error.message) : NextResponse.redirect(`${origin}${next}`);
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    return error ? fail(error.message) : NextResponse.redirect(`${origin}${next}`);
  }

  return fail("No token hash or code");
}
