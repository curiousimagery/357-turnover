import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { ItemsEditor, type EditableItem } from "@/components/items-editor";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Checklist — 357 Oasis Turnovers" };

function toItems(rows: unknown[]): EditableItem[] {
  return (rows as EditableItem[]).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    helper: r.helper ?? null,
    active: r.active,
  }));
}

export default async function ChecklistPage() {
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

  const [{ data: checklist }, { data: inventory }] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("id, name, description, helper, active, position")
      .order("position", { ascending: true }),
    supabase
      .from("inventory_items")
      .select("id, name, description, helper, active, position")
      .order("position", { ascending: true }),
  ]);

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Checklist & inventory</h1>
          <p className="text-body text-muted-foreground">
            The cheat sheets cleaners see. Edit them here anytime — no code, no
            deploy.
          </p>
        </div>

        <ItemsEditor
          list="checklist"
          title="Before you leave"
          blurb="The final closeout checks for every turnover."
          items={toItems(checklist ?? [])}
        />

        <ItemsEditor
          list="inventory"
          title="Inventory refills"
          blurb="Supplies to keep stocked; cleaners flag what's low."
          items={toItems(inventory ?? [])}
        />
      </main>
    </div>
  );
}
