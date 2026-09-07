import { logServerEvent } from "../observability/monitor";

export function objectKeyPrefix(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]}/${parts[1]}`;
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/S3_SECRET_ACCESS_KEY/gi, "S3 credentials")
    .replace(/S3_ACCESS_KEY_ID/gi, "S3 credentials")
    .replace(/[?&][^=\s]*=\S+/g, "")
    .slice(0, 200);
}

export function logStorageOperation(input: {
  action: "upload" | "download" | "delete" | "sign" | "head";
  provider: string;
  bucket?: string | null;
  key: string;
  ok: boolean;
  error?: unknown;
}) {
  logServerEvent("storage.operation", {
    action: input.action,
    provider: input.provider,
    bucket: input.bucket ?? null,
    keyPrefix: objectKeyPrefix(input.key),
    ok: input.ok,
    error: input.ok ? undefined : safeErrorMessage(input.error),
  });
}
