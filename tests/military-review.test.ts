import { describe, expect, it } from "vitest";

import { assertHumanMappingReview, initialReviewStatus } from "../lib/military/review";
import { hiringManagerTranslation } from "../lib/military/translator";

describe("military mapping review and provenance", () => {
  it("starts agent mappings pending", () => {
    expect(initialReviewStatus({ origin: "agent" })).toBe("pending");
    expect(initialReviewStatus({ origin: "reference_data", trustedReference: true })).toBe("approved");
  });

  it("prevents an agent from approving its own mapping", () => {
    expect(() =>
      assertHumanMappingReview({
        actorType: "agent",
        originatingAgentId: "agent-1",
        reviewerUserId: "user-1",
        nextStatus: "approved",
      }),
    ).toThrow(/cannot approve/);
  });

  it("excludes unreviewed drafts from hiring-manager copy", () => {
    const view = hiringManagerTranslation({
      branch: "navy",
      occupationCode: "EM",
      occupationTitle: "Electrician's Mate",
      yearsInOccupation: 8,
      transferableSkillNames: ["Electrical Troubleshooting", "Preventive Maintenance"],
      civilianRoles: [
        {
          title: "Electrical Technician",
          explanation: "Stored fixture mapping",
          reviewStatus: "approved",
          source: "development_fixture",
        },
        {
          title: "Guessed role",
          explanation: "AI guess",
          reviewStatus: "pending",
        },
      ],
    });
    expect(view.roles.map((role) => role.title)).toEqual(["Electrical Technician"]);
    expect(view.civilianTranslation.overallAlignment).not.toBe("Insufficient approved mapping");
  });
});
