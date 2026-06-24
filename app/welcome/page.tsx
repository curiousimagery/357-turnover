import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Welcome — 357 Oasis Turnovers" };

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "there";

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <div className="text-display" aria-hidden="true">
            🎉
          </div>
          <h1 className="text-display">You&apos;re on the team, {name}!</h1>
          <p className="text-body text-muted-foreground">
            Your account is live. This little app just uses your email to know
            it&apos;s you — no password to keep track of. If you ever get signed
            out, head to{" "}
            <Link href="/auth/login" className="underline">
              the sign-in page
            </Link>{" "}
            and pop your email back in.
          </p>
        </div>

        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-heading">Next steps</h2>
          <ol className="flex flex-col gap-3">
            <li className="text-body text-foreground">
              <span className="font-semibold">1. Bookmark this app</span> so you
              can come back anytime.
            </li>
            <li className="text-body text-foreground">
              <span className="font-semibold">2. Visit your </span>
              <Link href="/settings" className="font-semibold underline">
                Account
              </Link>{" "}
              to pick a color for your name tag and set how you&apos;d like to be
              paid.
            </li>
            <li className="text-body text-foreground">
              <span className="font-semibold">3. Open the </span>
              <Link href="/schedule" className="font-semibold underline">
                Schedule
              </Link>{" "}
              to browse upcoming turnovers and claim the dates you&apos;re free.
            </li>
          </ol>
          <div className="pt-2">
            <Button asChild size="touch">
              <Link href="/schedule">View the schedule</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
