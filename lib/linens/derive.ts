/**
 * Pure linen-location math (the load-bearing bit of the linen subsystem). The
 * tables store raw facts — how many of each type we own, what's on the beds (the
 * latest closeout), and what each person has out to wash. The *locations* a user
 * sees are derived from those, so they always reconcile to the owned count. No
 * low-stock warnings — counts only. Kept pure so it's unit-tested without a DB.
 */

export type LinenKind = "sheet_set" | "duvet_set";

export type LinenType = {
  id: string;
  kind: LinenKind;
  label: string;
  /** How many of this type we own. */
  count: number;
};

/** One bed's recorded linens (from a turnover's closeout). */
export type BedLinen = {
  bed: number;
  sheetTypeId: string | null;
  duvetTypeId: string | null;
};

/** What one person currently has out to wash, per type. */
export type Holding = {
  typeId: string;
  holderId: string;
  holderName: string;
  qty: number;
};

export type LinenLocation = {
  type: LinenType;
  onBeds: number;
  withCleaner: number;
  closet: number;
  /** Who has this type out, for the breakdown. */
  holders: { holderId: string; holderName: string; qty: number }[];
};

/**
 * How many sets of each type sit on the beds, from a set of bed records (the
 * latest turnover's two beds). A type counts once per slot it fills, so a type
 * used as the sheet on both beds reads as 2.
 */
export function onBedsByType(beds: BedLinen[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (id: string | null) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  for (const b of beds) {
    bump(b.sheetTypeId);
    bump(b.duvetTypeId);
  }
  return counts;
}

/**
 * Derive each type's three locations: on the beds (latest closeout), out with a
 * cleaner (summed holdings), and the closet (the remainder of the owned count).
 * Closet is floored at 0 so a temporarily-inconsistent record can't read
 * negative; locations always sum to at most the owned count.
 */
export function deriveLocations(
  types: LinenType[],
  latestBeds: BedLinen[],
  holdings: Holding[],
): LinenLocation[] {
  const onBeds = onBedsByType(latestBeds);
  const withCleaner = new Map<string, number>();
  const holdersByType = new Map<string, Holding[]>();
  for (const h of holdings) {
    if (h.qty <= 0) continue;
    withCleaner.set(h.typeId, (withCleaner.get(h.typeId) ?? 0) + h.qty);
    const list = holdersByType.get(h.typeId) ?? [];
    list.push(h);
    holdersByType.set(h.typeId, list);
  }
  return types.map((type) => {
    const ob = onBeds.get(type.id) ?? 0;
    const wc = withCleaner.get(type.id) ?? 0;
    return {
      type,
      onBeds: ob,
      withCleaner: wc,
      closet: Math.max(0, type.count - ob - wc),
      holders: (holdersByType.get(type.id) ?? []).map((h) => ({
        holderId: h.holderId,
        holderName: h.holderName,
        qty: h.qty,
      })),
    };
  });
}
