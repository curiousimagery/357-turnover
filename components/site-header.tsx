import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/profile-menu";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

/** Shared app shell header — brand, nav, inbox, and the profile menu. */
export async function SiteHeader() {
  let isAdmin = false;
  let signedIn = false;
  let unread = 0;
  let profile: { name: string; color: string | null; email: string } | null =
    null;

  if (hasEnvVars) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      signedIn = true;
      const { data: row } = await supabase
        .from("profiles")
        .select("role, display_name, color")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = row?.role === "admin";
      profile = {
        name: row?.display_name ?? user.email?.split("@")[0] ?? "You",
        color: row?.color ?? null,
        email: user.email ?? "",
      };

      const { data: muted } = await supabase
        .from("notification_preferences")
        .select("type")
        .eq("user_id", user.id)
        .eq("in_app", false);
      const mutedTypes = (muted ?? []).map((m) => m.type as string);

      let countQuery = supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null)
        .is("archived_at", null);
      if (mutedTypes.length > 0) {
        countQuery = countQuery.not("type", "in", `(${mutedTypes.join(",")})`);
      }
      const { count } = await countQuery;
      unread = count ?? 0;
    }
  }

  const adminLinks = isAdmin
    ? [
        { href: "/cleaners", label: "Cleaners" },
        { href: "/checklist", label: "Checklist" },
        { href: "/supplies", label: "Supplies" },
        { href: "/test", label: "Test" },
        { href: "/style-guide", label: "Style Guide" },
      ]
    : [];

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
          {signedIn && (
            <Link
              href="/linens"
              className="text-caption text-muted-foreground hover:text-foreground"
            >
              Linens
            </Link>
          )}
          {adminLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-caption text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
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
          {signedIn && profile ? (
            <ProfileMenu
              name={profile.name}
              color={profile.color}
              email={profile.email}
            />
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
