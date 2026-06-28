import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { SuppliesBoard, type BoardNote } from "@/components/supplies-board";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Supplies — 357 Oasis Turnovers" };

export default async function SuppliesPage() {
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

  // Defensive: if the table isn't migrated yet, render an empty board rather than
  // erroring. Open notes first, newest within each group.
  const { data: rows } = await supabase
    .from("supply_notes")
    .select("id, body, created_at, resolved, turnover_id, author_id")
    .order("resolved", { ascending: true })
    .order("created_at", { ascending: false });

  const notes = rows ?? [];
  const authorIds = [...new Set(notes.map((n) => n.author_id).filter(Boolean))] as string[];
  const turnoverIds = [...new Set(notes.map((n) => n.turnover_id).filter(Boolean))] as string[];

  const [{ data: authors }, { data: turnovers }] = await Promise.all([
    authorIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", authorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    turnoverIds.length
      ? supabase.from("turnovers").select("id, turnover_date").in("id", turnoverIds)
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
          <h1 className="text-display">Supplies</h1>
          <p className="text-body text-muted-foreground">
            The running shopping list — what cleaners flagged low, in one place.
          </p>
        </div>
        <SuppliesBoard notes={boardNotes} />
      </main>
    </div>
  );
}
