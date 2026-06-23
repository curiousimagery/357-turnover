import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { CleanersManager, type CleanerRow } from "@/components/cleaners-manager";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Cleaners — Turnover" };

export default async function CleanersPage() {
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
    .select("id, display_name, role, color, active")
    .order("active", { ascending: false })
    .order("display_name", { ascending: true });

  const people: CleanerRow[] = (rows ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
    role: p.role,
    color: p.color,
    active: p.active,
  }));

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Cleaners</h1>
          <p className="text-body text-muted-foreground">
            Invite cleaners and manage who&apos;s active. Invites email a sign-in
            link — no password to set.
          </p>
        </div>

        <CleanersManager people={people} currentUserId={user.id} />
      </main>
    </div>
  );
}
