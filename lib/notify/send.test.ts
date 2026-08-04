import { describe, it, expect } from "vitest";

import { isValidSender } from "./send";

describe("isValidSender", () => {
  it("accepts a bare email and a Name <email> sender", () => {
    expect(isValidSender("noreply@mail.curiousimagery.com")).toBe(true);
    expect(isValidSender("357 Oasis Turnovers <noreply@mail.curiousimagery.com>")).toBe(true);
  });

  it("rejects the values that took email down", () => {
    expect(isValidSender("mail.curiousimagery.com")).toBe(false); // bare domain (the real bug)
    expect(isValidSender("")).toBe(false);
    expect(isValidSender("357 Oasis Turnovers noreply@mail.curiousimagery.com")).toBe(false); // no < >
    expect(isValidSender("357 Oasis Turnovers <noreply@mail.curiousimage")).toBe(false); // truncated
  });
});
