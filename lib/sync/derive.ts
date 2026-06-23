/**
 * Turn parsed iCal events into reservations and then into the desired turnover
 * state. This is the load-bearing logic the spec insists we test (Section 2,
 * 3.3, 7.2). All pure — no I/O, no database.
 *
 * Load-bearing rules encoded here:
 *  - DTEND is the checkout date; the turnover date equals it (never minus a day).
 *  - Classify by SUMMARY: only `Reserved` events are reservations. Blocks
 *    (`Airbnb (Not available)`) are excluded from derivation AND same-day.
 *  - same-day = some *reservation* checks in on this turnover's checkout date.
 */
import type { IcalEvent } from "./ical";

export const RESERVATION_SUMMARY = "Reserved";

export type Reservation = {
  uid: string;
  checkIn: string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD'
  reservationUrl: string | null;
  confirmationCode: string | null; // Airbnb code from the reservation URL
  rawSummary: string;
};

export type DerivedTurnover = {
  turnoverDate: string; // 'YYYY-MM-DD', equals the reservation checkout
  bookingUid: string; // the reservation whose checkout creates it
  isSameDay: boolean;
  confirmationCode: string | null; // rides along for display on the card
};

export function isReservation(event: IcalEvent): boolean {
  return (event.summary ?? "").trim() === RESERVATION_SUMMARY;
}

/** Normalize an iCal date/date-time value to 'YYYY-MM-DD'. Feed dates are
 *  date-only / floating; we keep the calendar day and interpret it in property
 *  local time elsewhere. Returns null if it can't be parsed. */
export function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) {
    return null;
  }
  return `${y}-${mo}-${d}`;
}

/** Pull the reservation URL out of DESCRIPTION (admin-only click-through). The
 *  feed also carries a guest phone last-4, which we deliberately never read. */
export function extractReservationUrl(
  description: string | null,
): string | null {
  if (!description) return null;
  const m = description.match(/https?:\/\/[^\s]*airbnb\.[^\s]+/i);
  return m ? m[0].replace(/[).,]+$/, "") : null;
}

/** The Airbnb confirmation code — the last path segment of the reservation URL
 *  (e.g. .../details/HMABC123 -> 'HMABC123'). It's the host-side booking
 *  reference, handy for cross-checking in Airbnb. Null-safe. */
export function extractConfirmationCode(
  reservationUrl: string | null,
): string | null {
  if (!reservationUrl) return null;
  const afterDetails = reservationUrl.match(/\/details\/([A-Za-z0-9]+)/);
  if (afterDetails) return afterDetails[1];
  const tail = reservationUrl.split(/[?#]/)[0].split("/").filter(Boolean).pop();
  return tail && /^[A-Za-z0-9]{4,}$/.test(tail) ? tail : null;
}

/** Reservations only (blocks excluded), with malformed events skipped. */
export function toReservations(events: IcalEvent[]): Reservation[] {
  const reservations: Reservation[] = [];
  for (const event of events) {
    if (!isReservation(event)) continue; // exclude blocks — load-bearing
    const checkIn = normalizeDate(event.dtStart);
    const checkOut = normalizeDate(event.dtEnd); // DTEND = checkout, no minus-a-day
    if (!event.uid || !checkIn || !checkOut) continue; // defensive: skip malformed
    const reservationUrl = extractReservationUrl(event.description);
    reservations.push({
      uid: event.uid,
      checkIn,
      checkOut,
      reservationUrl,
      confirmationCode: extractConfirmationCode(reservationUrl),
      rawSummary: event.summary ?? RESERVATION_SUMMARY,
    });
  }
  return reservations;
}

/** Desired turnovers: one per reservation checkout, with same-day recomputed.
 *  same-day considers reservation check-ins only — never blocks. */
export function deriveTurnovers(
  reservations: Reservation[],
): DerivedTurnover[] {
  const reservationCheckIns = new Set(reservations.map((r) => r.checkIn));
  const byUid = new Map<string, DerivedTurnover>();
  for (const r of reservations) {
    byUid.set(r.uid, {
      turnoverDate: r.checkOut,
      bookingUid: r.uid,
      isSameDay: reservationCheckIns.has(r.checkOut),
      confirmationCode: r.confirmationCode,
    });
  }
  return [...byUid.values()];
}
