import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { resetServerEnvCache } from "../lib/env";
import { getStorageProvider } from "../lib/storage";
import { LocalStorageProvider } from "../lib/storage/local";
import { UnconfiguredStorageProvider } from "../lib/storage/unconfigured";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

describe("local storage adapter", () => {
  it("uploads and retrieves a development file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "wfos-storage-"));
    const storage = new LocalStorageProvider(dir);
    const key = "tests/hello.txt";
    const body = new TextEncoder().encode("hello-workforceos");
    await storage.upload({
      key,
      body,
      mimeType: "text/plain",
      filename: "hello.txt",
    });
    const downloaded = await storage.download(key);
    expect(new TextDecoder().decode(downloaded)).toBe("hello-workforceos");
    const meta = await storage.metadata(key);
    expect(meta?.sizeBytes).toBe(body.byteLength);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("production storage fallback", () => {
  it("does not use the local disk adapter in production when S3 is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORAGE_PROVIDER", "local");
    resetServerEnvCache();
    const provider = getStorageProvider();
    expect(provider).toBeInstanceOf(UnconfiguredStorageProvider);
    expect(provider.name).toBe("unconfigured");
  });
});
