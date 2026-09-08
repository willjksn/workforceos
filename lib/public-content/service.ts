import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "../../db";
import { jobPostings, jobs, publicContentItems } from "../../db/schema";
import { recordAuditEvent } from "../audit/record-audit-event";
import { toPublicJob } from "../hiring/service";
import { resolvePublicOrganizationId } from "../public-api/organization";
import { can, requirePermission, type Principal } from "../rbac/permissions";
import { notifyPublicSiteRevalidate } from "./notify-public-site";
import {
  PublicContentError,
  isScheduleLive,
  normalizePublicContentInput,
  publicContentStatus,
} from "./validation";
import {
  PUBLIC_CONTENT_CACHE_CONTROL,
  type PublicContentType,
  type PublicContentWriteInput,
} from "./types";

export { PUBLIC_CONTENT_CACHE_CONTROL };

function jobIsPubliclyOpen(
  posting: typeof jobPostings.$inferSelect,
  job: typeof jobs.$inferSelect,
  now = new Date(),
) {
  if (job.archivedAt) return false;
  if (job.status === "closed" || job.status === "cancelled" || job.status === "filled") return false;
  if (posting.visibility !== "public") return false;
  if (posting.publicStatus !== "published") return false;
  if (!posting.applicationOpen) return false;
  if (posting.expiresAt && posting.expiresAt <= now) return false;
  return true;
}

async function loadPublicPosting(organizationId: string, jobId: string) {
  const db = getDb();
  const [row] = await db
    .select({ posting: jobPostings, job: jobs })
    .from(jobPostings)
    .innerJoin(jobs, eq(jobs.id, jobPostings.jobId))
    .where(and(eq(jobPostings.jobId, jobId), eq(jobPostings.organizationId, organizationId), isNull(jobs.archivedAt)))
    .limit(1);
  return row ?? null;
}

async function assertLinkedJob(input: {
  organizationId: string;
  contentType: PublicContentType;
  linkedJobId?: string | null;
}) {
  if (input.contentType !== "featured_job" && input.contentType !== "featured_skillbridge" && !input.linkedJobId) {
    return null;
  }
  if (!input.linkedJobId) {
    if (input.contentType === "featured_job" || input.contentType === "featured_skillbridge") {
      throw new PublicContentError("A published job is required.");
    }
    return null;
  }
  const row = await loadPublicPosting(input.organizationId, input.linkedJobId);
  if (!row) throw new PublicContentError("Linked job was not found.");
  if (!jobIsPubliclyOpen(row.posting, row.job)) {
    throw new PublicContentError("Only public, published, open jobs can be featured.");
  }
  if (input.contentType === "featured_skillbridge" && !row.posting.skillbridgeEligible && row.job.jobContextType !== "skillbridge") {
    throw new PublicContentError("That role is not a SkillBridge-eligible employer opportunity.");
  }
  return row;
}

export async function listFeatureableJobs(organizationId: string, skillbridgeOnly = false) {
  const db = getDb();
  const rows = await db
    .select({ posting: jobPostings, job: jobs })
    .from(jobPostings)
    .innerJoin(jobs, eq(jobs.id, jobPostings.jobId))
    .where(
      and(
        eq(jobPostings.organizationId, organizationId),
        eq(jobPostings.visibility, "public"),
        eq(jobPostings.publicStatus, "published"),
        eq(jobPostings.applicationOpen, true),
        isNull(jobs.archivedAt),
      ),
    )
    .orderBy(asc(jobPostings.publicTitle));
  return rows
    .filter((row) => jobIsPubliclyOpen(row.posting, row.job))
    .filter((row) =>
      skillbridgeOnly ? row.posting.skillbridgeEligible || row.job.jobContextType === "skillbridge" : true,
    )
    .map((row) => ({
      jobId: row.job.id,
      slug: row.posting.slug,
      title: row.posting.publicTitle,
      location: row.posting.location,
      skillbridgeEligible: row.posting.skillbridgeEligible,
    }));
}

