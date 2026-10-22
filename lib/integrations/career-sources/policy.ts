import { GREENHOUSE_ADAPTER_KEY, type CareerSourceConfig, type SourceAccessState } from "./types";
import { isBlockedHostname, isPrivateAddress } from "./network-guards";
import { isIP } from "node:net";

const BLOCKED_ATS_SUFFIXES = [
  "myworkdayjobs.com",
  "workday.com",
  "icims.com",
  "taleo.net",
  "successfactors.com",
  "successfactors.eu",
  "oraclecloud.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
];

const BOARD_TOKEN = /^[A-Za-z0-9_-]{1,80}$/;

export type SourceAccess = {
  state: SourceAccessState;
  allowed: boolean;
  reason: string;
};

/**
 * Discovery is allowlisted. An operator cannot paste an arbitrary URL and start a crawler.
 * Automated sync is only the Greenhouse public job board API.
 * One public job page may be fetched for manual URL import when the host is not a login-wall ATS.
 * CSV never triggers an outbound fetch.
 */
export function evaluateSourceAccess(
  source: CareerSourceConfig,
  action: "sync" | "fetch_one" | "csv" | "test",
  targetUrl?: string | null,
): SourceAccess {
  const configured = firstUrl(source);
  const target = targetUrl?.trim() || configured;
  if (target && unsafeUrl(target)) {
    return {
      state: "blocked",
      allowed: false,
      reason: "That URL is private, internal, or not http(s). It was not fetched.",
    };
  }
  if (target && blockedAtsHost(target)) {
    return {
      state: "blocked",
      allowed: false,
      reason: "This host is a login-wall or unsupported careers site. Automated access is not attempted. Enter the job by URL fields or CSV.",
    };
  }

  if (action === "csv") {
    if (source.sourceType !== "csv") {
      return { state: "error", allowed: false, reason: "CSV import requires a CSV career source." };
    }
    return { state: "manual_only", allowed: true, reason: "CSV import reads the uploaded file only. It does not fetch career sites." };
  }

  if (action === "sync") {
    if (source.sourceType !== "employer_api" || source.adapterKey !== GREENHOUSE_ADAPTER_KEY) {
      return {
        state: "manual_only",
        allowed: false,
        reason: "Automated sync is only available for the Greenhouse public job board. Use manual URL or CSV for this source.",
      };
    }
    if (!greenhouseBoardToken(source.careersUrl, source.baseUrl)) {
      return {
        state: "error",
        allowed: false,
        reason: "Greenhouse sync needs an https boards.greenhouse.io or boards-api.greenhouse.io URL. Other URLs are not crawled.",
      };
    }
    return {
      state: "supported_structured",
      allowed: true,
      reason: "Greenhouse public job board API is the structured adapter for this source.",
    };
  }

  if (action === "fetch_one") {
    if (source.sourceType !== "manual_url" && source.sourceType !== "public_careers_page") {
      return {
        state: "manual_only",
        allowed: false,
        reason: "A single public page can be fetched only for a manual URL or public careers page source.",
      };
    }
    if (!target) return { state: "error", allowed: false, reason: "Enter one public job URL." };
    return {
      state: "supported_public",
      allowed: true,
      reason: "One public page can be fetched. Linked pages are not followed as a crawl.",
    };
  }

  if (source.sourceType === "employer_api" && source.adapterKey === GREENHOUSE_ADAPTER_KEY && greenhouseBoardToken(source.careersUrl, source.baseUrl)) {
    return { state: "supported_structured", allowed: true, reason: "Greenhouse public job board can be tested. A test does not import jobs." };
  }
  if (source.sourceType === "employer_api") {
    return {
      state: "error",
      allowed: false,
      reason: "M4 automates only the Greenhouse public job board. Other employer APIs are not called.",
    };
  }
  return {
    state: "manual_only",
    allowed: true,
    reason: "This source is manual. Testing it does not crawl the site.",
  };
}

export function greenhouseBoardToken(careersUrl?: string | null, baseUrl?: string | null) {
  for (const raw of [careersUrl, baseUrl]) {
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    const host = url.hostname.toLowerCase();
    if (host === "boards-api.greenhouse.io") {
      const match = url.pathname.match(/^\/v1\/boards\/([^/]+)\/jobs\/?$/);
      const token = match?.[1] ? decodeURIComponent(match[1]) : "";
      if (BOARD_TOKEN.test(token)) return token;
    }
    if (host === "boards.greenhouse.io") {
      const parts = url.pathname.split("/").filter(Boolean);
      const token = parts[0] === "embed" ? (url.searchParams.get("for") ?? "") : (parts[0] ?? "");
      if (BOARD_TOKEN.test(token)) return token;
    }
  }
  return null;
}

export function greenhouseJobsUrl(token: string, withContent: boolean) {
  const url = new URL(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`);
  if (withContent) url.searchParams.set("content", "true");
  return url.href;
}

function firstUrl(source: CareerSourceConfig) {
  return source.careersUrl?.trim() || source.baseUrl?.trim() || null;
}

function unsafeUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return true;
    if (isBlockedHostname(url.hostname)) return true;
    const bare = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(bare) && isPrivateAddress(bare)) return true;
    return false;
  } catch {
    return true;
  }
}

function blockedAtsHost(raw: string) {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return BLOCKED_ATS_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}
