import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SuppliesBoard, type BoardNote } from "@/components/supplies-board";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Inventory — 357 Oasis Turnovers" };

export default async function InventoryPage() {
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

  // Everyone signed in sees the whole list (cleaners included), so read with the
  // service role rather than the per-user RLS view. Defensive: empty board if the
  // table isn't migrated yet. Open notes first, newest within each group.
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("supply_notes")
    .select("id, body, created_at, resolved, turnover_id, author_id")
    .order("resolved", { ascending: true })
    .order("created_at", { ascending: false });

  const notes = rows ?? [];
  const authorIds = [...new Set(notes.map((n) => n.author_id).filter(Boolean))] as string[];
  const turnoverIds = [...new Set(notes.map((n) => n.turnover_id).filter(Boolean))] as string[];

  const [{ data: authors }, { data: turnovers }] = await Promise.all([
    authorIds.length
      ? admin.from("profiles").select("id, display_name").in("id", authorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    turnoverIds.length
      ? admin.from("turnovers").select("id, turnover_date").in("id", turnoverIds)
      : Promise.resolve({ data: [] as { id: string; turnover_date: string }[] }),
  ]);

  const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name as string]));
  const dateById = new Map((turnovers ?? []).map((t) => [t.id, t.turnover_date as string]));

  const boardNotes: BoardNote[] = notes.map((n) => ({
    id: n.id as string,
    body: n.body as string,
    authorName: n.author_id ? (nameById.get(n.author_id as string) ?? null) : null,
    createdAt: n.created_at as string,
    resolved: !!n.resolved,
    turnoverId: (n.turnover_id as string | null) ?? null,
    turnoverDate: n.turnover_id ? (dateById.get(n.turnover_id as string) ?? null) : null,
  }));

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Inventory</h1>
          <p className="text-body text-muted-foreground">
            Anything that&apos;s been marked running low, in one place. Add a note
            any time something&apos;s getting low — it doesn&apos;t have to be tied
            to a turnover.
          </p>
        </div>
        <SuppliesBoard notes={boardNotes} isAdmin={isAdmin} />
      </main>
    </div>
  );
}
