import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import * as https from "node:https";
import path from "node:path";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { employerJobContentHash } from "../lib/integrations/career-sources/content-hash";
import { parseJobCsv } from "../lib/integrations/career-sources/csv";
import { greenhouseAdapter, normalizeGreenhouseJob } from "../lib/integrations/career-sources/greenhouse";
import { careerSourceHealth } from "../lib/integrations/career-sources/health";
import { isPrivateAddress } from "../lib/integrations/career-sources/network-guards";
import { evaluateSourceAccess } from "../lib/integrations/career-sources/policy";
import { planSourceSync } from "../lib/integrations/career-sources/plan";
import { safeFetch } from "../lib/integrations/career-sources/safe-fetch";
import { GREENHOUSE_ADAPTER_KEY, type DiscoveryDeps, type NormalizedEmployerJob } from "../lib/integrations/career-sources/types";
import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";

const root = path.resolve(import.meta.dirname, "..");

type CapturedRequest = {
  href: string;
  hostname: string;
  servername?: string;
  rejectUnauthorized?: boolean;
  headers: https.RequestOptions["headers"];
  lookup?: https.RequestOptions["lookup"];
};

function installPinnedSocket(responses: { status: number; headers?: Record<string, string>; body?: string }[]) {
  const captured: CapturedRequest[] = [];
  let index = 0;
  const socketRequest = vi.fn((url: URL, options: https.RequestOptions, callback: (res: IncomingMessage) => void) => {
    captured.push({
      href: String(url),
      hostname: url.hostname,
      servername: options.servername,
      rejectUnauthorized: options.rejectUnauthorized,
      headers: options.headers,
      lookup: options.lookup,
    });
    const planned = responses[Math.min(index, responses.length - 1)] ?? { status: 200, body: "" };
    index += 1;
    const req = new EventEmitter();
    const end = () => {
      const res = Readable.from([Buffer.from(planned.body ?? "")]) as IncomingMessage;
      res.statusCode = planned.status;
      res.headers = planned.headers ?? {};
      callback(res);
      return req;
    };
    Object.assign(req, { end, destroy: () => req });
    return req;
  });
  return { captured, socketRequest: socketRequest as unknown as NonNullable<DiscoveryDeps["socketRequest"]> };
}

function rebindingLookup(answers: Record<string, string[]>) {
  const calls: string[] = [];
  const lookup = async (hostname: string) => {
    calls.push(hostname);
    const seen = calls.filter((item) => item === hostname).length;
    if (seen > 1) return ["127.0.0.1"];
    return answers[hostname] ?? ["203.0.113.10"];
  };
  return { lookup, calls };
}

async function pinnedAddresses(lookup: https.RequestOptions["lookup"], hostname: string) {
  return new Promise<string[]>((resolve, reject) => {
    if (!lookup) {
      reject(new Error("connection has no pinned lookup"));
      return;
    }
    lookup(hostname, { all: true }, ((error: NodeJS.ErrnoException | null, result: { address: string }[] | string) => {
      if (error) reject(error);
      else if (Array.isArray(result)) resolve(result.map((row) => row.address));
      else resolve([String(result)]);
    }) as never);
  });
}

function job(overrides: Partial<NormalizedEmployerJob> = {}): NormalizedEmployerJob {
  return {
    externalKey: "100",
    title: "Field Technician",
    location: "Austin",
    description: "Maintain plant equipment.",
    sourceUrl: "https://example.com/jobs/100",
    department: "Operations",
    employmentType: "Full-time",
    workplaceType: null,
    publicSalaryText: null,
    compensationMin: null,
    compensationMax: null,
    qualifications: null,
    certifications: null,
    education: null,
    experience: null,
    ...overrides,
  };
}

const publicLookup = async (hostname: string) => {
  if (hostname === "public.example" || hostname === "boards-api.greenhouse.io" || hostname === "jobs.example.com") {
    return ["8.8.8.8"];
  }
  return ["8.8.8.8"];
};

