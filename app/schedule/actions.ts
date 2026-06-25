"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyAssigned,
  notifyRemoved,
  notifyAvailable,
  notifyAdminsReleased,
} from "@/lib/notify/assignment";

/**
 * Claiming / assignment actions (Section 5.3). The unique(turnover_id)
 * constraint on turnover_assignments is the real safety net — these actions
 * just translate its errors into friendly messages. RLS decides who may do
 * what; we re-check the obvious cases up front for clean errors.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

const UNIQUE_VIOLATION = "23505";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false as const, error: "Please sign in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false as const, error: "Admins only." };
  }
  return { ok: true as const, supabase, userId: user.id };
}

/** A cleaner (or admin) claims an open turnover for themselves. */
export async function claimTurnover(turnoverId: string): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { data: me } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", user.id)
    .maybeSingle();
  if (me && me.active === false) {
    return {
      ok: false,
      error: "Your account isn't active — ask Daniel to reactivate you.",
    };
  }

  const { error } = await supabase
    .from("turnover_assignments")
    .insert({ turnover_id: turnoverId, cleaner_id: user.id });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        error: "Someone just claimed this one — refresh to see who.",
      };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/schedule");
  return { ok: true };
}

/** Release a turnover you claimed. RLS limits this to your own row. */
export async function unclaimTurnover(
  turnoverId: string,
): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const { error } = await supabase
    .from("turnover_assignments")
    .delete()
    .eq("turnover_id", turnoverId)
    .eq("cleaner_id", user.id);

  if (error) return { ok: false, error: error.message };

  // Reopened — let the other cleaners know it's open, and the admins know it
  // lost coverage (matters most for last-minute releases).
  try {
    const { data: trow } = await supabase
      .from("turnovers")
      .select("turnover_date")
      .eq("id", turnoverId)
      .maybeSingle();
    const date = (trow?.turnover_date as string | undefined) ?? null;
    const { data: me } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const releasedByName = (me?.display_name as string | undefined) ?? "A cleaner";
    if (date) {
      const admin = createAdminClient();
      await notifyAvailable(admin, {
        turnoverId,
        date,
        excludeCleanerId: user.id,
      });
      await notifyAdminsReleased(admin, { turnoverId, date, releasedByName });
    }
  } catch (e) {
    console.error("release notice failed:", e);
  }

  revalidatePath("/schedule");
  return { ok: true };
}

/** Admin assigns (or reassigns) a turnover to a specific person. */
export async function assignTurnover(
  turnoverId: string,
  cleanerId: string,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  if (!cleanerId) return { ok: false, error: "Pick a cleaner." };

  // Who held it before + the date — for the notices below.
  const { data: existing } = await gate.supabase
    .from("turnover_assignments")
    .select("cleaner_id")
    .eq("turnover_id", turnoverId)
    .maybeSingle();
  const prevCleanerId = (existing?.cleaner_id as string | undefined) ?? null;
  const { data: trow } = await gate.supabase
    .from("turnovers")
    .select("turnover_date")
    .eq("id", turnoverId)
    .maybeSingle();
  const date = (trow?.turnover_date as string | undefined) ?? null;

  // Upsert on the unique turnover_id: insert if open, reassign if already held.
  const { error } = await gate.supabase
    .from("turnover_assignments")
    .upsert(
      {
        turnover_id: turnoverId,
        cleaner_id: cleanerId,
        claimed_at: new Date().toISOString(),
      },
      { onConflict: "turnover_id" },
    );
  if (error) return { ok: false, error: error.message };

  // Notify the affected cleaners (never the admin about their own action).
  // Best effort — a notice failure must not fail the assignment.
  if (date) {
    try {
      const admin = createAdminClient();
      if (cleanerId !== prevCleanerId && cleanerId !== gate.userId) {
        await notifyAssigned(admin, { turnoverId, date, cleanerId });
      }
      if (
        prevCleanerId &&
        prevCleanerId !== cleanerId &&
        prevCleanerId !== gate.userId
      ) {
        await notifyRemoved(admin, { turnoverId, date, cleanerId: prevCleanerId });
      }
    } catch (e) {
      console.error("assignment notice failed:", e);
    }
  }

  revalidatePath("/schedule");
  return { ok: true };
}

/** Admin clears an assignment, returning the turnover to the unclaimed pool. */
export async function unassignTurnover(
  turnoverId: string,
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  // Who held it + the date, before we clear it (for the notice).
  const { data: existing } = await gate.supabase
    .from("turnover_assignments")
    .select("cleaner_id")
    .eq("turnover_id", turnoverId)
    .maybeSingle();
  const prevCleanerId = (existing?.cleaner_id as string | undefined) ?? null;
  const { data: trow } = await gate.supabase
    .from("turnovers")
    .select("turnover_date")
    .eq("id", turnoverId)
    .maybeSingle();
  const date = (trow?.turnover_date as string | undefined) ?? null;

  const { error } = await gate.supabase
    .from("turnover_assignments")
    .delete()
    .eq("turnover_id", turnoverId);
  if (error) return { ok: false, error: error.message };

  if (date) {
    try {
      const admin = createAdminClient();
      if (prevCleanerId && prevCleanerId !== gate.userId) {
        await notifyRemoved(admin, {
          turnoverId,
          date,
          cleanerId: prevCleanerId,
        });
      }
      // Reopened — tell the other active cleaners it's up for grabs.
      await notifyAvailable(admin, {
        turnoverId,
        date,
        excludeCleanerId: prevCleanerId,
      });
    } catch (e) {
      console.error("unassign notice failed:", e);
    }
  }

  revalidatePath("/schedule");
  return { ok: true };
}

/** Admin creates a manual turnover for an off-Airbnb stay (friends/family). */
export async function createManualTurnover(input: {
  date: string;
  notes: string;
}): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const date = input.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Pick a valid date." };
  }

  const { error } = await gate.supabase.from("turnovers").insert({
    turnover_date: date,
    source: "manual",
    is_same_day: false,
    status: "scheduled",
    notes: input.notes.trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/schedule");
  return { ok: true };
}
