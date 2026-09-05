import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppUrl, resetServerEnvCache } from "../lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

describe("app URL", () => {
  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.example.test/");
    resetServerEnvCache();
    expect(getAppUrl()).toBe("https://preview.example.test");
  });

  it("falls back to localhost outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    resetServerEnvCache();
    expect(getAppUrl()).toBe("http://localhost:3000");
  });
});
