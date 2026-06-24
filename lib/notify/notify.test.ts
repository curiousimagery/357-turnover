import { describe, it, expect } from "vitest";

import { deriveNotifications, type TurnoverChange } from "./derive";

const CLEANERS = ["avery", "jordan", "riley"];

describe("deriveNotifications — new turnover", () => {
  it("tells every active cleaner a date is open", () => {
    const changes: TurnoverChange[] = [
      { turnoverId: "t1", kind: "new", date: "2026-07-10" },
    ];
    const out = deriveNotifications(changes, CLEANERS);
    expect(out).toHaveLength(3);
    expect(out.every((n) => n.type === "new")).toBe(true);
    expect(new Set(out.map((n) => n.recipientId))).toEqual(new Set(CLEANERS));
    expect(out[0].body).toContain("2026-07-10");
  });
});

describe("deriveNotifications — cancelled", () => {
  it("notifies only the cleaner who had it", () => {
    const out = deriveNotifications(
      [{ turnoverId: "t1", kind: "cancelled", date: "2026-07-10", assigneeId: "jordan" }],
      CLEANERS,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ recipientId: "jordan", type: "cancelled" });
  });

  it("stays quiet when the cancelled turnover was unclaimed", () => {
    const out = deriveNotifications(
      [{ turnoverId: "t1", kind: "cancelled", date: "2026-07-10", assigneeId: null }],
      CLEANERS,
    );
    expect(out).toHaveLength(0);
  });
});

describe("deriveNotifications — date changed", () => {
  it("tells the prior claimer it moved, and everyone else it's open", () => {
    const out = deriveNotifications(
      [
        {
          turnoverId: "t1",
          kind: "date_changed",
          date: "2026-07-12",
          previousDate: "2026-07-10",
          assigneeId: "avery",
        },
      ],
      CLEANERS,
    );
    // avery gets the "moved" note; jordan + riley get "available"
    expect(out).toHaveLength(3);
    const avery = out.find((n) => n.recipientId === "avery");
    expect(avery?.body).toContain("2026-07-10");
    expect(avery?.body).toContain("2026-07-12");
    const others = out.filter((n) => n.recipientId !== "avery");
    expect(others.map((n) => n.recipientId).sort()).toEqual(["jordan", "riley"]);
  });
});

describe("deriveNotifications — relaxed → same-day flip (high priority)", () => {
  it("warns the assigned cleaner", () => {
    const out = deriveNotifications(
      [{ turnoverId: "t1", kind: "became_same_day", date: "2026-07-10", assigneeId: "riley" }],
      CLEANERS,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ recipientId: "riley", type: "became_same_day" });
    expect(out[0].body.toLowerCase()).toContain("same-day");
  });

  it("no-op if nobody is assigned yet", () => {
    const out = deriveNotifications(
      [{ turnoverId: "t1", kind: "became_same_day", date: "2026-07-10", assigneeId: null }],
      CLEANERS,
    );
    expect(out).toHaveLength(0);
  });
});

describe("deriveNotifications — idempotency / dedupe", () => {
  it("produces stable dedupe keys and collapses duplicates in one run", () => {
    const change: TurnoverChange = { turnoverId: "t1", kind: "new", date: "2026-07-10" };
    const once = deriveNotifications([change], CLEANERS);
    const twice = deriveNotifications([change, change], CLEANERS);
    // the same change twice must not double up — keys are identical
    expect(twice).toHaveLength(once.length);
    expect(new Set(twice.map((n) => n.dedupeKey)).size).toBe(twice.length);
  });
});
