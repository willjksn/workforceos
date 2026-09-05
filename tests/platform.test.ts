import { describe, expect, it } from "vitest";

import { getIntegrationHubStatus } from "../lib/integrations/hub";
import { hashContent } from "../lib/search/semantic";

describe("integration hub and search helpers", () => {
  it("lists placeholder providers as not configured", async () => {
    const status = await getIntegrationHubStatus();
    expect(status.length).toBe(10);
    expect(status.every((item) => item.connectionHealth === "not_configured")).toBe(true);
  });

  it("hashes semantic document content deterministically", () => {
    expect(hashContent("alpha")).toBe(hashContent("alpha"));
    expect(hashContent("alpha")).not.toBe(hashContent("beta"));
  });
});