describe("M4 employer opportunity discovery", () => {
  it("ignores whitespace, trivial markup, and tracking parameters in the content hash", () => {
    const base = job();
    const noisy = job({
      description: "  <p>Maintain&nbsp;plant   equipment.</p>  ",
      sourceUrl: "https://example.com/jobs/100?utm_source=board&utm_medium=email",
    });
    expect(employerJobContentHash(base)).toBe(employerJobContentHash(noisy));
    expect(employerJobContentHash(job({ description: "Maintain plant equipment and pumps." }))).not.toBe(
      employerJobContentHash(base),
    );
  });

  it("plans new, unchanged, changed, and closed jobs without closing on an outage", () => {
    const hash = employerJobContentHash(job());
    const existing = [{ externalKey: "100", contentHash: hash, status: "open" }];
    expect(planSourceSync({
      existing,
      discovered: [],
      syncSucceeded: false,
      listingComplete: true,
      closeMissing: true,
    })).toEqual([]);
    expect(planSourceSync({
      existing,
      discovered: [job()],
      syncSucceeded: true,
      listingComplete: true,
      closeMissing: true,
    }).map((item) => item.action)).toEqual(["unchanged"]);
    expect(planSourceSync({
      existing,
      discovered: [job({ description: "Maintain plant equipment and pumps." })],
      syncSucceeded: true,
      listingComplete: true,
      closeMissing: true,
    }).map((item) => item.action)).toEqual(["change"]);
    const closed = planSourceSync({
      existing: [
        ...existing,
        { externalKey: "200", contentHash: "other", status: "open" },
        { externalKey: "300", contentHash: "filled", status: "filled" },
      ],
      discovered: [job()],
      syncSucceeded: true,
      listingComplete: true,
      closeMissing: true,
    });
    expect(closed.filter((item) => item.action === "close").map((item) => item.action === "close" ? item.externalKey : "")).toEqual(["200"]);
    expect(planSourceSync({
      existing,
      discovered: [],
      syncSucceeded: true,
      listingComplete: false,
      closeMissing: false,
    })).toEqual([]);
  });

  it("normalizes a Greenhouse public board job and refuses other automated hosts", async () => {
    const normalized = normalizeGreenhouseJob({
      id: 42,
      title: "Field Technician",
      absolute_url: "https://boards.greenhouse.io/acme/jobs/42?utm_source=test",
      location: { name: "Remote - Austin" },
      content: "<p>Maintain equipment.</p><p>Qualifications</p><p>Two years of maintenance.</p>",
      departments: [{ name: "Operations" }],
      metadata: [{ name: "Employment Type", value: "Full-time" }],
      pay_input_ranges: [{ min_cents: 7_000_000, max_cents: 9_000_000 }],
    });
    expect(normalized.externalKey).toBe("42");
    expect(normalized.sourceUrl).toBe("https://boards.greenhouse.io/acme/jobs/42");
    expect(normalized.workplaceType).toBe("remote");
    expect(normalized.department).toBe("Operations");
    expect(normalized.employmentType).toBe("Full-time");
    expect(normalized.compensationMin).toBe("70000.00");
    expect(normalized.qualifications).toMatch(/Two years/);
    expect(normalized.description).not.toMatch(/military|veteran/i);

    const fixture = { jobs: [{ id: 42, title: "Field Technician", absolute_url: "https://boards.greenhouse.io/acme/jobs/42", location: { name: "Austin" }, content: "<p>Maintain equipment.</p>" }] };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /\n", { status: 200 });
      return new Response(JSON.stringify(fixture), { status: 200 });
    });
    const discovered = await greenhouseAdapter.discover({
      sourceType: "employer_api",
      adapterKey: GREENHOUSE_ADAPTER_KEY,
      careersUrl: "https://boards.greenhouse.io/acme",
    }, { fetchImpl, lookup: publicLookup, minIntervalMs: 0 });
    expect(discovered.ok).toBe(true);
    expect(discovered.complete).toBe(true);
    expect(discovered.jobs).toHaveLength(1);
    expect(discovered.jobs[0]?.externalKey).toBe("42");

    const blockedFetch = vi.fn();
    const blocked = await greenhouseAdapter.discover({
      sourceType: "public_careers_page",
      careersUrl: "https://acme.wd5.myworkdayjobs.com/careers",
    }, { fetchImpl: blockedFetch, lookup: publicLookup, minIntervalMs: 0 });
    expect(blocked.ok).toBe(false);
    expect(blocked.blocked).toBe(true);
    expect(blockedFetch).not.toHaveBeenCalled();
    expect(evaluateSourceAccess({ sourceType: "feed", careersUrl: "https://example.com/jobs.xml" }, "sync").allowed).toBe(false);
    expect(evaluateSourceAccess({ sourceType: "employer_api", adapterKey: "workday", careersUrl: "https://example.com/api" }, "sync").allowed).toBe(false);
    expect(evaluateSourceAccess({ sourceType: "csv" }, "csv").state).toBe("manual_only");
  });

  it("rejects private addresses and redirects into private hosts before fetching them", async () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("127.8.8.8")).toBe(true);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("192.168.1.20")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("172.31.255.255")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("100.64.0.1")).toBe(true);
    expect(isPrivateAddress("100.127.1.1")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:10.1.2.3")).toBe(true);
    expect(isPrivateAddress("::ffff:192.168.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:172.16.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::ffff:a00:1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("203.0.113.10")).toBe(false);

    const fetchImpl = vi.fn(async () => new Response("no", { status: 200 }));
    await expect(safeFetch("http://127.0.0.1/latest/meta-data", { fetchImpl, lookup: publicLookup, minIntervalMs: 0 })).rejects.toThrow(/private|internal|public/i);
    await expect(safeFetch("file:///etc/passwd", { fetchImpl, lookup: publicLookup, minIntervalMs: 0 })).rejects.toThrow(/http/i);
    await expect(safeFetch("http://metadata.google.internal/computeMetadata/v1/", { fetchImpl, lookup: publicLookup, minIntervalMs: 0 })).rejects.toThrow(/public|host/i);
    await expect(safeFetch("https://jobs.example.com/role", {
      fetchImpl,
      lookup: async () => ["10.0.0.5"],
      minIntervalMs: 0,
    })).rejects.toThrow(/private|internal/i);
    expect(fetchImpl).not.toHaveBeenCalled();

    const redirectFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.stringify(init?.headers ?? {}).toLowerCase()).not.toContain("authorization");
      expect(JSON.stringify(init?.headers ?? {}).toLowerCase()).not.toContain("candidate");
      expect(String(input)).toBe("https://public.example/jobs/1");
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    });
    await expect(safeFetch("https://public.example/jobs/1", {
      fetchImpl: redirectFetch,
      lookup: publicLookup,
      minIntervalMs: 0,
    })).rejects.toThrow(/private|internal/i);
    expect(redirectFetch).toHaveBeenCalledTimes(1);
  });

  it("binds the socket to the validated public address and ignores a later private DNS answer", async () => {
    const { captured, socketRequest } = installPinnedSocket([
      { status: 200, body: "User-agent: *\nAllow: /\n" },
      { status: 200, body: JSON.stringify({ jobs: [{ id: 7, title: "Tech", absolute_url: "https://boards.greenhouse.io/acme/jobs/7", location: { name: "Austin" }, content: "<p>Maintain equipment.</p>" }] }) },
      { status: 200, body: "pinned" },
    ]);
    const discovered = await greenhouseAdapter.discover({
      sourceType: "employer_api",
      adapterKey: GREENHOUSE_ADAPTER_KEY,
      careersUrl: "https://boards.greenhouse.io/acme",
    }, { lookup: async () => ["203.0.113.10"], minIntervalMs: 0, socketRequest });
    expect(discovered.ok).toBe(true);
    expect(discovered.jobs[0]?.externalKey).toBe("7");
    expect(captured.map((request) => request.hostname)).toEqual(["boards-api.greenhouse.io", "boards-api.greenhouse.io"]);
    expect(await pinnedAddresses(captured[0]?.lookup, "boards-api.greenhouse.io")).toEqual(["203.0.113.10"]);
    expect(await pinnedAddresses(captured[1]?.lookup, "boards-api.greenhouse.io")).toEqual(["203.0.113.10"]);

    captured.length = 0;
    const rebound = rebindingLookup({ "jobs.example": ["203.0.113.10"] });
    const page = await safeFetch("https://jobs.example/jobs/1", { lookup: rebound.lookup, minIntervalMs: 0, socketRequest });
    expect(page.body).toBe("pinned");
    expect(rebound.calls).toEqual(["jobs.example"]);
    expect(await pinnedAddresses(captured[0]?.lookup, "jobs.example")).toEqual(["203.0.113.10"]);
    expect(captured[0]?.href.startsWith("https://jobs.example/")).toBe(true);
  });

  it("does not connect when validation returns a private, mixed, metadata, or IPv6 internal address", async () => {
    const { socketRequest } = installPinnedSocket([{ status: 200, body: "no" }]);
    await expect(safeFetch("https://jobs.example/role", {
      lookup: async () => ["10.0.0.5"],
      minIntervalMs: 0,
      socketRequest,
    })).rejects.toThrow(/private|internal/i);
    await expect(safeFetch("https://jobs.example/role", {
      lookup: async () => ["203.0.113.10", "192.168.0.4"],
      minIntervalMs: 0,
      socketRequest,
    })).rejects.toThrow(/private|internal/i);
    await expect(safeFetch("http://169.254.169.254/latest/meta-data", { minIntervalMs: 0, socketRequest })).rejects.toThrow(/private|internal|public/i);
    await expect(safeFetch("http://metadata.google.internal/computeMetadata/v1/", { minIntervalMs: 0, socketRequest })).rejects.toThrow(/public|host/i);
    await expect(safeFetch("http://metadata.google.com/", { minIntervalMs: 0, socketRequest })).rejects.toThrow(/public|host/i);
    await expect(safeFetch("http://[::1]/", { minIntervalMs: 0, socketRequest })).rejects.toThrow(/private|internal|public/i);
    await expect(safeFetch("http://[fe80::1]/", { minIntervalMs: 0, socketRequest })).rejects.toThrow(/private|internal|public/i);
    await expect(safeFetch("http://[fd00::1]/", { minIntervalMs: 0, socketRequest })).rejects.toThrow(/private|internal|public/i);
    await expect(safeFetch("https://jobs.example/v6", {
      lookup: async () => ["fe80::1"],
      minIntervalMs: 0,
      socketRequest,
    })).rejects.toThrow(/private|internal/i);
    expect(socketRequest).not.toHaveBeenCalled();
  });

  it("validates each redirect hop and pins that hop's own public address", async () => {
    const { captured, socketRequest } = installPinnedSocket([
      { status: 302, headers: { location: "https://private.example/secret" } },
      { status: 302, headers: { location: "https://b.example/jobs/2" } },
      { status: 200, body: "arrived" },
    ]);
    await expect(safeFetch("https://a.example/jobs/1", {
      lookup: async (hostname) => hostname === "private.example" ? ["10.1.2.3"] : ["203.0.113.10"],
      minIntervalMs: 0,
      socketRequest,
    })).rejects.toThrow(/private|internal/i);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.hostname).toBe("a.example");
    expect(await pinnedAddresses(captured[0]?.lookup, "a.example")).toEqual(["203.0.113.10"]);

    captured.length = 0;
    const hops = rebindingLookup({ "a.example": ["203.0.113.10"], "b.example": ["203.0.113.20"] });
    const page = await safeFetch("https://a.example/jobs/1", { lookup: hops.lookup, minIntervalMs: 0, socketRequest });
    expect(page.status).toBe(200);
    expect(page.body).toBe("arrived");
    expect(page.url).toBe("https://b.example/jobs/2");
    expect(captured.map((request) => request.hostname)).toEqual(["a.example", "b.example"]);
    expect(await pinnedAddresses(captured[0]?.lookup, "a.example")).toEqual(["203.0.113.10"]);
    expect(await pinnedAddresses(captured[1]?.lookup, "b.example")).toEqual(["203.0.113.20"]);
    expect(hops.calls).toEqual(["a.example", "b.example"]);
  });

  it("keeps the original hostname for TLS and still allows a manual field confirm", async () => {
    const { captured, socketRequest } = installPinnedSocket([{ status: 200, body: "ok" }]);
    await safeFetch("https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true", {
      lookup: async () => ["203.0.113.10"],
      minIntervalMs: 0,
      socketRequest,
    });
    expect(captured[0]?.hostname).toBe("boards-api.greenhouse.io");
    expect(captured[0]?.servername).toBe("boards-api.greenhouse.io");
    expect(captured[0]?.rejectUnauthorized).toBe(true);
    expect(captured[0]?.href).not.toContain("203.0.113.10");
    expect(JSON.stringify(captured[0]?.headers).toLowerCase()).not.toContain("authorization");
    expect(JSON.stringify(captured[0]?.headers).toLowerCase()).not.toContain("cookie");
    const host = captured[0]?.headers && "host" in captured[0].headers ? String(captured[0].headers.host) : "";
    expect(host).toBe("boards-api.greenhouse.io");
    expect(await pinnedAddresses(captured[0]?.lookup, "boards-api.greenhouse.io")).toEqual(["203.0.113.10"]);
    const fetcher = readFileSync(path.join(root, "lib/integrations/career-sources/safe-fetch.ts"), "utf8");
    expect(fetcher).toContain("https.request");
    expect(fetcher).toContain("options.rejectUnauthorized = true");
    expect(fetcher).not.toContain("rejectUnauthorized: false");
    expect(fetcher).not.toContain("rejectUnauthorized = false");

    const recruiting = readFileSync(path.join(root, "lib/recruiting/opportunity-discovery.ts"), "utf8");
    const manual = recruiting.slice(
      recruiting.indexOf("export async function importManualJob"),
      recruiting.indexOf("export async function importCsvJobs"),
    );
    expect(manual).not.toContain("safeFetch");
    const actions = readFileSync(path.join(root, "lib/actions/career-sources.ts"), "utf8");
    const confirm = actions.slice(
      actions.indexOf("export async function confirmManualJobAction"),
      actions.indexOf("export async function previewCsvAction"),
    );
    for (const field of ["title", "externalKey", "sourceUrl", "location", "description"]) {
      expect(confirm).toContain(field);
    }
    expect(confirm).not.toContain("safeFetch");
  });

  it("keeps career source health honest", () => {
    expect(careerSourceHealth({
      sourceType: "employer_api",
      adapterKey: GREENHOUSE_ADAPTER_KEY,
      lastSuccessfulSyncAt: null,
    })).toBe("not_yet_synced");
    expect(careerSourceHealth({
      sourceType: "employer_api",
      adapterKey: GREENHOUSE_ADAPTER_KEY,
      lastSuccessfulSyncAt: null,
      failed: true,
    })).toBe("error");
    expect(careerSourceHealth({
      sourceType: "employer_api",
      adapterKey: GREENHOUSE_ADAPTER_KEY,
      lastSuccessfulSyncAt: new Date(),
    })).toBe("live");
    expect(careerSourceHealth({
      sourceType: "manual_url",
      lastSuccessfulSyncAt: new Date(),
    })).toBe("manual");
    expect(careerSourceHealth({
      sourceType: "csv",
      lastSuccessfulSyncAt: null,
    })).not.toBe("live");
    expect(careerSourceHealth({
      sourceType: "employer_api",
      adapterKey: GREENHOUSE_ADAPTER_KEY,
      lastSuccessfulSyncAt: new Date(),
      blocked: true,
    })).toBe("blocked");
  });

  it("parses CSV rows and dedupes external keys before any write", () => {
    const csv = [
      "external_id,title,company,location,description,source_url,open",
      "A1,Technician,Acme,Austin,Maintain pumps,https://example.com/jobs/a1,open",
      "A1,Technician,Acme,Austin,Maintain pumps,https://example.com/jobs/a1,open",
      "A2,Planner,Other Co,Dallas,Plan work,https://example.com/jobs/a2,open",
    ].join("\n");
    const parsed = parseJobCsv(csv, "Acme");
    expect(parsed.jobs.map((row) => row.externalKey)).toEqual(["A1"]);
    expect(parsed.errors.map((issue) => issue.row)).toEqual([3, 4]);
    const again = planSourceSync({
      existing: [{ externalKey: "A1", contentHash: employerJobContentHash(parsed.jobs[0]), status: "open" }],
      discovered: parsed.jobs,
      syncSucceeded: true,
      listingComplete: false,
      closeMissing: false,
    });
    expect(again.map((item) => item.action)).toEqual(["unchanged"]);
  });

  it("does not involve candidate records, match scores, or recruiter CRM access", () => {
    const discovery = readFileSync(path.join(root, "lib/recruiting/opportunity-discovery.ts"), "utf8");
    const adapter = readFileSync(path.join(root, "lib/integrations/career-sources/greenhouse.ts"), "utf8");
    expect(discovery).not.toMatch(/candidateJobMatches|candidate_job_matches|from ["'].*talent/);
    expect(adapter).not.toMatch(/candidate/);
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    expect(readFileSync(path.join(root, "drizzle/0022_m4_opportunity_discovery.sql"), "utf8")).not.toMatch(/DROP TABLE|credential|password|api_key/i);
  });
});
