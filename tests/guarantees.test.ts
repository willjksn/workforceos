import { describe, expect, it } from "vitest";

import { guaranteeDates, guaranteeStatusOn, placementFeeFromTerms } from "../lib/recruiting/guarantees";

describe("placement guarantees", () => {
  it("calculates guarantee dates from agreement days", () => {
    const window = guaranteeDates(new Date("2026-09-15T12:00:00.000Z"), 90);
    expect(window.startsOn.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(window.endsOn.toISOString().slice(0, 10)).toBe("2026-12-14");
  });

  it("refuses invented guarantee terms", () => {
    expect(() => guaranteeDates(new Date("2026-09-15T00:00:00.000Z"), 0)).toThrow(/search agreement/);
  });

  it("computes fee from salary and percent when amount is absent", () => {
    expect(placementFeeFromTerms({ startingSalary: 82000, feePercent: 25 })).toBe(20500);
  });

  it("marks a window expiring soon", () => {
    expect(guaranteeStatusOn(new Date("2026-09-10T00:00:00.000Z"), new Date("2026-09-05T00:00:00.000Z"))).toBe(
      "expiring_soon",
    );
  });
});
