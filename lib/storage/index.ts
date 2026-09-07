import path from "node:path";

import { getServerEnv } from "../env";
import { LocalStorageProvider } from "./local";
import type { StorageProvider } from "./provider";
import { S3CompatibleStorageProvider } from "./s3-compatible";
import { UnconfiguredStorageProvider } from "./unconfigured";

function isProductionStorageEnv(env: { NODE_ENV: string }) {
  return env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function getStorageProvider(): StorageProvider {
  const env = getServerEnv();
  if (env.STORAGE_PROVIDER === "s3") {
    return new S3CompatibleStorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    });
  }

  if (isProductionStorageEnv(env)) {
    return new UnconfiguredStorageProvider();
  }

  const rootDir = env.LOCAL_STORAGE_DIR
    ? path.resolve(env.LOCAL_STORAGE_DIR)
    : path.join(process.cwd(), ".data", "storage");
  return new LocalStorageProvider(rootDir);
}

export async function getStorageStatus() {
  const provider = getStorageProvider();
  const env = getServerEnv();
  const production = isProductionStorageEnv(env);
  const s3CredentialsPresent = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
  const s3Ready = provider.name === "s3" && s3CredentialsPresent && Boolean(env.S3_ENDPOINT);
  return {
    adapter: provider.name,
    bucket: env.S3_BUCKET ?? null,
    endpointConfigured: Boolean(env.S3_ENDPOINT),
    regionConfigured: Boolean(env.S3_REGION),
    ready: production ? s3Ready : provider.name === "local" || s3Ready,
  };
}
