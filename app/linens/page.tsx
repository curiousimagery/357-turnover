import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { LinensManager } from "@/components/linens-manager";
import { createClient } from "@/lib/supabase/server";
import {
  deriveLocations,
  type BedLinen,
  type Holding,
  type LinenType,
} from "@/lib/linens/derive";

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

  // Inventory, what's on the beds now (the latest closeout record), and what's out.
  const [{ data: typeRows }, { data: latestRow }, { data: holdingRows }] = await Promise.all([
    supabase
      .from("linen_types")
      .select("id, kind, label, count")
      .order("kind", { ascending: true })
      .order("label", { ascending: true }),
    supabase
      .from("turnover_linens")
      .select("turnover_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("linen_holdings")
      .select("type_id, holder_id, qty, profiles ( display_name )")
      .gt("qty", 0),
  ]);

  let latestBeds: BedLinen[] = [];
  if (latestRow?.turnover_id) {
    const { data: bedRows } = await supabase
      .from("turnover_linens")
      .select("bed, sheet_type_id, duvet_type_id")
      .eq("turnover_id", latestRow.turnover_id as string);
    latestBeds = (bedRows ?? []).map((r) => ({
      bed: r.bed as number,
      sheetTypeId: (r.sheet_type_id as string | null) ?? null,
      duvetTypeId: (r.duvet_type_id as string | null) ?? null,
    }));
  }

  const types = (typeRows ?? []).map((t) => ({
    id: t.id as string,
    kind: t.kind as LinenType["kind"],
    label: t.label as string,
    count: t.count as number,
  }));
  const holdings: Holding[] = (holdingRows ?? []).map((h) => {
    const embed = (h as { profiles: unknown }).profiles;
    const profile = (Array.isArray(embed) ? embed[0] : embed) as
      | { display_name: string }
      | null;
    return {
      typeId: h.type_id as string,
      holderId: h.holder_id as string,
      holderName: profile?.display_name ?? "Someone",
      qty: h.qty as number,
    };
  });

  const locations = deriveLocations(types, latestBeds, holdings);

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Linens</h1>
          <p className="text-body text-muted-foreground">
            How many of each set we own, and where they are right now.
          </p>
        </div>
        <LinensManager locations={locations} isAdmin={isAdmin} currentUserId={user.id} />
      </main>
    </div>
  );
}
