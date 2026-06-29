"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CleanerTag } from "@/components/cleaner-tag";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet";

type NavLink = { href: string; label: string };

const rowClass =
  "flex items-center justify-between rounded-md px-2 py-2 text-body text-foreground transition-colors hover:bg-muted";

/**
 * The single nav surface: a hamburger that opens a left drawer holding
 * everything — profile, account + notifications, the page links, and sign out.
 * The top bar stays minimal (hamburger · logo · bell · profile), so nothing
 * overflows even for the admin's longer link list.
 */
export function AppMenu({
  name,
  color,
  email,
  unread,
  links,
}: {
  name: string;
  color: string | null;
  email: string;
  unread: number;
  links: NavLink[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/auth/login");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-80 flex-col p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>

        <div className="flex items-center gap-3 border-b border-border p-4 pr-10">
          <CleanerTag name={name} color={color} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body font-semibold text-foreground">{name}</span>
            <span className="truncate text-caption text-muted-foreground">{email}</span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 border-b border-border p-2">
          <SheetClose asChild>
            <Link href="/settings" className={rowClass}>
              Account settings
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/inbox" className={rowClass}>
              <span>Notifications</span>
              {unread > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-urgent px-1 text-caption font-semibold text-urgent-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          </SheetClose>
        </nav>

        <nav className="flex flex-col gap-1 border-b border-border p-2">
          {links.map((l) => (
            <SheetClose asChild key={l.href}>
              <Link href={l.href} className={rowClass}>
                {l.label}
              </Link>
            </SheetClose>
          ))}
        </nav>

        <div className="p-2">
          <button type="button" onClick={logout} className={cn(rowClass, "w-full text-left")}>
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
