/**
 * Integration test: the full reconcile pipeline against a real Postgres.
 * Skipped unless SUPABASE_URL + SUPABASE_SERVICE_KEY are set (local Supabase),
 * so the default `npm test` stays fast and DB-free. Run it with:
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_SERVICE_KEY=<local service key> \
 *   npx vitest run reconcile.integration
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { runSync } from "./reconcile";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const suite = SUPABASE_URL && SERVICE_KEY ? describe : describe.skip;

const fixture = readFileSync(
  fileURLToPath(new URL("./__fixtures__/summer-2026.ics", import.meta.url)),
  "utf8",
);

function serve(body: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer((_req, res) => {
      res.setHeader("content-type", "text/calendar");
      res.end(body);
    });
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}/feed.ics`,
        close: () => server.close(),
      });
    });
  });
}

suite("runSync against local Supabase", () => {
  let supabase: SupabaseClient;
  let feed: { url: string; close: () => void };

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const wildcard = "00000000-0000-0000-0000-000000000000";
    await supabase.from("turnovers").delete().neq("id", wildcard);
    await supabase.from("bookings").delete().neq("id", wildcard);
    feed = await serve(fixture);
  });

  afterAll(() => feed?.close());

  it("derives 3 turnovers with correct same-day flags and excludes the block", async () => {
    const out = await runSync(supabase, feed.url);
    expect(out.status).toBe("success");
    expect(out.reservations).toBe(3);
    expect(out.added).toBe(3);

    const { data } = await supabase
      .from("turnovers")
      .select("turnover_date, is_same_day")
      .returns<{ turnover_date: string; is_same_day: boolean }[]>();
    const byDate = new Map((data ?? []).map((t) => [t.turnover_date, t.is_same_day]));
    expect(byDate.size).toBe(3);
    expect(byDate.get("2026-06-25")).toBe(true); // Kaitlyn — next guest checks in
    expect(byDate.get("2026-08-31")).toBe(false); // block starts here, stays relaxed
    expect(byDate.has("2026-10-12")).toBe(false); // block end is never a turnover
  });

  it("is idempotent — a second run adds nothing and produces no duplicates", async () => {
    const out = await runSync(supabase, feed.url);
    expect(out.added).toBe(0);
    const { count } = await supabase
      .from("turnovers")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(3);
  });

  it("never cancels on an empty feed (the worst failure mode)", async () => {
    const emptyFeed = await serve("BEGIN:VCALENDAR\nEND:VCALENDAR\n");
    const out = await runSync(supabase, emptyFeed.url);
    expect(out.status).toBe("skipped");
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    expect(count).toBe(3); // untouched
    emptyFeed.close();
  });
});
