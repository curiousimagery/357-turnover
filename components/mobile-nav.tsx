"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/** The nav links collapsed behind a hamburger on small screens. The desktop
 *  header shows them inline (so this trigger is hidden at `sm` and up). */
export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <div className="sm:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Menu className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {links.map((l) => (
            <DropdownMenuItem key={l.href} asChild>
              <Link href={l.href}>{l.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
