import { createHash } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { assertUploadAllowed } from "./limits";
import type { StorageProvider, StoredFileMetadata } from "./provider";

function normalizeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

async function bodyToBytes(body: unknown): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  if (body instanceof Uint8Array) return body;
  if (typeof body === "string") return new TextEncoder().encode(body);
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === "function") {
    return (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export class S3CompatibleStorageProvider implements StorageProvider {
  name = "s3";
  private client: S3Client | null = null;

  constructor(
    private readonly options: {
      bucket?: string;
      region?: string;
      endpoint?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    },
  ) {}

  isConfigured() {
    return Boolean(this.options.bucket && this.options.accessKeyId && this.options.secretAccessKey);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error(
        "S3-compatible storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
      );
    }
  }

  private getClient() {
    this.assertConfigured();
    if (!this.client) {
      this.client = new S3Client({
        region: this.options.region || "auto",
        endpoint: this.options.endpoint,
        credentials: {
          accessKeyId: this.options.accessKeyId as string,
          secretAccessKey: this.options.secretAccessKey as string,
        },
        forcePathStyle: Boolean(this.options.endpoint),
      });
    }
    return this.client;
  }

  async upload(params: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    filename: string;
  }): Promise<StoredFileMetadata> {
    this.assertConfigured();
    const key = normalizeKey(params.key);
    assertUploadAllowed({
      sizeBytes: params.body.byteLength,
      mimeType: params.mimeType,
      filename: params.filename,
    });
    const checksum = createHash("sha256").update(params.body).digest("hex");
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: params.body,
        ContentType: params.mimeType,
        ContentDisposition: `attachment; filename="${params.filename.replace(/"/g, "")}"`,
        Metadata: {
          filename: params.filename,
          checksum,
          privacy: "restricted_pii",
        },
        CacheControl: "private, no-store",
      }),
    );
    return {
      key,
      filename: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.body.byteLength,
      checksum,
    };
  }

  async download(key: string): Promise<Uint8Array> {
    this.assertConfigured();
    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: normalizeKey(key),
      }),
    );
    return bodyToBytes(response.Body);
  }

  async delete(key: string): Promise<void> {
    this.assertConfigured();
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.options.bucket,
        Key: normalizeKey(key),
      }),
    );
  }

  async getSignedUrl(key: string, expiresInSeconds = 120): Promise<string> {
    this.assertConfigured();
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: normalizeKey(key),
      }),
      { expiresIn: Math.min(Math.max(expiresInSeconds, 30), 300) },
    );
  }

  async metadata(key: string): Promise<StoredFileMetadata | null> {
    this.assertConfigured();
    try {
      const response = await this.getClient().send(
        new HeadObjectCommand({
          Bucket: this.options.bucket,
          Key: normalizeKey(key),
        }),
      );
      return {
        key: normalizeKey(key),
        filename: response.Metadata?.filename ?? key.split("/").pop() ?? key,
        mimeType: response.ContentType ?? "application/octet-stream",
        sizeBytes: response.ContentLength ?? 0,
        checksum: response.Metadata?.checksum,
      };
    } catch {
      return null;
    }
  }
}
