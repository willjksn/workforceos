import { getAppUrl, getServerEnv } from "../env";
import { HMAC_HEADER_SIGNATURE, HMAC_HEADER_TIMESTAMP, isTimestampFresh, sha256Hex, signPublicSiteRequest, signaturesMatch } from "./hmac";

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

export function isSameAppOrigin(request: Request) {
  const origin = originFromRequest(request);
  const appUrl = getAppUrl();
  return Boolean(origin && appUrl && origin === appUrl);
}

export async function assertPublicWriteAccess(request: Request, rawBody: string | Uint8Array) {
  const env = getServerEnv();
  const origin = originFromRequest(request);
  const allowed = allowedOrigins();
  if (origin && allowed.length > 0 && !allowed.includes(origin) && !isSameAppOrigin(request)) {
    throw new PublicGatewayError("Request origin is not allowed.", 403);
  }

  const secret = env.PUBLIC_SITE_INTEGRATION_SECRET;
  const production = env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (!secret) {
    if (production) {
      throw new PublicGatewayError("Signed request required.", 401);
    }
    return { signed: false as const };
  }

  if (isSameAppOrigin(request)) return { signed: false as const };

  const timestamp = request.headers.get(HMAC_HEADER_TIMESTAMP) ?? "";
  const signature = request.headers.get(HMAC_HEADER_SIGNATURE) ?? "";
  if (!timestamp || !signature || !isTimestampFresh(timestamp)) {
    throw new PublicGatewayError("Signed request required.", 401);
  }
  const path = requestPath(request);
  const contentType = request.headers.get("content-type") ?? "";
  const bodyHash = contentType.includes("multipart/form-data")
    ? sha256Hex(`${request.method.toUpperCase()}\n${path}\n${timestamp}`)
    : sha256Hex(typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody));
  const expected = signPublicSiteRequest({
    secret,
    method: request.method,
    path,
    timestamp,
    bodyHash,
  });
  if (!signaturesMatch(expected, signature)) {
    throw new PublicGatewayError("Signed request required.", 401);
  }
  return { signed: true as const };
}
