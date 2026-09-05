import { describe, expect, it } from "vitest";

import { presentCandidate } from "../lib/privacy/present-candidate";

describe("candidate PII presentation", () => {
  const candidate = {
    id: "00000000-0000-4000-8000-000000000401",
    organizationId: "org",
    fullName: "Taylor Ellis",
    email: "taylor.ellis@talent.example.test",
    currentTitle: "Navy Electrician's Mate",
    availability: "available_now" as const,
    consentStatus: "granted" as const,
    privacyClass: "restricted_pii" as const,
    createdAt: new Date("2026-09-04T00:00:00.000Z"),
    updatedAt: new Date("2026-09-04T00:00:00.000Z"),
    archivedAt: null,
  };

  it("hides email without candidate_pii.read", () => {
    const presented = presentCandidate(candidate, false);
    expect(presented.email).toBeNull();
    expect(presented.emailHidden).toBe(true);
    expect(presented.fullName).toBe("Taylor Ellis");
  });

  it("shows email when candidate_pii.read is granted", () => {
    const presented = presentCandidate(candidate, true);
    expect(presented.email).toBe("taylor.ellis@talent.example.test");
    expect(presented.emailHidden).toBe(false);
  });
});
