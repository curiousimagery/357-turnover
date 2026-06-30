import { describe, it, expect } from "vitest";

import {
  onBedsByType,
  deriveLocations,
  type LinenType,
  type Holding,
} from "./derive";

const sheetA: LinenType = { id: "sa", kind: "sheet_set", label: "White IKEA queen", count: 4 };
const duvetA: LinenType = { id: "da", kind: "duvet_set", label: "Terracotta linen", count: 2 };

describe("onBedsByType", () => {
  it("counts a type once per slot it fills across both beds", () => {
    const counts = onBedsByType([
      { bed: 1, sheetTypeId: "sa", duvetTypeId: "da" },
      { bed: 2, sheetTypeId: "sa", duvetTypeId: "da" },
    ]);
    expect(counts.get("sa")).toBe(2);
    expect(counts.get("da")).toBe(2);
  });

  it("ignores empty slots", () => {
    const counts = onBedsByType([{ bed: 1, sheetTypeId: "sa", duvetTypeId: null }]);
    expect(counts.get("sa")).toBe(1);
    expect(counts.has("da")).toBe(false);
  });
});

describe("deriveLocations", () => {
  it("splits the owned count across beds / cleaner / closet", () => {
    const beds = [
      { bed: 1, sheetTypeId: "sa", duvetTypeId: "da" },
      { bed: 2, sheetTypeId: "sa", duvetTypeId: "da" },
    ];
    const holdings: Holding[] = [
      { typeId: "sa", holderId: "avery", holderName: "Avery", qty: 1 },
    ];
    const [sheet, duvet] = deriveLocations([sheetA, duvetA], beds, holdings);

    // 4 owned − 2 on beds − 1 with cleaner = 1 in the closet.
    expect(sheet).toMatchObject({ onBeds: 2, withCleaner: 1, closet: 1 });
    expect(sheet.holders).toEqual([{ holderId: "avery", holderName: "Avery", qty: 1 }]);

    // duvet: 2 owned − 2 on beds − 0 = 0 in the closet.
    expect(duvet).toMatchObject({ onBeds: 2, withCleaner: 0, closet: 0 });
    expect(duvet.holders).toEqual([]);
  });

  it("floors closet at 0 when records temporarily over-count", () => {
    const beds = [
      { bed: 1, sheetTypeId: "sa", duvetTypeId: null },
      { bed: 2, sheetTypeId: "sa", duvetTypeId: null },
    ];
    const holdings: Holding[] = [
      { typeId: "sa", holderId: "avery", holderName: "Avery", qty: 3 },
    ];
    // 4 − 2 − 3 = −1 → clamped to 0.
    expect(deriveLocations([sheetA], beds, holdings)[0].closet).toBe(0);
  });

  it("sums multiple holders of the same type", () => {
    const holdings: Holding[] = [
      { typeId: "sa", holderId: "avery", holderName: "Avery", qty: 1 },
      { typeId: "sa", holderId: "daniel", holderName: "Daniel", qty: 2 },
    ];
    const [sheet] = deriveLocations([sheetA], [], holdings);
    expect(sheet.withCleaner).toBe(3);
    expect(sheet.holders).toHaveLength(2);
    expect(sheet.closet).toBe(1); // 4 − 0 − 3
  });
});
