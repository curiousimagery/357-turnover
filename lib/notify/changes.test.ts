import { describe, it, expect } from "vitest";

import { detectTurnoverChanges, type TurnoverState } from "./changes";

const noAssignees = new Map<string, string | null>();

function state(
  id: string,
  bookingOutId: string,
  date: string,
  isSameDay = false,
): TurnoverState {
  return { id, bookingOutId, date, isSameDay };
}

describe("detectTurnoverChanges", () => {
  it("flags a brand-new turnover", () => {
    const { changes } = detectTurnoverChanges({
      before: [],
      after: [state("t1", "b1", "2026-07-10")],
      assigneeByTurnoverId: noAssignees,
      cancelledBookingIds: [],
    });
    expect(changes).toEqual([
      { turnoverId: "t1", kind: "new", date: "2026-07-10", assigneeId: null },
    ]);
  });

  it("flags a moved checkout date and releases the claim", () => {
    const { changes, releaseTurnoverIds } = detectTurnoverChanges({
      before: [state("t1", "b1", "2026-07-10")],
      after: [state("t1", "b1", "2026-07-12")],
      assigneeByTurnoverId: new Map([["t1", "avery"]]),
      cancelledBookingIds: [],
    });
    expect(changes).toEqual([
      {
        turnoverId: "t1",
        kind: "date_changed",
        date: "2026-07-12",
        previousDate: "2026-07-10",
        assigneeId: "avery",
      },
    ]);
    expect(releaseTurnoverIds).toEqual(["t1"]);
  });

  it("a moved date with no claim notifies but releases nothing", () => {
    const { changes, releaseTurnoverIds } = detectTurnoverChanges({
      before: [state("t1", "b1", "2026-07-10")],
      after: [state("t1", "b1", "2026-07-12")],
      assigneeByTurnoverId: noAssignees,
      cancelledBookingIds: [],
    });
    expect(changes[0]).toMatchObject({ kind: "date_changed", assigneeId: null });
    expect(releaseTurnoverIds).toEqual([]);
  });

  it("flags a relaxed -> same-day flip", () => {
    const { changes } = detectTurnoverChanges({
      before: [state("t1", "b1", "2026-07-10", false)],
      after: [state("t1", "b1", "2026-07-10", true)],
      assigneeByTurnoverId: new Map([["t1", "riley"]]),
      cancelledBookingIds: [],
    });
    expect(changes).toEqual([
      {
        turnoverId: "t1",
        kind: "became_same_day",
        date: "2026-07-10",
        assigneeId: "riley",
      },
    ]);
  });

  it("emits nothing when nothing changed", () => {
    const { changes, releaseTurnoverIds } = detectTurnoverChanges({
      before: [state("t1", "b1", "2026-07-10", true)],
      after: [state("t1", "b1", "2026-07-10", true)],
      assigneeByTurnoverId: new Map([["t1", "avery"]]),
      cancelledBookingIds: [],
    });
    expect(changes).toEqual([]);
    expect(releaseTurnoverIds).toEqual([]);
  });

  it("flags a cancellation once (not also as a date/new change)", () => {
    // After a cancel, the turnover row still exists with the same booking id.
    const { changes } = detectTurnoverChanges({
      before: [state("t1", "b1", "2026-07-10")],
      after: [state("t1", "b1", "2026-07-10")],
      assigneeByTurnoverId: new Map([["t1", "jordan"]]),
      cancelledBookingIds: ["b1"],
    });
    expect(changes).toEqual([
      { turnoverId: "t1", kind: "cancelled", date: "2026-07-10", assigneeId: "jordan" },
    ]);
  });
});