export async function listPublicContentItems(input: {
  principal: Principal;
  contentType?: PublicContentType;
  includeArchived?: boolean;
}) {
  requirePermission(input.principal, "public_content.read");
  const db = getDb();
  const conditions = [eq(publicContentItems.organizationId, input.principal.organizationId)];
  if (input.contentType) conditions.push(eq(publicContentItems.contentType, input.contentType));
  if (!input.includeArchived) conditions.push(isNull(publicContentItems.archivedAt));
  const rows = await db
    .select()
    .from(publicContentItems)
    .where(and(...conditions))
    .orderBy(asc(publicContentItems.priority), desc(publicContentItems.updatedAt));
  return Promise.all(
    rows.map(async (row) => {
      const linked = row.linkedJobId
        ? await loadPublicPosting(input.principal.organizationId, row.linkedJobId)
        : null;
      const jobStillPublic = linked ? jobIsPubliclyOpen(linked.posting, linked.job) : true;
      return {
        ...row,
        status: publicContentStatus(row),
        rendering: isScheduleLive(row) && jobStillPublic,
        linkedJobTitle: linked?.posting.publicTitle ?? null,
        linkedJobSlug: linked?.posting.slug ?? null,
        linkedJobPublic: jobStillPublic,
      };
    }),
  );
}

export async function getPublicContentItem(principal: Principal, id: string) {
  const rows = await listPublicContentItems({ principal, includeArchived: true });
  return rows.find((row) => row.id === id) ?? null;
}

export async function createPublicContentItem(input: {
  principal: Principal;
  data: PublicContentWriteInput;
}) {
  requirePermission(input.principal, "public_content.manage");
  const data = normalizePublicContentInput(input.data);
  if (data.isActive && !can(input.principal, "public_content.publish")) {
    throw new PublicContentError("Publishing public content requires public_content.publish.", 403);
  }
  await assertLinkedJob({
    organizationId: input.principal.organizationId,
    contentType: data.contentType,
    linkedJobId: data.linkedJobId,
  });
  const db = getDb();
  const [row] = await db
    .insert(publicContentItems)
    .values({
      organizationId: input.principal.organizationId,
      contentType: data.contentType,
      title: data.title,
      body: data.body,
      ctaLabel: data.ctaLabel,
      ctaUrl: data.ctaUrl,
      linkedJobId: data.linkedJobId,
      industryCode: data.industryCode,
      placement: data.placement,
      styleVariant: data.styleVariant,
      featureImageKey: data.featureImageKey,
      priority: data.priority ?? 100,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      isActive: data.isActive ?? false,
      createdByUserId: input.principal.id,
      updatedByUserId: input.principal.id,
    })
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "public_content.created",
    recordType: "public_content_item",
    recordId: row.id,
    after: { contentType: row.contentType, title: row.title, isActive: row.isActive, linkedJobId: row.linkedJobId },
  });
  await notifyPublicSiteRevalidate();
  return row;
}

