import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageProvider, StoredFileMetadata } from "./provider";

export class LocalStorageProvider implements StorageProvider {
  name = "local";

  constructor(private readonly rootDir: string) {}

  private resolve(key: string) {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalized.includes("..")) {
      throw new Error("Invalid storage key");
    }
    return path.join(this.rootDir, normalized);
  }

  async upload(params: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    filename: string;
  }): Promise<StoredFileMetadata> {
    const filePath = this.resolve(params.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    const { assertUploadAllowed } = await import("./limits");
    assertUploadAllowed({
      sizeBytes: params.body.byteLength,
      mimeType: params.mimeType,
      filename: params.filename,
    });
    await writeFile(filePath, params.body);
    const checksum = createHash("sha256").update(params.body).digest("hex");
    return {
      key: params.key,
      filename: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.body.byteLength,
      checksum,
    };
  }

  async download(key: string): Promise<Uint8Array> {
    const buffer = await readFile(this.resolve(key));
    return new Uint8Array(buffer);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async getSignedUrl(key: string): Promise<string> {
    return `local://${key}`;
  }

  async metadata(key: string): Promise<StoredFileMetadata | null> {
    try {
      const info = await stat(this.resolve(key));
      return {
        key,
        filename: path.basename(key),
        mimeType: "application/octet-stream",
        sizeBytes: info.size,
      };
    } catch {
      return null;
    }
  }
}
