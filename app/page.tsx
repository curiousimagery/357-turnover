import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export default async function Home() {
  let email: string | null = null;
  if (hasEnvVars) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    email = (data?.claims?.email as string | undefined) ?? null;
  }

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Turnover coordination</h1>
          <p className="text-body text-muted-foreground">
            357 26th Ave, Seattle — basement unit.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-heading">
              {email ? `Signed in as ${email}` : "Foundation ready"}
            </CardTitle>
            <CardDescription className="text-caption">
              {email
                ? "The schedule arrives in Phase 1. For now, the design system and account setup are in place."
                : "Phase 0 is in place: design system, magic-link auth, and settings. Sign in to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!email && (
              <Button asChild size="touch">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            )}
            <Button asChild size="touch" variant="outline">
              <Link href="/style-guide">Style Guide</Link>
            </Button>
            <Button asChild size="touch" variant="outline">
              <Link href="/settings">Settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-heading">Schedule</CardTitle>
            <CardDescription className="text-caption">
              The live Airbnb calendar, as turnovers — same-day ones
              unmistakable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="touch">
              <Link href="/schedule">View schedule</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
