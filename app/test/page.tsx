import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { TestTools } from "@/components/test-tools";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Test — 357 Oasis Turnovers" };

export default async function TestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") redirect("/schedule");

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("active", true)
    .order("display_name", { ascending: true });
  const recipients = (rows ?? []).map((r) => ({
    id: r.id as string,
    name: r.display_name as string,
  }));

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Test tools</h1>
          <p className="text-body text-muted-foreground">
            Exercise notifications without touching the real Airbnb feed.
          </p>
        </div>
        <TestTools recipients={recipients} />
      </main>
    </div>
  );
}
