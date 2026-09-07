import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetServerEnvCache } from "../lib/env";
import {
  HMAC_HEADER_REQUEST_ID,
  HMAC_HEADER_SIGNATURE,
  HMAC_HEADER_TIMESTAMP,
  createPublicRequestId,
  isTimestampFresh,
  publicSiteSignaturePayload,
  serializeFormBody,
  sha256Hex,
  signPublicSiteRequest,
  signaturesMatch,
  toArrayBuffer,
} from "../lib/public-api/hmac";
import { PublicGatewayError, assertPublicWriteAccess, signSameAppPublicWrite } from "../lib/public-api/write-access";
import { resetMemoryRateLimits } from "../lib/security/rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvCache();
  resetMemoryRateLimits();
});

const SECRET = "test-site-secret";
const PATH = "/api/public/v1/inquiries";
const CAREERS_PATH = "/api/careers/applications";
const BODY = JSON.stringify({ company: "Example Energy" });

function productionEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", SECRET);
  vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.pieronepartners.com");
  resetServerEnvCache();
}

function signedHeaders(input?: {
  secret?: string;
  timestamp?: string;
  requestId?: string;
  body?: string | Uint8Array;
  path?: string;
  method?: string;
}) {
  const timestamp = input?.timestamp ?? String(Date.now());
  const requestId = input?.requestId ?? createPublicRequestId();
  const body = input?.body ?? BODY;
  const path = input?.path ?? PATH;
  const method = input?.method ?? "POST";
  const signature = signPublicSiteRequest({
    secret: input?.secret ?? SECRET,
    method,
    path,
    timestamp,
    requestId,
    bodyHash: sha256Hex(body),
  });
  return { timestamp, signature, requestId, body, path, method };
}

function makeRequest(input: {
  origin?: string;
  referer?: string;
  timestamp?: string;
  signature?: string;
  requestId?: string;
  body?: string | Uint8Array;
  path?: string;
  method?: string;
  contentType?: string;
}) {
  const headers = new Headers({
    "content-type": input.contentType ?? "application/json",
  });
  if (input.origin) headers.set("origin", input.origin);
  if (input.referer) headers.set("referer", input.referer);
  if (input.timestamp) headers.set(HMAC_HEADER_TIMESTAMP, input.timestamp);
  if (input.signature) headers.set(HMAC_HEADER_SIGNATURE, input.signature);
  if (input.requestId) headers.set(HMAC_HEADER_REQUEST_ID, input.requestId);
  return new Request(`https://app.pieronepartners.com${input.path ?? PATH}`, {
    method: input.method ?? "POST",
    headers,
    body: typeof input.body === "string" || input.body === undefined ? (input.body ?? BODY) : toArrayBuffer(input.body),
  });
}

function fakeResume(bytes: Uint8Array, filename = "resume.pdf") {
  return new File([toArrayBuffer(bytes)], filename, { type: "application/pdf" });
}

function applicationForm(input?: { firstName?: string; slug?: string; resume?: File }) {
  const form = new FormData();
  form.set("slug", input?.slug ?? "electrical-technician");
  form.set("firstName", input?.firstName ?? "Alex");
  form.set("lastName", "Rivera");
  form.set("email", "alex.rivera@example.test");
  form.set("resume", input?.resume ?? fakeResume(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])));
  return form;
}

