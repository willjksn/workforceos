import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const HMAC_HEADER_TIMESTAMP = "x-pierone-site-timestamp";
export const HMAC_HEADER_SIGNATURE = "x-pierone-site-signature";

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function publicSiteSignaturePayload(input: {
  method: string;
  path: string;
  timestamp: string;
  bodyHash: string;
}) {
  return `${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.bodyHash}`;
}

export function signPublicSiteRequest(input: {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  bodyHash: string;
}) {
  return createHmac("sha256", input.secret)
    .update(publicSiteSignaturePayload(input))
    .digest("hex");
}

export function signaturesMatch(expected: string, provided: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isTimestampFresh(timestamp: string, now = Date.now(), maxSkewMs = 5 * 60 * 1000) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) return false;
  return Math.abs(now - value) <= maxSkewMs;
}
