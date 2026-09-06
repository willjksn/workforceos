import { describe, expect, it } from "vitest";

import { normalizeGlobalSearchQuery } from "../lib/search/global";

describe("WorkforceOS header search", () => {
  it("ignores empty and one-character queries", () => {
    expect(normalizeGlobalSearchQuery("")).toBeNull();
    expect(normalizeGlobalSearchQuery("a")).toBeNull();
    expect(normalizeGlobalSearchQuery(" % ")).toBeNull();
  });

  it("keeps a sanitized two-character query", () => {
    expect(normalizeGlobalSearchQuery("  EM  ")).toBe("EM");
    expect(normalizeGlobalSearchQuery("Harbor%")).toBe("Harbor");
  });
});
