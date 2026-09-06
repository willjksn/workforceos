import { describe, expect, it } from "vitest";

import { daysBetween, daysUntil } from "../lib/skillbridge/rules";

describe("SkillBridge calendar-day rules", () => {
  it("treats window start today as zero remaining days in UTC", () => {
    const now = new Date("2028-02-29T18:00:00.000Z");
    const start = new Date("2028-02-29T00:00:00.000Z");
    expect(daysUntil(start, now)).toBe(0);
  });

  it("counts tomorrow as one day remaining across a late UTC clock", () => {
    const now = new Date("2028-02-28T23:30:00.000Z");
    const start = new Date("2028-02-29T00:00:00.000Z");
    expect(daysUntil(start, now)).toBe(1);
  });

  it("counts a window that ended yesterday as -1", () => {
    const now = new Date("2028-03-01T08:00:00.000Z");
    const ended = new Date("2028-02-29T00:00:00.000Z");
    expect(daysUntil(ended, now)).toBe(-1);
  });

  it("keeps 30/60/90/180 day horizons on calendar days", () => {
    const from = new Date("2028-01-01T12:00:00.000Z");
    expect(daysUntil(new Date("2028-01-31T00:00:00.000Z"), from)).toBe(30);
    expect(daysUntil(new Date("2028-03-01T00:00:00.000Z"), from)).toBe(60);
    expect(daysUntil(new Date("2028-03-31T00:00:00.000Z"), from)).toBe(90);
    expect(daysUntil(new Date("2028-06-29T00:00:00.000Z"), from)).toBe(180);
  });

  it("does not depend on millisecond rounding for same calendar day", () => {
    const morning = new Date("2028-06-01T00:01:00.000Z");
    const evening = new Date("2028-06-01T23:59:00.000Z");
    expect(daysBetween(morning, evening)).toBe(0);
  });
});
