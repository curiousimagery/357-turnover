"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { CleanerTag } from "@/components/cleaner-tag";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/** Your name + initials become the trigger for a small account menu. */
export function ProfileMenu({
  name,
  color,
  email,
}: {
  name: string;
  color: string | null;
  email: string;
}) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-border py-1 pl-1 pr-2 outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring">
        <CleanerTag name={name} color={color} />
        {/* Name hides on tiny screens so the top bar fits — initials + caret only. */}
        <span className="hidden text-caption text-foreground sm:inline">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-caption font-normal text-muted-foreground">
          Signed in as {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Account settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
