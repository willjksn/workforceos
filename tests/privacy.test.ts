import { describe, expect, it } from "vitest";

import { candidatePrivacyClass, isRestrictedPii } from "../lib/privacy/classification";

describe("privacy classification", () => {
  it("classifies candidates as Restricted PII", () => {
    expect(candidatePrivacyClass()).toBe("restricted_pii");
    expect(isRestrictedPii("restricted_pii")).toBe(true);
    expect(isRestrictedPii("internal")).toBe(false);
  });
});
