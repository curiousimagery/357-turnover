import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  // Before Supabase is connected, just offer sign-in so the shell renders.
  if (hasEnvVars) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    if (user) {
      return (
        <div className="flex items-center gap-2">
          <span className="hidden text-caption text-muted-foreground sm:inline">
            {user.email}
          </span>
          <LogoutButton />
        </div>
      );
    }
  }

  return (
    <Button asChild size="sm" variant="outline">
      <Link href="/auth/login">Sign in</Link>
    </Button>
  );
}
