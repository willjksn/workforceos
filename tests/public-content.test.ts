import { describe, expect, it } from "vitest";

import { scoutCommand } from "../lib/scout/commands";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { parseScoutPageContext } from "../lib/scout/page-context";
import { ROLE_PERMISSIONS, can, requirePermission, AuthorizationError, type Principal } from "../lib/rbac/permissions";
import { navGroupsForPrincipal } from "../components/navigation/nav-config";
import {
  EMPTY_PUBLIC_CONTENT,
  PUBLIC_CONTENT_CACHE_CONTROL,
  PUBLIC_CONTENT_REVALIDATE_SECONDS,
  filterPublicContentByPlacement,
} from "../lib/public-content/types";
import {
  PublicContentError,
  assertSafeCtaUrl,
  isScheduleLive,
  normalizePublicContentInput,
  publicContentStatus,
  sanitizePlainText,
} from "../lib/public-content/validation";
import { publicContentResponseSchema } from "../packages/public-api-contracts/src";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

const jobPage = {
  pathname: "/app/jobs/00000000-0000-4000-8d00-000000000004",
  module: "jobs",
  entityType: "job" as const,
  entityId: "00000000-0000-4000-8d00-000000000004",
};

describe("public content publishing", () => {
  it("creates a homepage banner with an approved style and no HTML", () => {
    const data = normalizePublicContentInput({
      contentType: "homepage_banner",
      title: "We're currently recruiting electrical talent across North Carolina.",
      body: "Open roles are published from WorkforceOS.",
      ctaLabel: "View careers",
      ctaUrl: "/careers",
      placement: "home",
      styleVariant: "navy",
      isActive: true,
    });
    expect(data.contentType).toBe("homepage_banner");
    expect(data.styleVariant).toBe("navy");
    expect(data.isActive).toBe(true);
  });

  it("treats a future banner as scheduled, not live", () => {
    const startsAt = new Date("2099-01-01T00:00:00.000Z");
    const row = { isActive: true, startsAt, endsAt: null };
    expect(isScheduleLive(row, new Date("2026-09-06T00:00:00.000Z"))).toBe(false);
    expect(publicContentStatus(row, new Date("2026-09-06T00:00:00.000Z"))).toBe("scheduled");
  });

  it("does not return expired or inactive content as live", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    expect(isScheduleLive({ isActive: true, startsAt: null, endsAt: new Date("2026-09-06T11:00:00.000Z") }, now)).toBe(false);
    expect(isScheduleLive({ isActive: false, startsAt: null, endsAt: null }, now)).toBe(false);
    expect(publicContentStatus({ isActive: true, startsAt: null, endsAt: new Date("2026-09-06T11:00:00.000Z") }, now)).toBe(
      "expired",
    );
    expect(publicContentStatus({ isActive: false, startsAt: null, endsAt: null }, now)).toBe("draft");
  });

  it("rejects HTML, scripts, unsafe URLs, and inverted dates", () => {
    expect(() => sanitizePlainText("<script>alert(1)</script>", 80, "Title")).toThrow(PublicContentError);
    expect(() => assertSafeCtaUrl("javascript:alert(1)")).toThrow(PublicContentError);
    expect(() => assertSafeCtaUrl("https://pieronepartners.com/careers")).not.toThrow();
    expect(() =>
      normalizePublicContentInput({
        contentType: "temporary_announcement",
        title: "Fair",
        placement: "home",
        startsAt: new Date("2026-09-07T00:00:00.000Z"),
        endsAt: new Date("2026-09-06T00:00:00.000Z"),
      }),
    ).toThrow(/End date/);
  });

  it("strips private fields from the public DTO", () => {
    const parsed = publicContentResponseSchema.parse({
      featuredJobs: [{ slug: "plant-electrician-charlotte", title: "Plant Electrician", featureCopy: "Now hiring" }],
      featuredSkillBridge: [],
      banners: [{ title: "Hiring", body: null, ctaLabel: "Careers", ctaUrl: "/careers", styleVariant: "navy" }],
      announcements: [],
      campaigns: [],
      urgentNotices: [],
    });
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain("createdBy");
    expect(serialized).not.toContain("organizationId");
    expect(serialized).not.toContain("linkedJobId");
    expect(parsed.featuredJobs[0]).not.toHaveProperty("id");
  });

  it("does not grant recruiters website publishing access", () => {
    const recruiter = principalFor("recruiter");
    expect(can(recruiter, "public_content.read")).toBe(false);
    expect(can(recruiter, "public_content.manage")).toBe(false);
    expect(can(recruiter, "public_content.publish")).toBe(false);
    expect(() => requirePermission(recruiter, "public_content.publish")).toThrow(AuthorizationError);
    const links = navGroupsForPrincipal(recruiter).flatMap((group) => group.items.map((item) => item.href));
    expect(links).not.toContain("/app/public-content");
  });

  it("lets operations and strategy/technology publish, and talent partners read", () => {
    expect(can(principalFor("operations-administrator"), "public_content.publish")).toBe(true);
    expect(can(principalFor("strategy-technology-administrator"), "public_content.publish")).toBe(true);
    expect(can(principalFor("managing-partner"), "public_content.publish")).toBe(true);
    expect(can(principalFor("talent-partner"), "public_content.read")).toBe(true);
    expect(can(principalFor("talent-partner"), "public_content.publish")).toBe(false);
    expect(can(principalFor("read-only"), "public_content.read")).toBe(true);
    expect(can(principalFor("read-only"), "public_content.publish")).toBe(false);
  });

  it("requires Scout confirmation for material publishing actions", () => {
    const feature = parseScoutIntent("Feature this job on the homepage.", jobPage);
    expect(feature.ok).toBe(true);
    if (feature.ok) {
      expect(feature.dto.family).toBe("CREATE");
      expect(feature.dto.entity).toBe("public_content_feature_job");
      expect(scoutCommand(feature.dto.family)?.confirm).toBe(true);
    }
    const skillbridge = parseScoutIntent("Feature this SkillBridge role.", jobPage);
    expect(skillbridge.ok && skillbridge.dto.entity).toBe("public_content_feature_skillbridge");
    const banner = parseScoutIntent("Create a hiring banner for this role.", jobPage);
    expect(banner.ok && banner.dto.family).toBe("CREATE");
    expect(scoutCommand("CREATE")?.confirm).toBe(true);
    const remove = parseScoutIntent("Remove the current urgent hiring notice.");
    expect(remove.ok && remove.dto.family).toBe("UPDATE");
    expect(scoutCommand("UPDATE")?.confirm).toBe(true);
    const featured = parseScoutIntent("Show me what's currently featured on the public website.");
    expect(featured.ok && featured.dto.family).toBe("SEARCH");
    const scheduled = parseScoutIntent("Show scheduled public announcements.");
    expect(scheduled.ok && scheduled.dto.filters?.availability).toEqual(["scheduled"]);
  });

  it("parses Public Content page context", () => {
    const context = parseScoutPageContext("/app/public-content/00000000-0000-4000-8000-000000000999");
    expect(context.entityType).toBe("public_content_item");
    expect(context.module).toBe("public_content");
  });

  it("uses a short cache TTL so content changes do not require a website redeploy", () => {
    expect(PUBLIC_CONTENT_REVALIDATE_SECONDS).toBe(60);
    expect(PUBLIC_CONTENT_CACHE_CONTROL).toContain("s-maxage=60");
    expect(PUBLIC_CONTENT_CACHE_CONTROL).toContain("stale-while-revalidate=120");
  });

  it("omits empty groups and never requires content to render", () => {
    expect(EMPTY_PUBLIC_CONTENT.featuredJobs).toEqual([]);
    expect(publicContentResponseSchema.parse(EMPTY_PUBLIC_CONTENT).banners).toEqual([]);
    const filtered = filterPublicContentByPlacement(
      {
        ...EMPTY_PUBLIC_CONTENT,
        banners: [{ title: "Hiring", body: null, ctaLabel: null, ctaUrl: null, styleVariant: "navy" as const }],
        urgentNotices: [{ headline: "Now hiring", body: null, ctaLabel: null, ctaUrl: null, jobSlug: null }],
        announcements: [{ headline: "Fair", body: null, ctaLabel: null, ctaUrl: null, placement: "careers" }],
      },
      "home",
    );
    expect(filtered.banners).toHaveLength(1);
    expect(filtered.urgentNotices).toHaveLength(0);
    expect(filtered.announcements).toHaveLength(0);
  });
});
