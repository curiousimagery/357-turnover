import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { InboxList, type InboxItem } from "@/components/inbox-list";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeMinutes } from "@/lib/dates";

export const metadata = { title: "Inbox — 357 Oasis Turnovers" };

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: muted } = await supabase
    .from("notification_preferences")
    .select("type")
    .eq("user_id", user.id)
    .eq("in_app", false);
  const mutedTypes = (muted ?? []).map((m) => m.type as string);

  let listQuery = supabase
    .from("notifications")
    .select("id, type, title, body, created_at, read_at, turnover_id")
    .eq("recipient_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (mutedTypes.length > 0) {
    listQuery = listQuery.not("type", "in", `(${mutedTypes.join(",")})`);
  }
  const { data: rows } = await listQuery;

  const now = Date.now();
  const items: InboxItem[] = (rows ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    title: n.title as string,
    body: n.body as string,
    readAt: (n.read_at as string | null) ?? null,
    turnoverId: (n.turnover_id as string | null) ?? null,
    timeLabel: formatRelativeMinutes(
      Math.max(0, Math.floor((now - new Date(n.created_at as string).getTime()) / 60000)),
    ),
  }));

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Inbox</h1>
          <p className="text-body text-muted-foreground">
            Bookings, cancellations, date changes, and reminders.
          </p>
        </div>
        <InboxList items={items} />
      </main>
    </div>
  );
}
