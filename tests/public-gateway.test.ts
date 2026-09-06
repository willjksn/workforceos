import { afterEach, describe, expect, it, vi } from "vitest";

import { resetServerEnvCache } from "../lib/env";
import { HMAC_HEADER_SIGNATURE, HMAC_HEADER_TIMESTAMP, sha256Hex, signPublicSiteRequest } from "../lib/public-api/hmac";
import { PublicGatewayError, assertPublicWriteAccess } from "../lib/public-api/write-access";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
});

const SECRET = "test-site-secret";
const PATH = "/api/public/v1/inquiries";
const BODY = JSON.stringify({ company: "Example Energy" });

function signedHeaders(input?: { secret?: string; timestamp?: string; body?: string; path?: string }) {
  const timestamp = input?.timestamp ?? String(Date.now());
  const body = input?.body ?? BODY;
  const path = input?.path ?? PATH;
  const signature = signPublicSiteRequest({
    secret: input?.secret ?? SECRET,
    method: "POST",
    path,
    timestamp,
    bodyHash: sha256Hex(body),
  });
  return { timestamp, signature, body };
}

function makeRequest(input: {
  origin?: string;
  timestamp?: string;
  signature?: string;
  body?: string;
  path?: string;
}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (input.origin) headers.set("origin", input.origin);
  if (input.timestamp) headers.set(HMAC_HEADER_TIMESTAMP, input.timestamp);
  if (input.signature) headers.set(HMAC_HEADER_SIGNATURE, input.signature);
  return new Request(`https://app.pieronepartners.com${input.path ?? PATH}`, {
    method: "POST",
    headers,
    body: input.body ?? BODY,
  });
}

describe("public gateway HMAC", () => {
  it("accepts a valid signed inquiry", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", SECRET);
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.pieronepartners.com");
    resetServerEnvCache();
    const { timestamp, signature, body } = signedHeaders();
    const result = await assertPublicWriteAccess(
      makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, body }),
      body,
    );
    expect(result.signed).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", SECRET);
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    resetServerEnvCache();
    const { timestamp, body } = signedHeaders();
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, signature: "deadbeef", body }),
        body,
      ),
    ).rejects.toBeInstanceOf(PublicGatewayError);
  });

  it("rejects the wrong secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", SECRET);
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    resetServerEnvCache();
    const { timestamp, signature, body } = signedHeaders({ secret: "other-secret" });
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an expired timestamp", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", SECRET);
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    resetServerEnvCache();
    const stale = String(Date.now() - 10 * 60 * 1000);
    const { signature, body } = signedHeaders({ timestamp: stale });
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp: stale, signature, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a body modified after signature", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", SECRET);
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    resetServerEnvCache();
    const { timestamp, signature, body } = signedHeaders();
    const tampered = JSON.stringify({ company: "Tampered" });
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, body: tampered }),
        tampered,
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(body).not.toBe(tampered);
  });

  it("rejects unsigned production writes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", "");
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    resetServerEnvCache();
    await expect(
      assertPublicWriteAccess(makeRequest({ origin: "https://pieronepartners.com" }), BODY),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("allows unsigned same-origin WorkforceOS careers posts when the secret is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.pieronepartners.com");
    resetServerEnvCache();
    const result = await assertPublicWriteAccess(
      makeRequest({ origin: "https://app.pieronepartners.com" }),
      BODY,
    );
    expect(result.signed).toBe(false);
  });
});
