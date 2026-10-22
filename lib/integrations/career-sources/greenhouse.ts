import { canonicalHttpUrl, compensationBounds, htmlToText, readableText } from "./content-hash";
import { evaluateSourceAccess, greenhouseBoardToken, greenhouseJobsUrl } from "./policy";
import { originAllowsFetch, safeFetch } from "./safe-fetch";
import {
  GREENHOUSE_ADAPTER_KEY,
  MAX_DISCOVERED_JOBS,
  type CareerSourceConfig,
  type DiscoverResult,
  type DiscoveryDeps,
  type NormalizedEmployerJob,
} from "./types";

type GreenhouseRaw = {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  location?: { name?: string | null };
  content?: string | null;
  departments?: { name?: string | null }[];
  metadata?: { name?: string | null; value?: string | null }[] | null;
  pay_input_ranges?: { min_cents?: number; max_cents?: number }[] | null;
};

export type CareerSourceAdapter = {
  id: string;
  canHandle(source: CareerSourceConfig): boolean;
  discover(source: CareerSourceConfig, deps?: DiscoveryDeps): Promise<DiscoverResult>;
  normalize(rawJob: unknown): NormalizedEmployerJob;
  healthCheck(source: CareerSourceConfig, deps?: DiscoveryDeps): Promise<{ ok: boolean; blocked: boolean; message: string }>;
};

export const greenhouseAdapter: CareerSourceAdapter = {
  id: GREENHOUSE_ADAPTER_KEY,
  canHandle(source) {
    return source.sourceType === "employer_api"
      && source.adapterKey === GREENHOUSE_ADAPTER_KEY
      && greenhouseBoardToken(source.careersUrl, source.baseUrl) !== null;
  },
  discover(source, deps) {
    return discoverGreenhouse(source, deps, true);
  },
  normalize(rawJob) {
    return normalizeGreenhouseJob(rawJob);
  },
  async healthCheck(source, deps) {
    const access = evaluateSourceAccess(source, "test");
    if (!access.allowed || access.state !== "supported_structured") {
      return { ok: false, blocked: access.state === "blocked", message: access.reason };
    }
    const result = await discoverGreenhouse(source, deps, false);
    if (result.blocked) return { ok: false, blocked: true, message: result.error ?? "Source blocked automated access." };
    if (!result.ok) return { ok: false, blocked: false, message: result.error ?? "Greenhouse health check failed." };
    return { ok: true, blocked: false, message: "Greenhouse public board responded. Jobs are not imported until you run sync." };
  },
};

export function normalizeGreenhouseJob(rawJob: unknown): NormalizedEmployerJob {
  const raw = rawJob as GreenhouseRaw;
  const externalKey = raw?.id === undefined || raw.id === null ? "" : String(raw.id).trim();
  const title = raw?.title?.trim() ?? "";
  if (!externalKey || !title || !raw?.absolute_url) {
    throw new Error("Greenhouse job is missing an id, title, or public URL.");
  }
  const sourceUrl = canonicalHttpUrl(raw.absolute_url);
  const location = textOrNull(raw.location?.name);
  const salary = salaryFromGreenhouse(raw);
  const description = readableText(raw.content);
  const plain = description ?? "";
  return {
    externalKey,
    title: title.slice(0, 200),
    location,
    description,
    sourceUrl,
    department: textOrNull(raw.departments?.find((row) => row.name)?.name),
    employmentType: metadataValue(raw, /^employment type$/i),
    workplaceType: workplaceFromLocation(location),
    publicSalaryText: salary.text,
    compensationMin: salary.min,
    compensationMax: salary.max,
    qualifications: sectionAfter(plain, ["qualifications", "requirements", "basic qualifications", "what you'll need", "what you will need"]),
    certifications: sectionAfter(plain, ["certifications", "licenses"]),
    education: sectionAfter(plain, ["education"]),
    experience: sectionAfter(plain, ["experience"]),
  };
}

async function discoverGreenhouse(source: CareerSourceConfig, deps: DiscoveryDeps | undefined, withContent: boolean): Promise<DiscoverResult> {
  const empty: DiscoverResult = {
    ok: false,
    blocked: false,
    complete: false,
    jobs: [],
    errors: [],
    discoveredCount: 0,
    error: null,
  };
  const access = evaluateSourceAccess(source, "sync");
  if (!access.allowed) {
    return { ...empty, blocked: access.state === "blocked", error: access.reason };
  }
  const token = greenhouseBoardToken(source.careersUrl, source.baseUrl);
  if (!token) return { ...empty, error: "Greenhouse board URL is missing." };
  const jobsUrl = new URL(greenhouseJobsUrl(token, withContent));
  const robots = await originAllowsFetch(jobsUrl, deps ?? {});
  if (!robots.allowed) {
    return { ...empty, blocked: robots.blocked, error: robots.reason };
  }
  let response: { status: number; body: string };
  try {
    response = await safeFetch(jobsUrl.href, deps);
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "Greenhouse request failed." };
  }
  if (response.status === 401 || response.status === 403) {
    return { ...empty, blocked: true, error: "Greenhouse refused the public board request. Login walls are not bypassed." };
  }
  if (response.status < 200 || response.status >= 300) {
    return { ...empty, error: `Greenhouse returned HTTP ${response.status}. Existing jobs were not closed.` };
  }
  let parsed: { jobs?: unknown };
  try {
    parsed = JSON.parse(response.body) as { jobs?: unknown };
  } catch {
    return { ...empty, error: "Greenhouse did not return JSON. Existing jobs were not closed." };
  }
  if (!Array.isArray(parsed.jobs)) {
    return { ...empty, error: "Greenhouse response had no jobs array. Existing jobs were not closed." };
  }
  const complete = parsed.jobs.length <= MAX_DISCOVERED_JOBS;
  const jobs: NormalizedEmployerJob[] = [];
  const errors: DiscoverResult["errors"] = [];
  for (const raw of parsed.jobs.slice(0, MAX_DISCOVERED_JOBS)) {
    try {
      jobs.push(normalizeGreenhouseJob(raw));
    } catch (error) {
      const id = raw && typeof raw === "object" && "id" in raw ? String((raw as { id?: unknown }).id ?? "") : null;
      errors.push({ externalKey: id, message: error instanceof Error ? error.message : "Job could not be normalized." });
    }
  }
  if (!complete) {
    errors.push({
      externalKey: null,
      message: `Listing has ${parsed.jobs.length} jobs. Only ${MAX_DISCOVERED_JOBS} were stored, and missing jobs were not closed.`,
    });
  }
  return {
    ok: true,
    blocked: false,
    complete,
    jobs,
    errors,
    discoveredCount: parsed.jobs.length,
    error: complete ? null : `Sync stored ${MAX_DISCOVERED_JOBS} of ${parsed.jobs.length} jobs. Closures were skipped.`,
  };
}

