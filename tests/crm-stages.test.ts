import { describe, expect, it } from "vitest";

import { isClosedOpportunityStage, isOpenOpportunityStage, OPPORTUNITY_STAGES } from "../lib/crm/stages";

describe("opportunity stages", () => {
  it("keeps launch pipeline stages distinct from closed outcomes", () => {
    expect(OPPORTUNITY_STAGES).toContain("target");
    expect(OPPORTUNITY_STAGES).toContain("discovery_scheduled");
    expect(isOpenOpportunityStage("qualified")).toBe(true);
    expect(isClosedOpportunityStage("won")).toBe(true);
    expect(isOpenOpportunityStage("won")).toBe(false);
  });
});
