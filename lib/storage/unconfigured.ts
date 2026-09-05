import type { StorageProvider, StoredFileMetadata } from "./provider";

export class UnconfiguredStorageProvider implements StorageProvider {
  name = "unconfigured";

  private fail(): never {
    throw new Error(
      "Object storage is not configured for this environment. Set STORAGE_PROVIDER=s3 plus S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  async upload(): Promise<StoredFileMetadata> {
    this.fail();
  }

  async download(): Promise<Uint8Array> {
    this.fail();
  }

  async delete(): Promise<void> {
    this.fail();
  }

  async getSignedUrl(): Promise<string> {
    this.fail();
  }

  async metadata(): Promise<StoredFileMetadata | null> {
    this.fail();
  }
}
