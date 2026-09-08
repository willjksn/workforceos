export const PUBLIC_CONTENT_TYPES = [
  "featured_job",
  "featured_skillbridge",
  "homepage_banner",
  "urgent_hiring_notice",
  "temporary_announcement",
  "featured_industry_campaign",
] as const;

export type PublicContentType = (typeof PUBLIC_CONTENT_TYPES)[number];

export const PUBLIC_CONTENT_PLACEMENTS = ["home", "careers", "skillbridge", "site_wide"] as const;
export type PublicContentPlacement = (typeof PUBLIC_CONTENT_PLACEMENTS)[number];

export const PUBLIC_CONTENT_STYLES = ["navy", "teal", "light"] as const;
export type PublicContentStyle = (typeof PUBLIC_CONTENT_STYLES)[number];

export const PUBLIC_INDUSTRY_CODES = [
  "energy",
  "manufacturing",
  "infrastructure",
  "operations",
  "data-centers",
  "aerospace",
  "engineering",
  "logistics",
] as const;

export type PublicIndustryCode = (typeof PUBLIC_INDUSTRY_CODES)[number];

export const PUBLIC_CONTENT_TYPE_LABELS: Record<PublicContentType, string> = {
  featured_job: "Featured job",
  featured_skillbridge: "Featured SkillBridge-eligible employer opportunity",
  homepage_banner: "Homepage banner",
  urgent_hiring_notice: "Urgent hiring notice",
  temporary_announcement: "Temporary announcement",
  featured_industry_campaign: "Industry campaign",
};

export type PublicContentStatus = "draft" | "scheduled" | "live" | "expired" | "inactive";

export const PUBLIC_CONTENT_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=120";
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 60;

export const EMPTY_PUBLIC_CONTENT = {
  featuredJobs: [],
  featuredSkillBridge: [],
  banners: [],
  announcements: [],
  campaigns: [],
  urgentNotices: [],
} as const;

export function filterPublicContentByPlacement<T extends {
  featuredJobs: readonly unknown[];
  featuredSkillBridge: readonly unknown[];
  banners: readonly unknown[];
  announcements: ReadonlyArray<{ placement: string }>;
  campaigns: readonly unknown[];
  urgentNotices: readonly unknown[];
}>(payload: T, placement?: string | null): T {
  if (!placement) return payload;
  const normalized = placement.trim().toLowerCase().replaceAll("-", "_") as PublicContentPlacement;
  if (!PUBLIC_CONTENT_PLACEMENTS.includes(normalized)) return payload;
  const announcementOk = (value: string) => value === normalized || value === "site_wide";
  return {
    ...payload,
    featuredJobs: normalized === "home" || normalized === "careers" ? payload.featuredJobs : [],
    featuredSkillBridge: normalized === "home" || normalized === "skillbridge" ? payload.featuredSkillBridge : [],
    banners: normalized === "home" ? payload.banners : [],
    announcements: payload.announcements.filter((row) => announcementOk(row.placement)),
    campaigns: normalized === "home" ? payload.campaigns : [],
    urgentNotices: normalized === "careers" ? payload.urgentNotices : [],
  };
}

export type PublicContentWriteInput = {
  contentType: PublicContentType;
  title: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  linkedJobId?: string | null;
  industryCode?: string | null;
  placement: PublicContentPlacement;
  styleVariant?: PublicContentStyle | null;
  featureImageKey?: string | null;
  priority?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
};
