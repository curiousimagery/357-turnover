/**
 * Minimal, defensive iCal (.ics) parser for the Airbnb feed.
 * Dependency-free and pure so it can be unit-tested against the captured feed
 * fixture (spec Section 7.2). It extracts only what we need from each VEVENT.
 */
export type IcalEvent = {
  uid: string | null;
  summary: string | null;
  /** raw value, e.g. "20260625" (DATE) or "20260625T160000Z" */
  dtStart: string | null;
  dtEnd: string | null;
  description: string | null;
};

/** RFC 5545 line unfolding: a CRLF (or LF) followed by a space/tab continues
 *  the previous line. */
function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

/** Unescape the few sequences iCal escapes inside text values. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function parseIcal(text: string): IcalEvent[] {
  if (!text) return [];
  const lines = unfold(text).split(/\r?\n/);
  const events: IcalEvent[] = [];
  let current: IcalEvent | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {
        uid: null,
        summary: null,
        dtStart: null,
        dtEnd: null,
        description: null,
      };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const left = line.slice(0, colon); // name plus any params, e.g. DTSTART;VALUE=DATE
    const value = line.slice(colon + 1);
    const name = left.split(";")[0].toUpperCase();

    switch (name) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeText(value).trim();
        break;
      case "DTSTART":
        current.dtStart = value.trim();
        break;
      case "DTEND":
        current.dtEnd = value.trim();
        break;
      case "DESCRIPTION":
        current.description = unescapeText(value);
        break;
      default:
        break;
    }
  }

  return events;
}
