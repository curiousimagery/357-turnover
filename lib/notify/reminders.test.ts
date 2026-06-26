import { describe, it, expect } from "vitest";

import { planReminders, addDaysIso, type ClaimedTurnover } from "./reminders";

describe("planReminders", () => {
  it("one reminder per claim, deduped per (turnover, cleaner)", () => {
    const claimed: ClaimedTurnover[] = [
      { turnoverId: "t1", date: "2026-07-10", isSameDay: false, cleanerId: "avery" },
    ];
    const out = planReminders(claimed);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ recipientId: "avery", turnoverId: "t1" });
    expect(out[0].dedupeKey).toBe("reminder:t1:avery");
    expect(out[0].body).toContain("Jul 10, 2026");
  });

  it("calls out same-day turnovers", () => {
    const out = planReminders([
      { turnoverId: "t2", date: "2026-07-11", isSameDay: true, cleanerId: "riley" },
    ]);
    expect(out[0].body.toLowerCase()).toContain("same-day");
  });
});

describe("addDaysIso", () => {
  it("adds days across a month boundary", () => {
    expect(addDaysIso("2026-07-30", 2)).toBe("2026-08-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });
});
