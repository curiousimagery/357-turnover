import Link from "next/link";
import { AuthButton } from "@/components/auth-button";

/** Shared app shell header — brand, primary nav, auth state. */
export function SiteHeader() {
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
