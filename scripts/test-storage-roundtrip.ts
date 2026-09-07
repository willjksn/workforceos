import "./load-env";

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { resetServerEnvCache } from "../lib/env";
import { getStorageProvider, getStorageStatus } from "../lib/storage";
import { LocalStorageProvider } from "../lib/storage/local";
import type { StorageProvider } from "../lib/storage/provider";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fakePdf() {
  return new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
}

function configured(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim());
}

async function roundTrip(storage: StorageProvider, prefix: string) {
  const key = `${prefix}/${randomUUID()}.pdf`;
  const body = fakePdf();
  await storage.upload({
    key,
    body,
    mimeType: "application/pdf",
    filename: "storage-verify.pdf",
  });
  const meta = await storage.metadata(key);
  assert(meta, "Object was not found after upload");
  assert(meta.sizeBytes === body.byteLength, "Uploaded size did not match");
  const downloaded = await storage.download(key);
  assert(downloaded.byteLength === body.byteLength, "Private read size did not match");
  const signed = await storage.getSignedUrl(key);
  assert(typeof signed === "string" && signed.length > 0, "Signed/private URL was empty");
  assert(!String(signed).includes("S3_SECRET_ACCESS_KEY"), "Signed URL helper leaked env var name unexpectedly");
  await storage.delete(key);
  const gone = await storage.metadata(key);
  assert(!gone, "Object still existed after delete");
  return { keyPrefix: prefix, provider: storage.name };
}

async function main() {
  resetServerEnvCache();
  const status = await getStorageStatus();
  const provider = getStorageProvider();

  console.log("Active provider:", provider.name);
  console.log("STORAGE_PROVIDER set:", configured("STORAGE_PROVIDER") ? "yes" : "no");
  console.log("S3_BUCKET set:", configured("S3_BUCKET") ? "yes" : "no");
  console.log("S3_REGION set:", configured("S3_REGION") ? "yes" : "no");
  console.log("S3_ENDPOINT set:", configured("S3_ENDPOINT") ? "yes" : "no");
  console.log("S3_ACCESS_KEY_ID set:", configured("S3_ACCESS_KEY_ID") ? "yes" : "no");
  console.log("S3_SECRET_ACCESS_KEY set:", configured("S3_SECRET_ACCESS_KEY") ? "yes" : "no");
  console.log("Health ready:", status.ready ? "yes" : "no");
  console.log("Health adapter:", status.adapter);
  console.log("Health bucket:", status.bucket ?? "(none)");
  console.log("Health endpoint configured:", status.endpointConfigured ? "yes" : "no");

  const dir = await mkdtemp(path.join(tmpdir(), "wfos-storage-verify-"));
  try {
    const local = new LocalStorageProvider(dir);
    const localResult = await roundTrip(local, "diagnostics/storage-verify");
    console.log("Local PDF round-trip:", "pass", localResult.provider, localResult.keyPrefix);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  if (provider.name === "s3" && status.ready) {
    const live = await roundTrip(provider, "diagnostics/storage-verify");
    console.log("Live S3/R2 PDF round-trip:", "pass", live.provider, live.keyPrefix);
  } else {
    console.log(
      "Live S3/R2 PDF round-trip: skipped (provider is not ready in this environment; production must set STORAGE_PROVIDER=s3 plus bucket, endpoint, and keys)",
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Storage round-trip failed:", message.slice(0, 200));
  process.exit(1);
});
