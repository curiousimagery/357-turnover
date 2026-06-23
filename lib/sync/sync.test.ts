import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseIcal } from "./ical";
import {
  toReservations,
  deriveTurnovers,
  normalizeDate,
  extractReservationUrl,
} from "./derive";

// NOTE: this fixture is a faithful reconstruction from the spec (Section 2) —
// the Kaitlyn booking (Jun 22 -> 25) and the Aug 31 reservation-meets-block
// case. When the real tokenized feed is available we replace this file with the
// captured, sanitized summer-2026 feed; these same assertions must still hold.
const feed = readFileSync(
  fileURLToPath(new URL("./__fixtures__/summer-2026.ics", import.meta.url)),
  "utf8",
);

describe("parseIcal", () => {
  it("parses every VEVENT (incl. blocks) and unfolds wrapped lines", () => {
    const events = parseIcal(feed);
    expect(events.length).toBe(4);
    const k1 = events.find((e) => e.uid === "k1@airbnb.example");
    expect(k1?.summary).toBe("Reserved");
    // the folded DESCRIPTION line is rejoined
    expect(k1?.description).toContain("reservations/details/HMK1REDACTED");
  });

  it("never throws on empty or junk input", () => {
    expect(parseIcal("")).toEqual([]);
    expect(parseIcal("not an ical at all")).toEqual([]);
  });
});

describe("end-date normalization rule (load-bearing)", () => {
  it("turnover date equals the parsed DTEND — Kaitlyn is 2026-06-25, not 06-24", () => {
    const reservations = toReservations(parseIcal(feed));
    const kaitlyn = reservations.find((r) => r.uid === "k1@airbnb.example");
    expect(kaitlyn?.checkOut).toBe("2026-06-25");
    expect(kaitlyn?.checkIn).toBe("2026-06-22");
  });

  it("normalizeDate handles DATE and date-time and rejects garbage", () => {
    expect(normalizeDate("20260625")).toBe("2026-06-25");
    expect(normalizeDate("20260625T160000Z")).toBe("2026-06-25");
    expect(normalizeDate("nope")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});

describe("classification (reservations vs blocks, load-bearing)", () => {
  it("excludes 'Airbnb (Not available)' blocks from reservations", () => {
    const reservations = toReservations(parseIcal(feed));
    expect(reservations.length).toBe(3);
    expect(reservations.every((r) => r.rawSummary === "Reserved")).toBe(true);
    expect(
      reservations.find((r) => r.uid === "b1@airbnb.example"),
    ).toBeUndefined();
  });
});

describe("turnover derivation + same-day", () => {
  const turnovers = deriveTurnovers(toReservations(parseIcal(feed)));

  it("derives one turnover per reservation checkout (3)", () => {
    expect(turnovers.length).toBe(3);
  });

  it("Kaitlyn's Jun 25 turnover is SAME-DAY (next reservation checks in Jun 25)", () => {
    const t = turnovers.find((t) => t.turnoverDate === "2026-06-25");
    expect(t?.isSameDay).toBe(true);
  });

  it("Aug 31 is RELAXED — a six-week block starts Aug 31, but blocks don't count", () => {
    const t = turnovers.find((t) => t.turnoverDate === "2026-08-31");
    expect(t).toBeDefined();
    expect(t?.isSameDay).toBe(false);
  });

  it("never derives a turnover from a block (block end Oct 12 is not a turnover)", () => {
    expect(
      turnovers.find((t) => t.turnoverDate === "2026-10-12"),
    ).toBeUndefined();
  });
});

describe("reservation URL + guest phone handling", () => {
  it("extracts the admin-only reservation URL", () => {
    const reservations = toReservations(parseIcal(feed));
    const k1 = reservations.find((r) => r.uid === "k1@airbnb.example");
    expect(k1?.reservationUrl).toMatch(
      /^https:\/\/www\.airbnb\.com\/hosting\/reservations\/details\/HMK1REDACTED$/,
    );
  });

  it("deliberately drops the guest phone last-4 (never stored on a reservation)", () => {
    const reservations = toReservations(parseIcal(feed));
    const k1 = reservations.find((r) => r.uid === "k1@airbnb.example");
    expect(JSON.stringify(k1)).not.toContain("1234");
  });

  it("extractReservationUrl is null-safe", () => {
    expect(extractReservationUrl(null)).toBeNull();
    expect(extractReservationUrl("no url here")).toBeNull();
  });
});
