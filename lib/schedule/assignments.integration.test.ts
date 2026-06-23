/**
 * Integration test: the double-booking guard. The unique(turnover_id) constraint
 * on turnover_assignments is the load-bearing safety net (Section 1.3 / 5.3) —
 * two cleaners must never both hold the same turnover. Skipped unless
 * SUPABASE_URL + SUPABASE_SERVICE_KEY are set (local Supabase). Run with:
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_KEY=<local service key> \
 *   npx vitest run assignments.integration
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const suite = SUPABASE_URL && SERVICE_KEY ? describe : describe.skip;

const UNIQUE_VIOLATION = "23505";

suite("turnover_assignments double-booking guard", () => {
  let supabase: SupabaseClient;
  let turnoverId: string;
  const userIds: string[] = [];

  async function makeUser(name: string): Promise<string> {
    const email = `it+${name}+${Date.now()}@example.com`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (error) throw error;
    const id = data.user!.id;
    userIds.push(id);
    return id;
  }

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: t, error } = await supabase
      .from("turnovers")
      .insert({
        turnover_date: "2026-07-04",
        source: "manual",
        is_same_day: false,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (error) throw error;
    turnoverId = t.id as string;
  });

  afterAll(async () => {
    if (turnoverId) await supabase.from("turnovers").delete().eq("id", turnoverId);
    for (const id of userIds) await supabase.auth.admin.deleteUser(id);
  });

  it("rejects a second claim on the same turnover (23505)", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");

    const first = await supabase
      .from("turnover_assignments")
      .insert({ turnover_id: turnoverId, cleaner_id: alice });
    expect(first.error).toBeNull();

    const second = await supabase
      .from("turnover_assignments")
      .insert({ turnover_id: turnoverId, cleaner_id: bob });
    expect(second.error?.code).toBe(UNIQUE_VIOLATION);

    // Exactly one holder remains — Alice.
    const { data } = await supabase
      .from("turnover_assignments")
      .select("cleaner_id")
      .eq("turnover_id", turnoverId);
    expect(data?.length).toBe(1);
    expect(data?.[0]?.cleaner_id).toBe(alice);
  });

  it("reassign (admin upsert) moves the single holder, never duplicates", async () => {
    const carol = await makeUser("carol");

    const { error } = await supabase
      .from("turnover_assignments")
      .upsert(
        { turnover_id: turnoverId, cleaner_id: carol },
        { onConflict: "turnover_id" },
      );
    expect(error).toBeNull();

    const { data } = await supabase
      .from("turnover_assignments")
      .select("cleaner_id")
      .eq("turnover_id", turnoverId);
    expect(data?.length).toBe(1);
    expect(data?.[0]?.cleaner_id).toBe(carol);
  });

  it("the schedule embed returns the holder's profile as a one-to-one OBJECT", async () => {
    // This is the exact shape /schedule reads. The unique(turnover_id)
    // constraint makes PostgREST embed it as a single object (not an array) —
    // the page must not index it with [0]. Guards that regression.
    const { data, error } = await supabase
      .from("turnovers")
      .select(
        "id, turnover_assignments ( cleaner_id, profiles ( id, display_name, color ) )",
      )
      .eq("id", turnoverId)
      .single();
    expect(error).toBeNull();

    const embed = (data as { turnover_assignments: unknown })
      .turnover_assignments;
    expect(embed).not.toBeNull();
    expect(Array.isArray(embed)).toBe(false); // one-to-one => object

    const assignment = embed as {
      cleaner_id: string;
      profiles: { display_name: string } | { display_name: string }[] | null;
    };
    const profile = Array.isArray(assignment.profiles)
      ? assignment.profiles[0]
      : assignment.profiles;
    expect(profile?.display_name).toBeTruthy();
  });
});
