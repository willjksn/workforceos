import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { resetServerEnvCache } from "../lib/env";
import { getStorageProvider, getStorageStatus } from "../lib/storage";
import { objectKeyPrefix } from "../lib/storage/diagnostics";
import { LocalStorageProvider } from "../lib/storage/local";
import { S3CompatibleStorageProvider } from "../lib/storage/s3-compatible";
import { UnconfiguredStorageProvider } from "../lib/storage/unconfigured";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

function fakePdf() {
  return new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
}

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

  it("round-trips a generated PDF locally", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "wfos-pdf-"));
    const storage = new LocalStorageProvider(dir);
    const key = "diagnostics/storage-verify/fake-resume.pdf";
    const body = fakePdf();
    await storage.upload({
      key,
      body,
      mimeType: "application/pdf",
      filename: "fake-resume.pdf",
    });
    const meta = await storage.metadata(key);
    expect(meta?.sizeBytes).toBe(body.byteLength);
    const downloaded = await storage.download(key);
    expect(downloaded).toEqual(body);
    const signed = await storage.getSignedUrl(key);
    expect(signed.startsWith("local://")).toBe(true);
    await storage.delete(key);
    expect(await storage.metadata(key)).toBeNull();
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

  it("does not use local storage when VERCEL_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STORAGE_PROVIDER", "");
    resetServerEnvCache();
    const provider = getStorageProvider();
    expect(provider).toBeInstanceOf(UnconfiguredStorageProvider);
  });

  it("rejects s3 uploads when the endpoint is missing", async () => {
    const storage = new S3CompatibleStorageProvider({
      bucket: "pierone-resumes",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });
    await expect(
      storage.upload({
        key: "diagnostics/storage-verify/resume.pdf",
        body: fakePdf(),
        mimeType: "application/pdf",
        filename: "resume.pdf",
      }),
    ).rejects.toThrow(/storage is not configured/i);
  });

  it("rejects unconfigured production uploads", async () => {
    const storage = new UnconfiguredStorageProvider();
    await expect(
      storage.upload({
        key: "applications/org/candidate/resume.pdf",
        body: fakePdf(),
        mimeType: "application/pdf",
        filename: "resume.pdf",
      }),
    ).rejects.toThrow(/storage is not configured/i);
  });
});

describe("storage status", () => {
  it("is not ready when s3 is selected without an endpoint or credentials", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORAGE_PROVIDER", "s3");
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("S3_ENDPOINT", "");
    vi.stubEnv("S3_ACCESS_KEY_ID", "");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "");
    resetServerEnvCache();
    const status = await getStorageStatus();
    expect(status.adapter).toBe("s3");
    expect(status.ready).toBe(false);
    expect(status.bucket).toBeNull();
    expect(status.endpointConfigured).toBe(false);
  });

  it("is ready only when s3 bucket, endpoint, and keys are present", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORAGE_PROVIDER", "s3");
    vi.stubEnv("S3_BUCKET", "pierone-resumes");
    vi.stubEnv("S3_ENDPOINT", "https://example.r2.cloudflarestorage.com");
    vi.stubEnv("S3_REGION", "auto");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret-key");
    resetServerEnvCache();
    const status = await getStorageStatus();
    expect(status.adapter).toBe("s3");
    expect(status.ready).toBe(true);
    expect(status.bucket).toBe("pierone-resumes");
    expect(status.endpointConfigured).toBe(true);
  });
});

describe("storage diagnostics", () => {
  it("exposes only a key prefix, not the full object key", () => {
    expect(objectKeyPrefix("applications/org-1/candidate-2/123-resume.pdf")).toBe("applications/org-1");
    expect(objectKeyPrefix("military-talent/org-1/candidate-2/file.pdf")).toBe("military-talent/org-1");
    expect(objectKeyPrefix("skillbridge/profile-1/file.pdf")).toBe("skillbridge/profile-1");
  });

  it("logs provider, bucket, prefix, and outcome without credentials or file bytes", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const storage = new UnconfiguredStorageProvider();
    await expect(
      storage.upload({
        key: "applications/org-1/candidate-2/resume.pdf",
        body: fakePdf(),
        mimeType: "application/pdf",
        filename: "resume.pdf",
      }),
    ).rejects.toThrow();
    const payload = JSON.stringify(info.mock.calls);
    expect(payload).toContain("storage.operation");
    expect(payload).toContain("unconfigured");
    expect(payload).toContain("applications/org-1");
    expect(payload).not.toContain("candidate-2");
    expect(payload).not.toContain("%PDF");
    expect(payload).not.toContain("test-secret-key");
    info.mockRestore();
  });
});
