import { describe, expect, it } from "vitest";

import { PRIMARY_NAV, SERVICES, SOLUTIONS_NAV } from "../lib/content";
import { inquiryPayloadSchema, publicContentResponseSchema, EMPTY_PUBLIC_CONTENT } from "../lib/contracts";
import { IMAGES } from "../lib/images";

describe("PierOne public website", () => {
  it("defines five commercial services", () => {
    expect(SERVICES).toHaveLength(5);
    expect(SERVICES.map((row) => row.code)).toEqual([
      "professional-search",
      "military-talent-opportunity-assessment",
      "ta-performance-assessment",
      "fractional-talent-partner",
      "workforce-pipeline-assessment",
    ]);
  });

  it("rejects invalid employer inquiries", () => {
    const parsed = inquiryPayloadSchema.safeParse({
      firstName: "",
      lastName: "Test",
      email: "not-an-email",
      company: "Acme",
      serviceInterest: "professional-search",
      challenge: "Need help",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid employer inquiry payload", () => {
    const parsed = inquiryPayloadSchema.safeParse({
      firstName: "Alex",
      lastName: "Rivera",
      email: "alex@example.com",
      company: "Example Energy",
      serviceInterest: "workforce-pipeline-assessment",
      challenge: "Need a pipeline view for technicians.",
    });
    expect(parsed.success).toBe(true);
  });

  it("keeps primary navigation uncluttered", () => {
    const labels = PRIMARY_NAV.map((item) => item.label);
    expect(labels).toEqual(["Home", "Solutions", "Military Talent", "Careers", "About", "Contact"]);
    expect(labels).not.toContain("Insights");
    expect(labels).not.toContain("What We Do");
    expect(labels).not.toContain("Workforce Development");
    expect(SOLUTIONS_NAV.map((item) => item.label)).toContain("Workforce Development");
    expect(SOLUTIONS_NAV).toHaveLength(6);
  });

  it("accepts an empty public content payload so pages can omit sections", () => {
    const parsed = publicContentResponseSchema.safeParse(EMPTY_PUBLIC_CONTENT);
    expect(parsed.success).toBe(true);
  });

  it("marks every public image slot for licensed replacement", () => {
    const slots = Object.values(IMAGES);
    expect(slots.length).toBeGreaterThanOrEqual(12);
    for (const slot of slots) {
      expect(slot.replacementNeeded).toBe(true);
      expect(slot.src.startsWith("/images/placeholders/")).toBe(true);
      expect(slot.alt.length).toBeGreaterThan(12);
    }
  });
});
