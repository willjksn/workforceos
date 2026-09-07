import { logServerEvent } from "../observability/monitor";

export function objectKeyPrefix(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]}/${parts[1]}`;
}

export function safeErrorMessage(error: unknown) {
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
  const aws =
    input.error && typeof input.error === "object"
      ? (input.error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } })
      : undefined;
  logServerEvent("storage.operation", {
    action: input.action,
    provider: input.provider,
    bucket: input.bucket ?? null,
    keyPrefix: objectKeyPrefix(input.key),
    ok: input.ok,
    error: input.ok ? undefined : safeErrorMessage(input.error),
    errorName: input.ok ? undefined : aws?.name,
    httpStatus: input.ok ? undefined : aws?.$metadata?.httpStatusCode,
  });
}

export function resumeStorageFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/storage is not configured/i.test(message)) return message;
  if (/access denied/i.test(message)) {
    return "Resume storage failed. Access Denied — the R2/S3 API token cannot write this bucket. Grant Object Read and Write on S3_BUCKET and use the account endpoint https://<accountid>.r2.cloudflarestorage.com.";
  }
  const detail = safeErrorMessage(error);
  return detail ? `Resume storage failed. ${detail}` : "Resume storage failed.";
}
