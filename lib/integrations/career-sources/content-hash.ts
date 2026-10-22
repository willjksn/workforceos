import { createHash } from "node:crypto";

import { isIP } from "node:net";

import type { NormalizedEmployerJob } from "./types";
import { isBlockedHostname, isPrivateAddress } from "./network-guards";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "igshid",
  "ref",
  "ref_src",
]);

/**
 * Content identity for a public posting.
 * HTML tags, entities, and repeated whitespace collapse.
 * Tracking query parameters are removed from URLs.
 * Letter case and added words remain material.
 */
export function employerJobContentHash(job: NormalizedEmployerJob) {
  const payload = {
    title: foldText(job.title),
    location: foldText(job.location),
    description: foldText(job.description),
    department: foldText(job.department),
    employmentType: foldText(job.employmentType),
    workplaceType: foldText(job.workplaceType),
    publicSalaryText: foldText(job.publicSalaryText),
    qualifications: foldText(job.qualifications),
    certifications: foldText(job.certifications),
    education: foldText(job.education),
    experience: foldText(job.experience),
    sourceUrl: canonicalHttpUrl(job.sourceUrl),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function descriptionSnapshot(job: NormalizedEmployerJob) {
  return [
    `Title: ${job.title}`,
    `Location: ${job.location ?? ""}`,
    `Department: ${job.department ?? ""}`,
    `Employment type: ${job.employmentType ?? ""}`,
    `Workplace: ${job.workplaceType ?? ""}`,
    `Compensation: ${job.publicSalaryText ?? ""}`,
    `Qualifications: ${job.qualifications ?? ""}`,
    `Certifications: ${job.certifications ?? ""}`,
    `Education: ${job.education ?? ""}`,
    `Experience: ${job.experience ?? ""}`,
    "Description:",
    job.description ?? "",
  ].join("\n");
}

export function htmlToText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/(div|li|h1|h2|h3|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function foldText(value: string | null | undefined) {
  if (!value) return "";
  return stripTrackingUrls(htmlToText(value)).replace(/\s+/g, " ").trim();
}

export function readableText(value: string | null | undefined, max = 20_000) {
  if (!value) return null;
  const text = stripTrackingUrls(htmlToText(value)).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

export function canonicalHttpUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Source URL must be a valid http or https link.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Source URL must be http or https.");
  }
  if (url.username || url.password) throw new Error("Source URL cannot include credentials.");
  const host = url.hostname;
  if (isBlockedHostname(host)) throw new Error("Source URL is not a public http(s) link.");
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare) && isPrivateAddress(bare)) throw new Error("Source URL uses a private or internal address.");
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) continue;
    kept.append(key, value);
  }
  url.search = kept.toString() ? `?${kept.toString()}` : "";
  url.hash = "";
  return url.href;
}

export function compensationBounds(text: string | null) {
  if (!text || !text.includes("$")) return { min: null as string | null, max: null as string | null };
  const amounts = [...text.matchAll(/\$\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*([kK])?/g)].map((match) => {
    const amount = Number(match[1].replace(/,/g, ""));
    return match[2] ? amount * 1000 : amount;
  }).filter((amount) => Number.isFinite(amount) && amount >= 1000);
  if (!amounts.length) return { min: null, max: null };
  return { min: Math.min(...amounts).toFixed(2), max: Math.max(...amounts).toFixed(2) };
}

function stripTrackingUrls(value: string) {
  return value.replace(/https?:\/\/[^\s<>"')]+/gi, (match) => {
    try {
      return canonicalHttpUrl(match.replace(/[.,;]+$/, ""));
    } catch {
      return match;
    }
  });
}
