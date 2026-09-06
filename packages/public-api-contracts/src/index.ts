import { z } from "zod";

/** Public DTO contract. Not a Drizzle row. Safe for the PierOne website. */

export const SERVICE_INTEREST = [
  "professional-search",
  "military-talent-opportunity-assessment",
  "ta-performance-assessment",
  "fractional-talent-partner",
  "workforce-pipeline-assessment",
  "other",
] as const;

export type ServiceInterest = (typeof SERVICE_INTEREST)[number];

export const publicJobSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  workplaceType: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  salaryDisplay: z.string().nullable().optional(),
  companyDisplay: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  skillbridgeEligible: z.boolean().optional(),
  skillbridgeDisclaimer: z.string().nullable().optional(),
  jobContextType: z.enum(["internal", "client", "skillbridge"]).optional(),
  applicationOpen: z.boolean().optional(),
});

export type PublicJob = z.infer<typeof publicJobSchema>;

export const publicJobsResponseSchema = z.object({
  jobs: z.array(publicJobSchema),
});

export const publicJobResponseSchema = z.object({
  job: publicJobSchema,
});

export const utmSchema = z.object({
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
});

export const inquiryPayloadSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().min(1).max(200),
  title: z.string().trim().max(120).optional(),
  companyWebsite: z.string().trim().max(300).optional(),
  serviceInterest: z.enum(SERVICE_INTEREST),
  challenge: z.string().trim().min(1).max(4000),
  timeline: z.string().trim().max(200).optional(),
  roleCount: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  referralSource: z.string().trim().max(200).optional(),
  landingUrl: z.string().trim().max(500).optional(),
  referrer: z.string().trim().max(500).optional(),
  pagePath: z.string().trim().max(200).optional(),
  consent: z.boolean().optional(),
  honeypot: z.string().max(200).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
});

export type InquiryPayload = z.infer<typeof inquiryPayloadSchema>;

export const inquiryAcceptedSchema = z.object({
  accepted: z.literal(true),
  inquiryId: z.string().uuid().optional(),
});

export const militaryBranchSchema = z.enum([
  "army",
  "navy",
  "air_force",
  "marine_corps",
  "coast_guard",
  "space_force",
]);

export const militaryTalentPayloadSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  branch: militaryBranchSchema.optional(),
  mos: z.string().trim().max(40).optional(),
  rank: z.string().trim().max(80).optional(),
  currentInstallation: z.string().trim().max(200).optional(),
  currentLocation: z.string().trim().max(200).optional(),
  separationDate: z.string().trim().max(40).optional(),
  skillbridgeWindowStart: z.string().trim().max(40).optional(),
  skillbridgeWindowEnd: z.string().trim().max(40).optional(),
  skillbridgeApprovalStatus: z.string().trim().max(40).optional(),
  preferredLocation: z.string().trim().max(200).optional(),
  relocationWillingness: z.string().trim().max(80).optional(),
  remotePreference: z.string().trim().max(80).optional(),
  targetCivilianRoles: z.string().trim().max(2000).optional(),
  idealIndustry: z.string().trim().max(200).optional(),
  idealEmployer: z.string().trim().max(200).optional(),
  linkedinUrl: z.string().trim().max(300).optional(),
  consent: z.boolean().optional(),
  honeypot: z.string().max(200).optional(),
  landingUrl: z.string().trim().max(500).optional(),
  referrer: z.string().trim().max(500).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
});

export type MilitaryTalentPayload = z.infer<typeof militaryTalentPayloadSchema>;

export const militaryTalentAcceptedSchema = z.object({
  accepted: z.literal(true),
});

export const applicationPayloadSchema = z.object({
  slug: z.string().min(1).max(120),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  linkedinUrl: z.string().trim().max(300).optional(),
  workAuthorization: z.string().trim().max(200).optional(),
  branch: z.string().trim().max(40).optional(),
  mos: z.string().trim().max(40).optional(),
  rank: z.string().trim().max(80).optional(),
  installation: z.string().trim().max(200).optional(),
  honeypot: z.string().max(200).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
});

export type ApplicationPayload = z.infer<typeof applicationPayloadSchema>;

export const applicationAcceptedSchema = z.object({
  accepted: z.literal(true),
});

export const publicErrorSchema = z.object({
  error: z.string(),
});

export const publicHealthSchema = z.object({
  ok: z.boolean(),
  service: z.literal("workforceos-public-gateway"),
});

export const HMAC_HEADER_TIMESTAMP = "x-pierone-site-timestamp";
export const HMAC_HEADER_SIGNATURE = "x-pierone-site-signature";

export const publicFeaturedJobSchema = z.object({
  slug: z.string(),
  title: z.string(),
  location: z.string().nullable().optional(),
  companyDisplay: z.string().nullable().optional(),
  skillbridgeEligible: z.boolean().optional(),
  featureCopy: z.string().nullable().optional(),
});

export const publicBannerSchema = z.object({
  title: z.string(),
  body: z.string().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  styleVariant: z.enum(["navy", "teal", "light"]),
});

export const publicAnnouncementSchema = z.object({
  headline: z.string(),
  body: z.string().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  placement: z.enum(["home", "careers", "skillbridge", "site_wide"]),
});

export const publicCampaignSchema = z.object({
  industry: z.string(),
  headline: z.string(),
  summary: z.string().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  imageKey: z.string().nullable().optional(),
});

export const publicUrgentNoticeSchema = z.object({
  headline: z.string(),
  body: z.string().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  jobSlug: z.string().nullable().optional(),
});

export const publicContentResponseSchema = z.object({
  featuredJobs: z.array(publicFeaturedJobSchema),
  featuredSkillBridge: z.array(publicFeaturedJobSchema),
  banners: z.array(publicBannerSchema),
  announcements: z.array(publicAnnouncementSchema),
  campaigns: z.array(publicCampaignSchema),
  urgentNotices: z.array(publicUrgentNoticeSchema),
});

export type PublicContentResponse = z.infer<typeof publicContentResponseSchema>;
export type PublicFeaturedJob = z.infer<typeof publicFeaturedJobSchema>;

export const EMPTY_PUBLIC_CONTENT: PublicContentResponse = {
  featuredJobs: [],
  featuredSkillBridge: [],
  banners: [],
  announcements: [],
  campaigns: [],
  urgentNotices: [],
};
