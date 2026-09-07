import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppUrl, getServerEnv, isFailClosedProduction, resetServerEnvCache } from "../lib/env";

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

describe("fail-closed production", () => {
  it("treats Vercel production as fail-closed even when NODE_ENV is unset in the helper", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    resetServerEnvCache();
    expect(isFailClosedProduction()).toBe(true);
  });

  it("does not treat Vercel preview as fail-closed despite NODE_ENV=production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    resetServerEnvCache();
    expect(isFailClosedProduction()).toBe(false);
  });

  it("treats NODE_ENV=production as fail-closed when VERCEL_ENV is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    resetServerEnvCache();
    expect(isFailClosedProduction()).toBe(true);
  });
});

describe("storage provider env", () => {
  it("accepts STORAGE_PROVIDER=s3 when PowerShell appended an escaped CRLF", () => {
    vi.stubEnv("STORAGE_PROVIDER", "s3\\r\\n");
    resetServerEnvCache();
    expect(getServerEnv().STORAGE_PROVIDER).toBe("s3");
  });
});
