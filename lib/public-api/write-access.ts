import { getAppUrl, getServerEnv, isFailClosedProduction } from "../env";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "../security/rate-limit";
import {
  HMAC_HEADER_REQUEST_ID,
  HMAC_HEADER_SIGNATURE,
  HMAC_HEADER_TIMESTAMP,
  createPublicRequestId,
  isPublicRequestId,
  isTimestampFresh,
  sha256Hex,
  signPublicSiteRequest,
  signaturesMatch,
  toArrayBuffer,
} from "./hmac";

export class PublicGatewayError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PublicGatewayError";
  }
}

function requestPath(request: Request) {
  return new URL(request.url).pathname;
}

function originFromRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function allowedOrigins() {
  const env = getServerEnv();
  const configured = env.PUBLIC_SITE_ALLOWED_ORIGINS?.split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean) ?? [];
  const appUrl = getAppUrl();
  if (appUrl) configured.push(appUrl);
  return configured;
}

function assertOriginAllowed(request: Request) {
  const origin = originFromRequest(request);
  const allowed = allowedOrigins();
  if (origin && allowed.length > 0 && !allowed.includes(origin) && !isSameAppOrigin(request)) {
    throw new PublicGatewayError("Request origin is not allowed.", 403);
  }
}

export function isSameAppOrigin(request: Request) {
  const origin = originFromRequest(request);
  const appUrl = getAppUrl();
  return Boolean(origin && appUrl && origin === appUrl);
}

export async function signSameAppPublicWrite(request: Request, rawBody: Uint8Array) {
  if (!isSameAppOrigin(request)) {
    throw new PublicGatewayError("Request origin is not allowed.", 403);
  }
  const secret = getServerEnv().PUBLIC_SITE_INTEGRATION_SECRET;
  if (!secret) {
    if (isFailClosedProduction()) {
      throw new PublicGatewayError("Signed request required.", 401);
    }
    return request;
  }
  const timestamp = String(Date.now());
  const requestId = createPublicRequestId();
  const path = requestPath(request);
  const signature = signPublicSiteRequest({
    secret,
    method: request.method,
    path,
    timestamp,
    requestId,
    bodyHash: sha256Hex(rawBody),
  });
  const headers = new Headers(request.headers);
  headers.set(HMAC_HEADER_TIMESTAMP, timestamp);
  headers.set(HMAC_HEADER_SIGNATURE, signature);
  headers.set(HMAC_HEADER_REQUEST_ID, requestId);
  return new Request(request.url, {
    method: request.method,
    headers,
    body: toArrayBuffer(rawBody),
  });
}

async function assertUnusedRequestId(requestId: string) {
  try {
    await assertRateLimit({ key: `hmac-request:${requestId}`, ...RATE_LIMITS.hmacReplay });
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new PublicGatewayError("Signed request required.", 401);
    }
    throw error;
  }
}

export async function assertPublicWriteAccess(request: Request, rawBody: string | Uint8Array) {
  const env = getServerEnv();
  const secret = env.PUBLIC_SITE_INTEGRATION_SECRET;
  if (!secret) {
    if (isFailClosedProduction()) {
      throw new PublicGatewayError("Signed request required.", 401);
    }
    assertOriginAllowed(request);
    return { signed: false as const };
  }

  const timestamp = request.headers.get(HMAC_HEADER_TIMESTAMP) ?? "";
  const signature = request.headers.get(HMAC_HEADER_SIGNATURE) ?? "";
  const requestId = request.headers.get(HMAC_HEADER_REQUEST_ID) ?? "";
  if (!timestamp || !signature || !isPublicRequestId(requestId) || !isTimestampFresh(timestamp)) {
    throw new PublicGatewayError("Signed request required.", 401);
  }
  const path = requestPath(request);
  const expected = signPublicSiteRequest({
    secret,
    method: request.method,
    path,
    timestamp,
    requestId,
    bodyHash: sha256Hex(rawBody),
  });
  if (!signaturesMatch(expected, signature)) {
    throw new PublicGatewayError("Signed request required.", 401);
  }
  await assertUnusedRequestId(requestId);
  assertOriginAllowed(request);
  return { signed: true as const };
}
