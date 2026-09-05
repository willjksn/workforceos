import { describe, expect, it } from "vitest";

import {
  classifyOpportunityScore,
  effectiveOpportunityScore,
  totalOpportunityScore,
} from "../lib/crm/scoring";

describe("opportunity scoring", () => {
  it("totals the approved 100-point model", () => {
    expect(
      totalOpportunityScore({
        icpFit: 20,
        triggerScore: 25,
        demonstratedPain: 20,
        serviceFit: 15,
        buyerAccess: 10,
        timingBudget: 10,
      }),
    ).toBe(100);
  });

  it("classifies bands from the stored total", () => {
    expect(classifyOpportunityScore(80)).toBe("priority");
    expect(classifyOpportunityScore(65)).toBe("active_qualified");
    expect(classifyOpportunityScore(50)).toBe("nurture");
    expect(classifyOpportunityScore(49)).toBe("monitor");
  });

  it("uses a human override instead of the calculated total", () => {
    expect(effectiveOpportunityScore(40, 82)).toBe(82);
    expect(effectiveOpportunityScore(40, null)).toBe(40);
  });
});
