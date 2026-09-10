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

describe("AI capability-class env", () => {
  it("accepts AI_MODEL_FAST / STANDARD / REASONING / EMBEDDING", () => {
    vi.stubEnv("AI_MODEL_FAST", "fast-one");
    vi.stubEnv("AI_MODEL_STANDARD", "standard-one");
    vi.stubEnv("AI_MODEL_REASONING", "reasoning-one");
    vi.stubEnv("AI_MODEL_EMBEDDING", "embedding-one");
    resetServerEnvCache();
    const env = getServerEnv();
    expect(env.AI_MODEL_FAST).toBe("fast-one");
    expect(env.AI_MODEL_STANDARD).toBe("standard-one");
    expect(env.AI_MODEL_REASONING).toBe("reasoning-one");
    expect(env.AI_MODEL_EMBEDDING).toBe("embedding-one");
  });

  it("accepts optional Gemini availability-fallback vars without Anthropic or NEXT_PUBLIC_AI", () => {
    vi.stubEnv("AI_FALLBACK_PROVIDER", "gemini");
    vi.stubEnv("AI_FALLBACK_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("AI_FALLBACK_BASE_URL", "https://example.test/openai");
    vi.stubEnv("AI_MODEL_FAST_FALLBACK", "fast-fallback");
    vi.stubEnv("AI_MODEL_STANDARD_FALLBACK", "standard-fallback");
    vi.stubEnv("AI_MODEL_REASONING_FALLBACK", "reasoning-fallback");
    resetServerEnvCache();
    const env = getServerEnv();
    expect(env.AI_FALLBACK_PROVIDER).toBe("gemini");
    expect(env.AI_FALLBACK_ENABLED).toBe("true");
    expect(env.GEMINI_API_KEY).toBe("gemini-test-key");
    expect(env.AI_FALLBACK_BASE_URL).toBe("https://example.test/openai");
    expect(env.AI_MODEL_FAST_FALLBACK).toBe("fast-fallback");
    expect(env.AI_MODEL_STANDARD_FALLBACK).toBe("standard-fallback");
    expect(env.AI_MODEL_REASONING_FALLBACK).toBe("reasoning-fallback");
    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(Object.keys(env).some((key) => key.startsWith("NEXT_PUBLIC_AI_"))).toBe(false);
  });
});

describe("storage provider env", () => {
  it("accepts STORAGE_PROVIDER=s3 when PowerShell appended an escaped CRLF", () => {
    vi.stubEnv("STORAGE_PROVIDER", "s3\\r\\n");
    resetServerEnvCache();
    expect(getServerEnv().STORAGE_PROVIDER).toBe("s3");
  });
});
