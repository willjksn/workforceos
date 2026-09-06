import "./load-env";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { auditEvents, jobPostings, jobs, publicContentItems } from "../db/schema";
import { INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { closeJob } from "../lib/hiring/service";
import {
  archivePublicContentItem,
  createPublicContentItem,
  getPublicContentPayload,
  listPublicContentItems,
} from "../lib/public-content/service";
import { PublicContentError } from "../lib/public-content/validation";
import { PUBLIC_CONTENT_CACHE_CONTROL } from "../lib/public-content/types";
import { ROLE_PERMISSIONS, AuthorizationError, type Principal } from "../lib/rbac/permissions";
import { scoutCommand } from "../lib/scout/commands";
import { parseScoutIntent } from "../lib/scout/parse-intent";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ELECTRICIAN_JOB_ID = "00000000-0000-4000-8d00-000000000004";
const SKILLBRIDGE_JOB_ID = "00000000-0000-4000-8d00-000000000007";

const partner: Principal = {
  id: USER_IDS.managingPartner,
  status: "active",
  organizationId: INTERNAL_ORG_ID,
  roleSlugs: ["managing-partner"],
  permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
};

const recruiter: Principal = {
  id: USER_IDS.recruiter,
  status: "active",
  organizationId: INTERNAL_ORG_ID,
  roleSlugs: ["recruiter"],
  permissions: new Set(ROLE_PERMISSIONS.recruiter),
};

async function main() {
  await seedFoundation();
  const db = getDb();

  console.log("TEST 1 — Create homepage banner");
  const banner = await createPublicContentItem({
    principal: partner,
    data: {
      contentType: "homepage_banner",
      title: "We're currently recruiting electrical and maintenance talent across North Carolina.",
      body: "Open roles are published from WorkforceOS.",
      ctaLabel: "View open roles",
      ctaUrl: "/careers",
      placement: "home",
      styleVariant: "navy",
      isActive: true,
    },
  });
  const liveBanner = await getPublicContentPayload();
  assert(
    liveBanner.banners.some((row) => row.title.includes("electrical and maintenance")),
    "Active banner is returned",
  );
  assert(!("id" in (liveBanner.banners[0] ?? {})), "Banner DTO has no internal id");
  assert(!JSON.stringify(liveBanner).includes(USER_IDS.managingPartner), "Creator IDs are stripped");

  console.log("TEST 2 — Schedule future banner");
  await createPublicContentItem({
    principal: partner,
    data: {
      contentType: "homepage_banner",
      title: "Future hiring banner",
      placement: "home",
      styleVariant: "teal",
      startsAt: new Date(Date.now() + 10 * 60 * 1000),
      isActive: true,
    },
  });
  const scheduled = await getPublicContentPayload();
  assert(
    !scheduled.banners.some((row) => row.title === "Future hiring banner"),
    "Future banner is hidden until start",
  );

  console.log("TEST 3 — Expired banner is not returned");
  await createPublicContentItem({
    principal: partner,
    data: {
      contentType: "homepage_banner",
      title: "Expired hiring banner",
      placement: "home",
      styleVariant: "light",
      startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 60 * 1000),
      isActive: true,
    },
  });
  const expired = await getPublicContentPayload();
  assert(
    !expired.banners.some((row) => row.title === "Expired hiring banner"),
    "Expired banner is omitted",
  );

  console.log("TEST 4 — Inactive content is not returned");
  await createPublicContentItem({
    principal: partner,
    data: {
      contentType: "temporary_announcement",
      title: "Draft announcement",
      placement: "home",
      isActive: false,
    },
  });
  const inactive = await getPublicContentPayload();
  assert(
    !inactive.announcements.some((row) => row.headline === "Draft announcement"),
    "Inactive announcement is omitted",
  );

  console.log("TEST 5 — Feature public/open job");
  await createPublicContentItem({
    principal: partner,
    data: {
      contentType: "featured_job",
      title: "Featured electrician",
      body: "Plant electrician opening in Charlotte.",
      linkedJobId: ELECTRICIAN_JOB_ID,
      placement: "careers",
      isActive: true,
    },
  });
  const featured = await getPublicContentPayload();
  assert(
    featured.featuredJobs.some((row) => row.slug === "plant-electrician-charlotte"),
    "Public job is featured",
  );

  console.log("TEST 6 — Closed job cannot remain publicly featured");
  await closeJob({ principal: partner, jobId: ELECTRICIAN_JOB_ID });
  const afterClose = await getPublicContentPayload();
  assert(
    !afterClose.featuredJobs.some((row) => row.slug === "plant-electrician-charlotte"),
    "Closed job drops from featured payload",
  );
  let closedCreateFailed = false;
  try {
    await createPublicContentItem({
      principal: partner,
      data: {
        contentType: "featured_job",
        title: "Should fail",
        linkedJobId: ELECTRICIAN_JOB_ID,
        placement: "careers",
        isActive: true,
      },
    });
  } catch (error) {
    closedCreateFailed = error instanceof PublicContentError;
  }
  assert(closedCreateFailed, "Closed jobs cannot be newly featured");

  console.log("TEST 7 — Feature SkillBridge role");
  await createPublicContentItem({
    principal: partner,
    data: {
      contentType: "featured_skillbridge",
      title: "Featured SkillBridge technician",
      linkedJobId: SKILLBRIDGE_JOB_ID,
      placement: "skillbridge",
      isActive: true,
    },
  });
  const skillbridge = await getPublicContentPayload();
  assert(
    skillbridge.featuredSkillBridge.some((row) => row.slug === "skillbridge-electrical-technician"),
    "SkillBridge job is featured",
  );

  console.log("TEST 8 — Featured SkillBridge role disappears when no longer public");
  await db
    .update(jobPostings)
    .set({ applicationOpen: false, publicStatus: "closed", visibility: "closed", updatedAt: new Date() })
    .where(eq(jobPostings.jobId, SKILLBRIDGE_JOB_ID));
  const afterSbClose = await getPublicContentPayload();
  assert(
    !afterSbClose.featuredSkillBridge.some((row) => row.slug === "skillbridge-electrical-technician"),
    "Non-public SkillBridge role is omitted",
  );

  console.log("TEST 9 — Public content endpoint strips private fields");
  const payloadJson = JSON.stringify(await getPublicContentPayload());
  assert(!payloadJson.includes("createdByUserId"), "No creator id");
  assert(!payloadJson.includes("updatedByUserId"), "No updater id");
  assert(!payloadJson.includes(INTERNAL_ORG_ID), "No organization id");

  console.log("TEST 10 — User without permission cannot publish");
  let denied = false;
  try {
    await createPublicContentItem({
      principal: recruiter,
      data: {
        contentType: "urgent_hiring_notice",
        title: "Unauthorized notice",
        placement: "careers",
        isActive: true,
      },
    });
  } catch (error) {
    denied = error instanceof AuthorizationError;
  }
  assert(denied, "Recruiter cannot create public content");

  console.log("TEST 11 — Scout publishing requires confirmation");
  const parsed = parseScoutIntent("Feature this job on the homepage.", {
    pathname: "/app/jobs/" + ELECTRICIAN_JOB_ID,
    module: "jobs",
    entityType: "job",
    entityId: ELECTRICIAN_JOB_ID,
  });
  assert(parsed.ok, "Scout parses feature-job intent");
  assert(parsed.ok && parsed.dto.family === "CREATE", "Feature uses CREATE");
  assert(scoutCommand("CREATE")?.confirm === true, "CREATE requires confirmation");
  assert(scoutCommand("UPDATE")?.confirm === true, "UPDATE requires confirmation");

  console.log("TEST 12–15 — Empty groups are safe and pages can omit sections");
  const emptyish = await getPublicContentPayload(new Date("2000-01-01T00:00:00.000Z"));
  assert(Array.isArray(emptyish.featuredJobs), "featuredJobs array");
  assert(Array.isArray(emptyish.banners), "banners array");
  assert(Array.isArray(emptyish.announcements), "announcements array");

  console.log("TEST 16–17 — Cache/revalidation does not require a website redeploy");
  assert(PUBLIC_CONTENT_CACHE_CONTROL.includes("s-maxage=60"), "60s CDN cache");
  assert(PUBLIC_CONTENT_CACHE_CONTROL.includes("stale-while-revalidate=120"), "stale-while-revalidate");

  console.log("TEST 18 — Audit events recorded");
  const [createdAudit] = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.recordId, banner.id))
    .limit(5);
  assert(createdAudit?.action === "public_content.created", "Create is audited");
  assert(createdAudit.actorUserId === USER_IDS.managingPartner, "Actor is stored");

  const listed = await listPublicContentItems({ principal: partner });
  for (const row of listed) {
    await archivePublicContentItem({ principal: partner, id: row.id });
  }
  const archived = await db.select().from(publicContentItems).where(eq(publicContentItems.id, banner.id)).limit(1);
  assert(archived[0]?.archivedAt != null, "Archive timestamp set");
  assert(archived[0]?.isActive === false, "Archive deactivates");

  await db
    .update(jobs)
    .set({ status: "open", postingVisibility: "public", updatedAt: new Date() })
    .where(eq(jobs.id, ELECTRICIAN_JOB_ID));
  await db
    .update(jobPostings)
    .set({ applicationOpen: true, publicStatus: "published", visibility: "public", updatedAt: new Date() })
    .where(eq(jobPostings.jobId, ELECTRICIAN_JOB_ID));
  await db
    .update(jobPostings)
    .set({ applicationOpen: true, publicStatus: "published", visibility: "public", updatedAt: new Date() })
    .where(eq(jobPostings.jobId, SKILLBRIDGE_JOB_ID));

  console.log("Public content tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
