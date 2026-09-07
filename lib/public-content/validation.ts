import { stripHtml } from "../public-api/normalize";
import {
  PUBLIC_CONTENT_PLACEMENTS,
  PUBLIC_CONTENT_STYLES,
  PUBLIC_CONTENT_TYPES,
  PUBLIC_INDUSTRY_CODES,
  type PublicContentWriteInput,
} from "./types";

export class PublicContentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PublicContentError";
  }
}

const TITLE_MAX = 160;
const BODY_MAX = 800;
const CTA_LABEL_MAX = 60;
const CTA_URL_MAX = 300;
const IMAGE_KEY_MAX = 200;

export function sanitizePlainText(value: string | null | undefined, max: number, field: string) {
  if (value == null) return null;
  const raw = String(value);
  if (/<[^>]*>/.test(raw) || raw.includes("\0")) {
    throw new PublicContentError(`${field} cannot include HTML.`);
  }
  const stripped = stripHtml(raw);
  if (stripped.length > max) {
    throw new PublicContentError(`${field} is too long.`);
  }
  return stripped || null;
}

export function assertSafeCtaUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > CTA_URL_MAX) throw new PublicContentError("CTA URL is too long.");
  const lower = trimmed.toLowerCase();
  if (/[\s<>]/.test(trimmed) || lower.includes("javascript:") || lower.includes("data:") || lower.includes("vbscript:")) {
    throw new PublicContentError("CTA URL is not allowed.");
  }
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.includes("..")) {
      throw new PublicContentError("CTA path is not allowed.");
    }
    return trimmed;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PublicContentError("CTA URL is not valid.");
  }
  if (parsed.protocol !== "https:") {
    throw new PublicContentError("CTA URL must be an https URL or a site path.");
  }
  return parsed.toString();
}

export function defaultPlacement(contentType: PublicContentWriteInput["contentType"]) {
  switch (contentType) {
    case "featured_job":
    case "urgent_hiring_notice":
      return "careers" as const;
    case "featured_skillbridge":
      return "skillbridge" as const;
    default:
      return "home" as const;
  }
}

export function normalizePublicContentInput(input: PublicContentWriteInput): PublicContentWriteInput {
  if (!PUBLIC_CONTENT_TYPES.includes(input.contentType)) {
    throw new PublicContentError("Unknown public content type.");
  }
  const placement = input.placement || defaultPlacement(input.contentType);
  if (!PUBLIC_CONTENT_PLACEMENTS.includes(placement)) {
    throw new PublicContentError("Invalid placement.");
  }
  const title = sanitizePlainText(input.title, TITLE_MAX, "Title");
  if (!title) throw new PublicContentError("Title is required.");
  const body = sanitizePlainText(input.body, BODY_MAX, "Body");
  const ctaLabel = sanitizePlainText(input.ctaLabel, CTA_LABEL_MAX, "CTA label");
  const ctaUrl = assertSafeCtaUrl(input.ctaUrl);
  if (input.styleVariant && !PUBLIC_CONTENT_STYLES.includes(input.styleVariant)) {
    throw new PublicContentError("Style must be Navy, Teal, or Light.");
  }
  const featureImageKey = sanitizePlainText(input.featureImageKey, IMAGE_KEY_MAX, "Image reference");
  if (featureImageKey && !featureImageKey.startsWith("/images/") && !featureImageKey.startsWith("brand/")) {
    throw new PublicContentError("Image reference must be a site image path.");
  }
  const industryCode = input.industryCode?.trim() || null;
  if (industryCode && !PUBLIC_INDUSTRY_CODES.includes(industryCode as (typeof PUBLIC_INDUSTRY_CODES)[number])) {
    throw new PublicContentError("Unknown industry.");
  }
  if (input.contentType === "featured_industry_campaign" && !industryCode) {
    throw new PublicContentError("Industry campaign requires an industry.");
  }
  if (
    (input.contentType === "featured_job" || input.contentType === "featured_skillbridge") &&
    !input.linkedJobId
  ) {
    throw new PublicContentError("A published job is required.");
  }
  const startsAt = input.startsAt ?? null;
  const endsAt = input.endsAt ?? null;
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new PublicContentError("End date must be after the start date.");
  }
  const priority = Number.isFinite(input.priority) ? Math.max(1, Math.min(999, Math.round(input.priority as number))) : 100;
  return {
    contentType: input.contentType,
    title,
    body,
    ctaLabel,
    ctaUrl,
    linkedJobId: input.linkedJobId ?? null,
    industryCode,
    placement,
    styleVariant: input.styleVariant ?? (input.contentType === "homepage_banner" ? "navy" : null),
    featureImageKey,
    priority,
    startsAt,
    endsAt,
    isActive: Boolean(input.isActive),
  };
}

export function isScheduleLive(input: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  if (!input.isActive) return false;
  if (input.startsAt && input.startsAt > now) return false;
  if (input.endsAt && input.endsAt <= now) return false;
  return true;
}

export function publicContentStatus(
  input: { isActive: boolean; startsAt: Date | null; endsAt: Date | null; archivedAt?: Date | null },
  now = new Date(),
) {
  if (input.archivedAt) return "inactive" as const;
  if (!input.isActive) return "draft" as const;
  if (input.endsAt && input.endsAt <= now) return "expired" as const;
  if (input.startsAt && input.startsAt > now) return "scheduled" as const;
  return "live" as const;
}
