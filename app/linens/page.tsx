import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { LinensManager, type LinenSet } from "@/components/linens-manager";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Linens — 357 Oasis Turnovers" };

export default async function LinensPage() {
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
  const isAdmin = me?.role === "admin";

  const [{ data: rows }, { data: cleanerRows }] = await Promise.all([
    supabase
      .from("linen_sets")
      .select("id, kind, label, state, held_by")
      .order("kind", { ascending: true })
      .order("label", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("active", true)
      .order("display_name", { ascending: true }),
  ]);

  const sets: LinenSet[] = (rows ?? []).map((s) => ({
    id: s.id as string,
    kind: s.kind as string,
    label: s.label as string,
    state: s.state as string,
    heldById: (s.held_by as string | null) ?? null,
  }));
  const cleaners = (cleanerRows ?? []).map((c) => ({
    id: c.id as string,
    name: c.display_name as string,
  }));

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Linens</h1>
          <p className="text-body text-muted-foreground">
            Where each sheet and duvet set is right now.
          </p>
        </div>
        <LinensManager sets={sets} cleaners={cleaners} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
