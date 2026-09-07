import { createHash } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { logStorageOperation } from "./diagnostics";
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

export function s3CompatibleClientConfig(options: {
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}): S3ClientConfig {
  const { endpoint, forcePathStyle } = s3Addressing(options);
  return {
    region: options.region || "auto",
    endpoint,
    credentials: {
      accessKeyId: options.accessKeyId as string,
      secretAccessKey: options.secretAccessKey as string,
    },
    forcePathStyle,
    // R2 and other S3-compatible stores reject the SDK's default CRC32 checksums.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  };
}

export function s3Addressing(options: { endpoint?: string; bucket?: string }) {
  const endpoint = options.endpoint?.trim().replace(/\/$/, "");
  if (!endpoint) {
    return { endpoint: undefined, forcePathStyle: false };
  }
  try {
    const url = new URL(endpoint);
    const bucket = options.bucket?.trim().toLowerCase();
    if (bucket && url.pathname.replace(/\/+$/, "") === `/${bucket}`) {
      url.pathname = "/";
    }
    const host = url.hostname.toLowerCase();
    const forcePathStyle = !(bucket && (host === bucket || host.startsWith(`${bucket}.`)));
    return { endpoint: url.toString().replace(/\/$/, ""), forcePathStyle };
  } catch {
    return { endpoint, forcePathStyle: true };
  }
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
    return Boolean(
      this.options.bucket && this.options.endpoint && this.options.accessKeyId && this.options.secretAccessKey,
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error(
        "S3-compatible storage is not configured. Set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
      );
    }
  }

  private getClient() {
    this.assertConfigured();
    if (!this.client) {
      this.client = new S3Client(s3CompatibleClientConfig(this.options));
    }
    return this.client;
  }

  async upload(params: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    filename: string;
  }): Promise<StoredFileMetadata> {
    const key = normalizeKey(params.key);
    try {
      this.assertConfigured();
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
          Body: Buffer.from(params.body),
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
      logStorageOperation({
        action: "upload",
        provider: this.name,
        bucket: this.options.bucket,
        key,
        ok: true,
      });
      return {
        key,
        filename: params.filename,
        mimeType: params.mimeType,
        sizeBytes: params.body.byteLength,
        checksum,
      };
    } catch (error) {
      logStorageOperation({
        action: "upload",
        provider: this.name,
        bucket: this.options.bucket,
        key,
        ok: false,
        error,
      });
      throw error;
    }
  }

  async download(key: string): Promise<Uint8Array> {
    const normalized = normalizeKey(key);
    try {
      this.assertConfigured();
      const response = await this.getClient().send(
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key: normalized,
        }),
      );
      const bytes = await bodyToBytes(response.Body);
      logStorageOperation({
        action: "download",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: true,
      });
      return bytes;
    } catch (error) {
      logStorageOperation({
        action: "download",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: false,
        error,
      });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const normalized = normalizeKey(key);
    try {
      this.assertConfigured();
      await this.getClient().send(
        new DeleteObjectCommand({
          Bucket: this.options.bucket,
          Key: normalized,
        }),
      );
      logStorageOperation({
        action: "delete",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: true,
      });
    } catch (error) {
      logStorageOperation({
        action: "delete",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: false,
        error,
      });
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 120): Promise<string> {
    const normalized = normalizeKey(key);
    try {
      this.assertConfigured();
      const url = await getSignedUrl(
        this.getClient(),
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key: normalized,
        }),
        { expiresIn: Math.min(Math.max(expiresInSeconds, 30), 300) },
      );
      logStorageOperation({
        action: "sign",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: true,
      });
      return url;
    } catch (error) {
      logStorageOperation({
        action: "sign",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: false,
        error,
      });
      throw error;
    }
  }

  async metadata(key: string): Promise<StoredFileMetadata | null> {
    const normalized = normalizeKey(key);
    try {
      this.assertConfigured();
      const response = await this.getClient().send(
        new HeadObjectCommand({
          Bucket: this.options.bucket,
          Key: normalized,
        }),
      );
      logStorageOperation({
        action: "head",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: true,
      });
      return {
        key: normalized,
        filename: response.Metadata?.filename ?? normalized.split("/").pop() ?? normalized,
        mimeType: response.ContentType ?? "application/octet-stream",
        sizeBytes: response.ContentLength ?? 0,
        checksum: response.Metadata?.checksum,
      };
    } catch (error) {
      logStorageOperation({
        action: "head",
        provider: this.name,
        bucket: this.options.bucket,
        key: normalized,
        ok: false,
        error,
      });
      if (!this.isConfigured()) throw error;
      return null;
    }
  }
}
