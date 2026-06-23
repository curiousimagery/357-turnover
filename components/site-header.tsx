import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

/** Shared app shell header — brand, primary nav, auth state. */
export async function SiteHeader() {
  let isAdmin = false;
  if (hasEnvVars) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-4 px-4">
        <nav className="flex items-center gap-4">
          <Link href="/" className="text-heading">
            Turnover
          </Link>
          <Link
            href="/schedule"
            className="text-caption text-muted-foreground hover:text-foreground"
          >
            Schedule
          </Link>
          {isAdmin && (
            <Link
              href="/cleaners"
              className="text-caption text-muted-foreground hover:text-foreground"
            >
              Cleaners
            </Link>
          )}
          <Link
            href="/settings"
            className="text-caption text-muted-foreground hover:text-foreground"
          >
            Settings
          </Link>
          <Link
            href="/style-guide"
            className="text-caption text-muted-foreground hover:text-foreground"
          >
            Style Guide
          </Link>
        </nav>
        <AuthButton />
      </div>
    </header>
  );
}
