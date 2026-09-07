import { logStorageOperation } from "./diagnostics";
import type { StorageProvider, StoredFileMetadata } from "./provider";

export class UnconfiguredStorageProvider implements StorageProvider {
  name = "unconfigured";

  private fail(action: "upload" | "download" | "delete" | "sign" | "head", key = "unconfigured"): never {
    const error = new Error(
      "Object storage is not configured for this environment. Set STORAGE_PROVIDER=s3 plus S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
    logStorageOperation({
      action,
      provider: this.name,
      bucket: null,
      key,
      ok: false,
      error: "Object storage is not configured",
    });
    throw error;
  }

  async upload(params: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    filename: string;
  }): Promise<StoredFileMetadata> {
    this.fail("upload", params.key);
  }

  async download(key: string): Promise<Uint8Array> {
    this.fail("download", key);
  }

  async delete(key: string): Promise<void> {
    this.fail("delete", key);
  }

  async getSignedUrl(key: string): Promise<string> {
    this.fail("sign", key);
  }

  async metadata(key: string): Promise<StoredFileMetadata | null> {
    this.fail("head", key);
  }
}
