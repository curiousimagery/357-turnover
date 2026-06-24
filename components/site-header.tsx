import Link from "next/link";
import { Bell } from "lucide-react";

import { AuthButton } from "@/components/auth-button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

/** Shared app shell header — brand, primary nav, inbox, auth state. */
export async function SiteHeader() {
  let isAdmin = false;
  let signedIn = false;
  let unread = 0;

  if (hasEnvVars) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      signedIn = true;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      unread = count ?? 0;
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-4 px-4">
        <nav className="flex items-center gap-4">
          <Link href="/" className="text-heading">
            357 Oasis Turnovers
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
            Account
          </Link>
          {isAdmin && (
            <Link
              href="/style-guide"
              className="text-caption text-muted-foreground hover:text-foreground"
            >
              Style Guide
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn && (
            <Link
              href="/inbox"
              aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-urgent px-1 text-caption font-semibold text-urgent-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          )}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