export async function updatePublicContentItem(input: {
  principal: Principal;
  id: string;
  data: Partial<PublicContentWriteInput> & { archived?: boolean };
}) {
  requirePermission(input.principal, "public_content.manage");
  const existing = await getPublicContentItem(input.principal, input.id);
  if (!existing || existing.archivedAt) throw new PublicContentError("Public content was not found.", 404);
  const merged = normalizePublicContentInput({
    contentType: input.data.contentType ?? existing.contentType,
    title: input.data.title ?? existing.title,
    body: input.data.body === undefined ? existing.body : input.data.body,
    ctaLabel: input.data.ctaLabel === undefined ? existing.ctaLabel : input.data.ctaLabel,
    ctaUrl: input.data.ctaUrl === undefined ? existing.ctaUrl : input.data.ctaUrl,
    linkedJobId: input.data.linkedJobId === undefined ? existing.linkedJobId : input.data.linkedJobId,
    industryCode: input.data.industryCode === undefined ? existing.industryCode : input.data.industryCode,
    placement: input.data.placement ?? existing.placement,
    styleVariant: input.data.styleVariant === undefined ? existing.styleVariant : input.data.styleVariant,
    featureImageKey: input.data.featureImageKey === undefined ? existing.featureImageKey : input.data.featureImageKey,
    priority: input.data.priority ?? existing.priority,
    startsAt: input.data.startsAt === undefined ? existing.startsAt : input.data.startsAt,
    endsAt: input.data.endsAt === undefined ? existing.endsAt : input.data.endsAt,
    isActive: input.data.isActive === undefined ? existing.isActive : input.data.isActive,
  });
  if (merged.isActive !== existing.isActive && !can(input.principal, "public_content.publish")) {
    throw new PublicContentError("Publishing public content requires public_content.publish.", 403);
  }
  if (merged.linkedJobId !== existing.linkedJobId) {
    await recordAuditEvent({
      organizationId: input.principal.organizationId,
      actor: { type: "human", userId: input.principal.id },
      action: "public_content.linked_job_changed",
      recordType: "public_content_item",
      recordId: existing.id,
      before: { linkedJobId: existing.linkedJobId },
      after: { linkedJobId: merged.linkedJobId },
    });
  }
  await assertLinkedJob({
    organizationId: input.principal.organizationId,
    contentType: merged.contentType,
    linkedJobId: merged.linkedJobId,
  });
  const db = getDb();
  const [row] = await db
    .update(publicContentItems)
    .set({
      contentType: merged.contentType,
      title: merged.title,
      body: merged.body,
      ctaLabel: merged.ctaLabel,
      ctaUrl: merged.ctaUrl,
      linkedJobId: merged.linkedJobId,
      industryCode: merged.industryCode,
      placement: merged.placement,
      styleVariant: merged.styleVariant,
      featureImageKey: merged.featureImageKey,
      priority: merged.priority ?? 100,
      startsAt: merged.startsAt,
      endsAt: merged.endsAt,
      isActive: merged.isActive ?? false,
      updatedByUserId: input.principal.id,
      updatedAt: new Date(),
    })
    .where(and(eq(publicContentItems.id, input.id), eq(publicContentItems.organizationId, input.principal.organizationId)))
    .returning();
  const activating = !existing.isActive && row.isActive;
  const deactivating = existing.isActive && !row.isActive;
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: activating
      ? "public_content.activated"
      : deactivating
        ? "public_content.deactivated"
        : merged.startsAt?.getTime() !== existing.startsAt?.getTime() || merged.endsAt?.getTime() !== existing.endsAt?.getTime()
          ? "public_content.scheduled"
          : "public_content.updated",
    recordType: "public_content_item",
    recordId: row.id,
    before: { title: existing.title, isActive: existing.isActive },
    after: { title: row.title, isActive: row.isActive },
  });
  await notifyPublicSiteRevalidate();
  return row;
}

export async function setPublicContentActive(input: { principal: Principal; id: string; isActive: boolean }) {
  requirePermission(input.principal, "public_content.publish");
  const existing = await getPublicContentItem(input.principal, input.id);
  if (!existing || existing.archivedAt) throw new PublicContentError("Public content was not found.", 404);
  if (input.isActive) {
    await assertLinkedJob({
      organizationId: input.principal.organizationId,
      contentType: existing.contentType,
      linkedJobId: existing.linkedJobId,
    });
  }
  const db = getDb();
  const [row] = await db
    .update(publicContentItems)
    .set({
      isActive: input.isActive,
      updatedByUserId: input.principal.id,
      updatedAt: new Date(),
    })
    .where(and(eq(publicContentItems.id, input.id), eq(publicContentItems.organizationId, input.principal.organizationId)))
    .returning();
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: input.isActive ? "public_content.activated" : "public_content.deactivated",
    recordType: "public_content_item",
    recordId: row.id,
    before: { isActive: existing.isActive },
    after: { isActive: row.isActive },
  });
  await notifyPublicSiteRevalidate();
  return row;
}