function salaryFromGreenhouse(raw: GreenhouseRaw) {
  const range = raw.pay_input_ranges?.find((row) => typeof row.min_cents === "number" || typeof row.max_cents === "number");
  if (range) {
    const min = typeof range.min_cents === "number" ? (range.min_cents / 100).toFixed(2) : null;
    const max = typeof range.max_cents === "number" ? (range.max_cents / 100).toFixed(2) : null;
    const text = [min ? `$${Number(min).toLocaleString("en-US")}` : null, max ? `$${Number(max).toLocaleString("en-US")}` : null]
      .filter(Boolean)
      .join("–");
    return { text: text || null, min, max };
  }
  const value = metadataValue(raw, /salary|compensation|pay/i);
  if (!value) return { text: null, min: null, max: null };
  const bounds = compensationBounds(value);
  return { text: value, min: bounds.min, max: bounds.max };
}

function metadataValue(raw: GreenhouseRaw, pattern: RegExp) {
  const row = raw.metadata?.find((item) => pattern.test(item.name ?? "") && item.value?.trim());
  return textOrNull(row?.value);
}

function workplaceFromLocation(location: string | null) {
  if (!location) return null;
  const value = location.toLowerCase();
  if (value.includes("hybrid")) return "hybrid";
  if (value.includes("remote")) return "remote";
  if (value.includes("on-site") || value.includes("onsite")) return "onsite";
  return null;
}

export function sectionAfter(text: string, headings: string[]) {
  if (!text) return null;
  const lines = text.split(/\n/);
  const wanted = new Set(headings.map((heading) => heading.toLowerCase()));
  const start = lines.findIndex((line) => wanted.has(line.trim().toLowerCase().replace(/:$/, "")));
  if (start < 0) return null;
  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (collected.length) break;
      continue;
    }
    if (collected.length && trimmed.length < 60 && !/[.!?]$/.test(trimmed) && /^[A-Z]/.test(trimmed)) break;
    collected.push(trimmed);
    if (collected.join(" ").length > 1500) break;
  }
  const section = collected.join("\n").trim();
  return section ? section.slice(0, 2000) : null;
}

function textOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

export function extractPublicJobPage(html: string, pageUrl: string): NormalizedEmployerJob {
  const title = metaContent(html, "og:title") || tagText(html, "title") || tagText(html, "h1") || "";
  const description = readableText(mainHtml(html));
  const plain = `${htmlToText(html)}`;
  const location = labeledLine(plain, "location");
  const salaryLine = labeledLine(plain, "salary") || labeledLine(plain, "compensation");
  const bounds = compensationBounds(salaryLine);
  return {
    externalKey: canonicalHttpUrl(pageUrl),
    title: title.trim().slice(0, 200),
    location,
    description,
    sourceUrl: canonicalHttpUrl(pageUrl),
    department: labeledLine(plain, "department"),
    employmentType: labeledLine(plain, "employment type") || labeledLine(plain, "job type"),
    workplaceType: workplaceFromLocation(location),
    publicSalaryText: salaryLine,
    compensationMin: bounds.min,
    compensationMax: bounds.max,
    qualifications: sectionAfter(plain, ["qualifications", "requirements", "basic qualifications"]),
    certifications: sectionAfter(plain, ["certifications", "licenses"]),
    education: sectionAfter(plain, ["education"]),
    experience: sectionAfter(plain, ["experience"]),
  };
}

function metaContent(html: string, property: string) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i");
  return decode(html.match(pattern)?.[1] || html.match(reverse)?.[1] || "");
}

function tagText(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? htmlToText(match[1]).replace(/\s+/g, " ").trim() : "";
}

function mainHtml(html: string) {
  const main = html.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i);
  return main?.[2] ?? html;
}

function labeledLine(text: string, label: string) {
  const match = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*:\\s*(.+)`, "i"));
  const value = match?.[1]?.trim();
  return value ? value.slice(0, 300) : null;
}

function decode(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
