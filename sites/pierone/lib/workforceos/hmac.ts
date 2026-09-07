import { createHash, createHmac, randomUUID } from "node:crypto";

export const HMAC_HEADER_TIMESTAMP = "x-pierone-site-timestamp";
export const HMAC_HEADER_SIGNATURE = "x-pierone-site-signature";
export const HMAC_HEADER_REQUEST_ID = "x-pierone-request-id";

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function createPublicRequestId() {
  return randomUUID();
}

export function publicSiteSignaturePayload(input: {
  method: string;
  path: string;
  timestamp: string;
  requestId: string;
  bodyHash: string;
}) {
  return `${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.requestId}\n${input.bodyHash}`;
}

export function signPublicSiteRequest(input: {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  requestId: string;
  bodyHash: string;
}) {
  return createHmac("sha256", input.secret)
    .update(publicSiteSignaturePayload(input))
    .digest("hex");
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function serializeFormBody(form: FormData) {
  const blob = await new Response(form).blob();
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    contentType: blob.type || "multipart/form-data",
  };
}

export function workforceOsWriteUrl(apiBase: string, pathname: string) {
  const relative = pathname.replace(/^\//, "");
  return new URL(relative, `${apiBase.replace(/\/$/, "")}/`);
}

function isFailClosedProduction() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NODE_ENV === "production";
}

export function signWorkforceOsHeaders(input: {
  method: string;
  path: string;
  bodyHash: string;
}) {
  const secret = process.env.WORKFORCEOS_SITE_SECRET;
  if (!secret) {
    if (isFailClosedProduction()) {
      throw new Error("WORKFORCEOS_SITE_SECRET is required for production writes.");
    }
    return {} as Record<string, string>;
  }
  const timestamp = String(Date.now());
  const requestId = createPublicRequestId();
  const signature = signPublicSiteRequest({
    secret,
    method: input.method,
    path: input.path,
    timestamp,
    requestId,
    bodyHash: input.bodyHash,
  });
  return {
    [HMAC_HEADER_TIMESTAMP]: timestamp,
    [HMAC_HEADER_SIGNATURE]: signature,
    [HMAC_HEADER_REQUEST_ID]: requestId,
  };
}