describe("public gateway HMAC", () => {
  it("matches the PierOne public-site signed payload", () => {
    const timestamp = "1710000000000";
    const requestId = "11111111-1111-4111-8111-111111111111";
    const bodyHash = sha256Hex(BODY);
    const pieroneSignature = createHmac("sha256", SECRET)
      .update(`POST\n${PATH}\n${timestamp}\n${requestId}\n${bodyHash}`)
      .digest("hex");
    expect(publicSiteSignaturePayload({ method: "POST", path: PATH, timestamp, requestId, bodyHash })).toBe(
      `POST\n${PATH}\n${timestamp}\n${requestId}\n${bodyHash}`,
    );
    expect(
      signPublicSiteRequest({ secret: SECRET, method: "POST", path: PATH, timestamp, requestId, bodyHash }),
    ).toBe(pieroneSignature);
  });

  it("compares signatures with equal-length timing-safe equality", () => {
    const left = signPublicSiteRequest({
      secret: SECRET,
      method: "POST",
      path: PATH,
      timestamp: "1",
      requestId: "11111111-1111-4111-8111-111111111111",
      bodyHash: sha256Hex(BODY),
    });
    const right = signPublicSiteRequest({
      secret: SECRET,
      method: "POST",
      path: PATH,
      timestamp: "1",
      requestId: "11111111-1111-4111-8111-111111111111",
      bodyHash: sha256Hex(BODY),
    });
    expect(signaturesMatch(left, right)).toBe(true);
    expect(signaturesMatch(left, "b".repeat(left.length))).toBe(false);
    expect(signaturesMatch(left, "deadbeef")).toBe(false);
  });

  it("treats timestamps older than five minutes as stale", () => {
    const now = 1_710_000_000_000;
    expect(isTimestampFresh(String(now), now)).toBe(true);
    expect(isTimestampFresh(String(now - 5 * 60 * 1000), now)).toBe(true);
    expect(isTimestampFresh(String(now - 5 * 60 * 1000 - 1), now)).toBe(false);
    expect(isTimestampFresh("not-a-number", now)).toBe(false);
  });

  it("accepts a valid signed inquiry", async () => {
    productionEnv();
    const { timestamp, signature, requestId, body } = signedHeaders();
    const result = await assertPublicWriteAccess(
      makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, requestId, body }),
      body,
    );
    expect(result.signed).toBe(true);
  });

  it("rejects an invalid signature", async () => {
    productionEnv();
    const { timestamp, requestId, body } = signedHeaders();
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp,
          signature: "deadbeef",
          requestId,
          body,
        }),
        body,
      ),
    ).rejects.toBeInstanceOf(PublicGatewayError);
  });

  it("rejects the wrong secret", async () => {
    productionEnv();
    const { timestamp, signature, requestId, body } = signedHeaders({ secret: "other-secret" });
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, requestId, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a missing signature when production HMAC is configured", async () => {
    productionEnv();
    const { timestamp, requestId, body } = signedHeaders();
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, requestId, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a missing request id when production HMAC is configured", async () => {
    productionEnv();
    const { timestamp, signature, body } = signedHeaders();
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an expired timestamp", async () => {
    productionEnv();
    const stale = String(Date.now() - 10 * 60 * 1000);
    const { signature, requestId, body } = signedHeaders({ timestamp: stale });
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp: stale, signature, requestId, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a body modified after signature", async () => {
    productionEnv();
    const { timestamp, signature, requestId, body } = signedHeaders();
    const tampered = JSON.stringify({ company: "Tampered" });
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, requestId, body: tampered }),
        tampered,
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(body).not.toBe(tampered);
  });

  it("rejects a signature for a different path", async () => {
    productionEnv();
    const { timestamp, signature, requestId, body } = signedHeaders({ path: PATH });
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp,
          signature,
          requestId,
          body,
          path: "/api/public/v1/applications",
        }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a signature for a different method", async () => {
    productionEnv();
    const { timestamp, signature, requestId, body } = signedHeaders({ method: "POST" });
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp,
          signature,
          requestId,
          body,
          method: "PUT",
        }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects unsigned production writes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", "");
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    resetServerEnvCache();
    await expect(
      assertPublicWriteAccess(makeRequest({ origin: "https://pieronepartners.com" }), BODY),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("allows unsigned writes on Vercel preview when HMAC is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PUBLIC_SITE_INTEGRATION_SECRET", "");
    vi.stubEnv("PUBLIC_SITE_ALLOWED_ORIGINS", "https://pieronepartners.com");
    resetServerEnvCache();
    await expect(
      assertPublicWriteAccess(makeRequest({ origin: "https://pieronepartners.com" }), BODY),
    ).resolves.toMatchObject({ signed: false });
  });

  it("rejects spoofed Origin matching NEXT_PUBLIC_APP_URL without HMAC", async () => {
    productionEnv();
    await expect(
      assertPublicWriteAccess(makeRequest({ origin: "https://app.pieronepartners.com" }), BODY),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects unsigned writes from a disallowed origin with 401, not 403", async () => {
    productionEnv();
    await expect(
      assertPublicWriteAccess(makeRequest({ origin: "https://evil.example" }), BODY),
    ).rejects.toMatchObject({ status: 401, message: "Signed request required." });
  });

  it("rejects a valid HMAC from a disallowed origin", async () => {
    productionEnv();
    const { timestamp, signature, requestId, body } = signedHeaders();
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://evil.example", timestamp, signature, requestId, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 403, message: "Request origin is not allowed." });
  });

  it("rejects spoofed Referer matching the app origin without HMAC", async () => {
    productionEnv();
    await expect(
      assertPublicWriteAccess(
        makeRequest({ referer: "https://app.pieronepartners.com/careers" }),
        BODY,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a replayed request id inside the replay window", async () => {
    productionEnv();
    const { timestamp, signature, requestId, body } = signedHeaders();
    const request = makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, requestId, body });
    await expect(assertPublicWriteAccess(request, body)).resolves.toMatchObject({ signed: true });
    await expect(
      assertPublicWriteAccess(
        makeRequest({ origin: "https://pieronepartners.com", timestamp, signature, requestId, body }),
        body,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("signs a same-app WorkforceOS careers write and then verifies HMAC", async () => {
    productionEnv();
    const { bytes, contentType } = await serializeFormBody(applicationForm());
    const unsigned = makeRequest({
      origin: "https://app.pieronepartners.com",
      path: CAREERS_PATH,
      body: bytes,
      contentType,
    });
    const signed = await signSameAppPublicWrite(unsigned, bytes);
    expect(signed.headers.get(HMAC_HEADER_SIGNATURE)).toBeTruthy();
    const result = await assertPublicWriteAccess(signed, bytes);
    expect(result.signed).toBe(true);
  });

  it("does not let a non-app origin use the same-app signing helper", async () => {
    productionEnv();
    const { bytes, contentType } = await serializeFormBody(applicationForm());
    await expect(
      signSameAppPublicWrite(
        makeRequest({
          origin: "https://pieronepartners.com",
          path: CAREERS_PATH,
          body: bytes,
          contentType,
        }),
        bytes,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("public gateway multipart HMAC", () => {
  async function signedMultipart(input?: {
    form?: FormData;
    secret?: string;
    timestamp?: string;
    path?: string;
  }) {
    const form = input?.form ?? applicationForm();
    const { bytes, contentType } = await serializeFormBody(form);
    const headers = signedHeaders({
      secret: input?.secret,
      timestamp: input?.timestamp,
      body: bytes,
      path: input?.path ?? "/api/public/v1/applications",
    });
    return { ...headers, bytes, contentType, path: input?.path ?? "/api/public/v1/applications" };
  }

  it("accepts a valid multipart military-talent body hash", async () => {
    productionEnv();
    const form = new FormData();
    form.set("firstName", "Alex");
    form.set("lastName", "Rivera");
    form.set("email", "alex.rivera@example.test");
    form.set("branch", "Army");
    form.set("resume", fakeResume(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])));
    const signed = await signedMultipart({ form, path: "/api/public/v1/military-talent" });
    const result = await assertPublicWriteAccess(
      makeRequest({
        origin: "https://pieronepartners.com",
        timestamp: signed.timestamp,
        signature: signed.signature,
        requestId: signed.requestId,
        body: signed.bytes,
        path: signed.path,
        contentType: signed.contentType,
      }),
      signed.bytes,
    );
    expect(result.signed).toBe(true);
  });

  it("accepts a valid multipart application", async () => {
    productionEnv();
    const signed = await signedMultipart();
    const result = await assertPublicWriteAccess(
      makeRequest({
        origin: "https://pieronepartners.com",
        timestamp: signed.timestamp,
        signature: signed.signature,
        requestId: signed.requestId,
        body: signed.bytes,
        path: signed.path,
        contentType: signed.contentType,
      }),
      signed.bytes,
    );
    expect(result.signed).toBe(true);
  });

  it("rejects a text field changed after signing", async () => {
    productionEnv();
    const signed = await signedMultipart();
    const { bytes: tampered, contentType } = await serializeFormBody(applicationForm({ firstName: "Tampered" }));
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp: signed.timestamp,
          signature: signed.signature,
          requestId: signed.requestId,
          body: tampered,
          path: signed.path,
          contentType,
        }),
        tampered,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects resume bytes replaced after signing", async () => {
    productionEnv();
    const signed = await signedMultipart();
    const { bytes: tampered, contentType } = await serializeFormBody(
      applicationForm({ resume: fakeResume(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32])) }),
    );
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp: signed.timestamp,
          signature: signed.signature,
          requestId: signed.requestId,
          body: tampered,
          path: signed.path,
          contentType,
        }),
        tampered,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a filename change because it is part of the exact multipart bytes", async () => {
    productionEnv();
    const signed = await signedMultipart();
    const { bytes: tampered, contentType } = await serializeFormBody(
      applicationForm({ resume: fakeResume(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]), "other.pdf") }),
    );
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp: signed.timestamp,
          signature: signed.signature,
          requestId: signed.requestId,
          body: tampered,
          path: signed.path,
          contentType,
        }),
        tampered,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a job slug changed after signing", async () => {
    productionEnv();
    const signed = await signedMultipart();
    const { bytes: tampered, contentType } = await serializeFormBody(applicationForm({ slug: "other-role" }));
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp: signed.timestamp,
          signature: signed.signature,
          requestId: signed.requestId,
          body: tampered,
          path: signed.path,
          contentType,
        }),
        tampered,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a multipart request signed with the wrong secret", async () => {
    productionEnv();
    const signed = await signedMultipart({ secret: "other-secret" });
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp: signed.timestamp,
          signature: signed.signature,
          requestId: signed.requestId,
          body: signed.bytes,
          path: signed.path,
          contentType: signed.contentType,
        }),
        signed.bytes,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a stale multipart timestamp", async () => {
    productionEnv();
    const stale = String(Date.now() - 10 * 60 * 1000);
    const signed = await signedMultipart({ timestamp: stale });
    await expect(
      assertPublicWriteAccess(
        makeRequest({
          origin: "https://pieronepartners.com",
          timestamp: stale,
          signature: signed.signature,
          requestId: signed.requestId,
          body: signed.bytes,
          path: signed.path,
          contentType: signed.contentType,
        }),
        signed.bytes,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});
