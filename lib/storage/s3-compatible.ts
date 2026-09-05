import type { StorageProvider, StoredFileMetadata } from "./provider";

export class S3CompatibleStorageProvider implements StorageProvider {
  name = "s3";

  constructor(
    private readonly options: {
      bucket?: string;
      region?: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    },
  ) {}

  private assertConfigured() {
    if (
      !this.options.bucket ||
      !this.options.accessKeyId ||
      !this.options.secretAccessKey
    ) {
      throw new Error(
        "S3-compatible storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
      );
    }
  }

  async upload(): Promise<StoredFileMetadata> {
    this.assertConfigured();
    throw new Error("S3-compatible upload is not implemented until R2/S3 credentials are connected.");
  }

  async download(): Promise<Uint8Array> {
    this.assertConfigured();
    throw new Error("S3-compatible download is not implemented until R2/S3 credentials are connected.");
  }

  async delete(): Promise<void> {
    this.assertConfigured();
    throw new Error("S3-compatible delete is not implemented until R2/S3 credentials are connected.");
  }

  async getSignedUrl(): Promise<string> {
    this.assertConfigured();
    throw new Error("S3-compatible signed URLs are not implemented until R2/S3 credentials are connected.");
  }

  async metadata(): Promise<StoredFileMetadata | null> {
    this.assertConfigured();
    return null;
  }
}
