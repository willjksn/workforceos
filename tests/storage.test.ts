import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LocalStorageProvider } from "../lib/storage/local";

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
