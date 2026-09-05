import path from "node:path";

import { getServerEnv } from "../env";
import { LocalStorageProvider } from "./local";
import type { StorageProvider } from "./provider";
import { S3CompatibleStorageProvider } from "./s3-compatible";

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

  const rootDir = path.join(
    process.cwd(),
    ".data",
    "storage",
  );
  return new LocalStorageProvider(rootDir);
}

export async function getStorageStatus() {
  const provider = getStorageProvider();
  return {
    adapter: provider.name,
    ready: provider.name === "local" || Boolean(getServerEnv().S3_BUCKET),
  };
}
