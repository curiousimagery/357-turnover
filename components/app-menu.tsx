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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type NavLink = { href: string; label: string };

type MenuProps = {
  name: string;
  color: string | null;
  email: string;
  unread: number;
  links: NavLink[];
};

const triggerClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring";
const rowClass =
  "flex w-full items-center justify-between rounded-md px-2 py-2 text-body text-foreground transition-colors hover:bg-muted";

function UnreadBadge({ unread }: { unread: number }) {
  if (unread <= 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-urgent px-1 text-caption font-semibold text-urgent-foreground">
      {unread > 9 ? "9+" : unread}
    </span>
  );
}

function ProfileBlock({ name, color, email }: { name: string; color: string | null; email: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border p-4 pr-10">
      <CleanerTag name={name} color={color} />
      <div className="flex flex-col">
        <span className="text-body font-semibold text-foreground">{name}</span>
        {/* Hug to content; wrap only if it can't fit (rather than truncate early). */}
        <span className="break-all text-caption text-muted-foreground">{email}</span>
      </div>
    </div>
  );
}

/**
 * The single nav surface. On phones it's a left drawer (slides from the screen
 * edge, which is right where the hamburger sits); on desktop it's a dropdown
 * anchored to the hamburger so it stays in context. Both hold everything:
 * profile, account + notifications, the page links, and sign out.
 */
export function AppMenu(props: MenuProps) {
  return (
    <>
      <div className="sm:hidden">
        <SheetMenu {...props} />
      </div>
      <div className="hidden sm:block">
        <DropdownMenuMenu {...props} />
      </div>
    </>
  );
}

function useSignOut(close: () => void) {
  const router = useRouter();
  return async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    close();
    router.push("/auth/login");
  };
}

function SheetMenu({ name, color, email, unread, links }: MenuProps) {
  const [open, setOpen] = useState(false);
  const signOut = useSignOut(() => setOpen(false));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Menu" className={triggerClass}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex w-80 flex-col p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <ProfileBlock name={name} color={color} email={email} />

        <nav className="flex flex-col gap-1 border-b border-border p-2">
          <SheetClose asChild>
            <Link href="/settings" className={rowClass}>
              Account settings
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="/inbox" className={rowClass}>
              <span>Notifications</span>
              <UnreadBadge unread={unread} />
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
          <button type="button" onClick={signOut} className={cn(rowClass, "text-left")}>
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DropdownMenuMenu({ name, color, email, unread, links }: MenuProps) {
  const [open, setOpen] = useState(false);
  const signOut = useSignOut(() => setOpen(false));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger aria-label="Menu" className={triggerClass}>
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="p-0">
        <ProfileBlock name={name} color={color} email={email} />

        <div className="p-1">
          <DropdownMenuItem asChild>
            <Link href="/settings" className={rowClass}>
              Account settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/inbox" className={rowClass}>
              <span>Notifications</span>
              <UnreadBadge unread={unread} />
            </Link>
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <div className="p-1">
          {links.map((l) => (
            <DropdownMenuItem asChild key={l.href}>
              <Link href={l.href} className={rowClass}>
                {l.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <div className="p-1">
          <DropdownMenuItem onSelect={signOut} className={rowClass}>
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
