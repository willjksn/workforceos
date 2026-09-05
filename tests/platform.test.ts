import { describe, expect, it } from "vitest";

import { getIntegrationHubStatus, INTEGRATION_PROVIDERS } from "../lib/integrations/hub";
import { hashContent } from "../lib/search/semantic";

describe("integration hub and search helpers", () => {
  it("lists placeholder providers as not configured", async () => {
    const status = await getIntegrationHubStatus();
    expect(status.length).toBe(INTEGRATION_PROVIDERS.length);
    expect(status.some((item) => item.provider === "bls")).toBe(true);
    expect(status.some((item) => item.provider === "census")).toBe(true);
    expect(status.every((item) => item.connectionHealth === "not_configured")).toBe(true);
  });

  it("hashes semantic document content deterministically", () => {
    expect(hashContent("alpha")).toBe(hashContent("alpha"));
    expect(hashContent("alpha")).not.toBe(hashContent("beta"));
  });
});