export async function archivePublicContentItem(input: { principal: Principal; id: string }) {
  requirePermission(input.principal, "public_content.manage");
  const existing = await getPublicContentItem(input.principal, input.id);
  if (!existing) throw new PublicContentError("Public content was not found.", 404);
  const db = getDb();
  await db
    .update(publicContentItems)
    .set({
      archivedAt: new Date(),
      isActive: false,
      updatedByUserId: input.principal.id,
      updatedAt: new Date(),
    })
    .where(and(eq(publicContentItems.id, input.id), eq(publicContentItems.organizationId, input.principal.organizationId)));
  await recordAuditEvent({
    organizationId: input.principal.organizationId,
    actor: { type: "human", userId: input.principal.id },
    action: "public_content.archived",
    recordType: "public_content_item",
    recordId: input.id,
  });
  await notifyPublicSiteRevalidate();
}

function toPublicFeaturedJob(posting: typeof jobPostings.$inferSelect, job: typeof jobs.$inferSelect, featureCopy: string | null) {
  const dto = toPublicJob(posting, job);
  return {
    slug: dto.slug,
    title: dto.title,
    location: dto.location ?? null,
    companyDisplay: dto.companyDisplay ?? null,
    skillbridgeEligible: Boolean(dto.skillbridgeEligible),
    featureCopy,
  };
}

export async function getPublicContentPayload(now = new Date()) {
  const organizationId = await resolvePublicOrganizationId();
  const db = getDb();
  const rows = await db
    .select()
    .from(publicContentItems)
    .where(
      and(
        eq(publicContentItems.organizationId, organizationId),
        eq(publicContentItems.isActive, true),
        isNull(publicContentItems.archivedAt),
      ),
    )
    .orderBy(asc(publicContentItems.priority), desc(publicContentItems.updatedAt));

  const featuredJobs: ReturnType<typeof toPublicFeaturedJob>[] = [];
  const featuredSkillBridge: ReturnType<typeof toPublicFeaturedJob>[] = [];
  const banners: Array<{
    title: string;
    body: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    styleVariant: "navy" | "teal" | "light";
  }> = [];
  const announcements: Array<{
    headline: string;
    body: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    placement: string;
  }> = [];
  const campaigns: Array<{
    industry: string;
    headline: string;
    summary: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    imageKey: string | null;
  }> = [];
  const urgentNotices: Array<{
    headline: string;
    body: string | null;
    ctaLabel: string | null;
    ctaUrl: string | null;
    jobSlug: string | null;
  }> = [];

  for (const row of rows) {
    if (!isScheduleLive(row, now)) continue;
    const linked = row.linkedJobId ? await loadPublicPosting(row.organizationId, row.linkedJobId) : null;
    const jobOk = linked ? jobIsPubliclyOpen(linked.posting, linked.job, now) : true;
    if ((row.contentType === "featured_job" || row.contentType === "featured_skillbridge") && (!linked || !jobOk)) {
      continue;
    }
    if (row.contentType === "featured_job" && linked) {
      featuredJobs.push(toPublicFeaturedJob(linked.posting, linked.job, row.body));
    } else if (row.contentType === "featured_skillbridge" && linked) {
      featuredSkillBridge.push(toPublicFeaturedJob(linked.posting, linked.job, row.body));
    } else if (row.contentType === "homepage_banner") {
      banners.push({
        title: row.title,
        body: row.body,
        ctaLabel: row.ctaLabel,
        ctaUrl: row.ctaUrl,
        styleVariant: row.styleVariant ?? "navy",
      });
    } else if (row.contentType === "urgent_hiring_notice") {
      urgentNotices.push({
        headline: row.title,
        body: row.body,
        ctaLabel: row.ctaLabel,
        ctaUrl: row.ctaUrl,
        jobSlug: linked && jobOk ? linked.posting.slug : null,
      });
    } else if (row.contentType === "temporary_announcement") {
      announcements.push({
        headline: row.title,
        body: row.body,
        ctaLabel: row.ctaLabel,
        ctaUrl: row.ctaUrl,
        placement: row.placement,
      });
    } else if (row.contentType === "featured_industry_campaign") {
      campaigns.push({
        industry: row.industryCode ?? "",
        headline: row.title,
        summary: row.body,
        ctaLabel: row.ctaLabel,
        ctaUrl: row.ctaUrl,
        imageKey: row.featureImageKey,
      });
    }
  }

  return {
    featuredJobs,
    featuredSkillBridge,
    banners,
    announcements,
    campaigns,
    urgentNotices,
  };
}
