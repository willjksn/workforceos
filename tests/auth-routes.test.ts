import { describe, expect, it } from "vitest";

import { isPublicPath, PROTECTED_ROUTE_SAMPLES } from "../lib/auth/public-paths";

describe("route protection", () => {
  it("allows public marketing and auth paths", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/sign-in")).toBe(true);
    expect(isPublicPath("/sign-in/sso-callback")).toBe(true);
    expect(isPublicPath("/sign-up")).toBe(true);
    expect(isPublicPath("/api/inngest")).toBe(true);
  });

  it("requires authentication for internal operating routes", () => {
    for (const path of PROTECTED_ROUTE_SAMPLES) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});
