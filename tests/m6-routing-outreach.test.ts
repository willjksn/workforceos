import { describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS } from "../lib/rbac/permissions";
import { opportunityContextLabel } from "../lib/recruiting/opportunity-match";
import {
  addBusinessDays,
  agingDays,
  canAuthorizeEmployerRoute,
  clearanceSharingWording,
  draftPublicOutreach,
  draftTalentReview,
  employerFacingCapability,
  engagementStartBlock,
  externalDeliveryPlan,
  followUpAlertIntents,
  matchCategoryAfterOutcome,
  nextStateForEmployerResponse,
  queueBuckets,
  sharingBlock,
} from "../lib/recruiting/engagement-policy";

const openPerson = {
  explicitStart: true,
  freshness: "current",
  matchCategory: "strong_match",
  disposition: "viable",
  jobStatus: "open",
  candidatePrivacyDeleted: false,
  candidateArchived: false,
  candidateDoNotContact: false,
  candidateAvailability: "available_now",
};

describe("M6 routing and outreach policy", () => {
  it("does nothing until a person starts the engagement", () => {
    expect(engagementStartBlock({ ...openPerson, explicitStart: false })).toMatch(/by itself/);
  });

  it("starts from a current viable match", () => {
    expect(engagementStartBlock(openPerson)).toBeNull();
  });

  it("rejects an authorized route on a public job without an explicit route flag", () => {
    expect(canAuthorizeEmployerRoute({
      jobContextType: "monitored_public",
      authorizedEmployerRoute: false,
      companyId: "company",
      hiringManagerContactId: "manager",
      companyClientStatus: "client",
    })).toBe(false);
    expect(canAuthorizeEmployerRoute({
      jobContextType: "exploratory",
      authorizedEmployerRoute: false,
      companyId: "company",
    })).toBe(false);
  });

  it("allows employer outreach policy and an explicit authorized flag", () => {
    expect(canAuthorizeEmployerRoute({
      jobContextType: "monitored_public",
      authorizedEmployerRoute: true,
    })).toBe(true);
    expect(canAuthorizeEmployerRoute({
      jobContextType: "client",
      authorizedEmployerRoute: false,
    })).toBe(true);
  });

  it("keeps the calculated category when the employer says not a fit", () => {
    expect(matchCategoryAfterOutcome("strong_match")).toBe("strong_match");
    expect(nextStateForEmployerResponse("not_a_fit", "contacted").status).toBe("no_fit");
    expect(nextStateForEmployerResponse("interested", "routed").status).toBe("interested");
    expect(nextStateForEmployerResponse("possible_future_fit", "routed").status).toBe("needs_follow_up");
    expect(nextStateForEmployerResponse("refer_to_another_manager", "routed").status).toBe("referred");
    expect(nextStateForEmployerResponse("needs_more_information", "routed").status).toBe("needs_information");
  });

  it("creates a follow-up for no response and an overdue queue row", () => {
    const followUp = addBusinessDays(new Date("2026-10-22T15:00:00Z"), 3);
    expect(followUp.toISOString().slice(0, 10)).toBe("2026-10-27");
    const due = queueBuckets({
      status: "contacted",
      waitingOn: "employer",
      interviewStatus: null,
      employerResponse: null,
      nextFollowUpAt: new Date("2026-10-22T12:00:00Z"),
    }, new Date("2026-10-22T18:00:00Z"));
    expect(due).toContain("follow_up_due");
    expect(due).toContain("no_response");
    const overdue = queueBuckets({
      status: "routed",
      waitingOn: "employer",
      interviewStatus: null,
      employerResponse: null,
      nextFollowUpAt: new Date("2026-10-20T12:00:00Z"),
    }, new Date("2026-10-22T18:00:00Z"));
    expect(overdue).toContain("overdue");
  });

  it("does not send email from the follow-up scan", () => {
    const intents = followUpAlertIntents([{
      id: "engagement",
      ownerUserId: "owner",
      status: "contacted",
      candidateName: "Casey Nguyen",
      nextFollowUpAt: new Date("2026-10-20T12:00:00Z"),
      employerResponse: null,
    }], new Date("2026-10-22T18:00:00Z"));
    expect(intents).toHaveLength(1);
    expect(intents[0]?.emailsSent).toBe(0);
  });

  it("blocks sharing without granted consent and refuses an unconfirmed send", () => {
    expect(sharingBlock("unknown")).toMatch(/not granted/);
    expect(sharingBlock("granted")).toBeNull();
    expect(externalDeliveryPlan({ confirmed: false, providerConfigured: true, consentGranted: true }).action).toBe("refuse");
    expect(externalDeliveryPlan({ confirmed: true, providerConfigured: true, consentGranted: false }).action).toBe("refuse");
    expect(externalDeliveryPlan({ confirmed: true, providerConfigured: false, consentGranted: true }).action).toBe("manual_only");
    expect(externalDeliveryPlan({ confirmed: true, providerConfigured: true, consentGranted: true }).action).toBe("send");
  });

  it("keeps a public job labeled as a public opportunity", () => {
    expect(opportunityContextLabel("monitored_public")).toBe("Public opportunity");
    const draft = draftPublicOutreach({
      jobTitle: "Instrumentation Technician",
      companyName: "Harbor",
      relevantExperience: "Calibration",
      militaryContext: "navy ET",
      recruiterNote: null,
    });
    expect(draft.body).toMatch(/publicly posted Instrumentation Technician/);
    expect(draft.body).toMatch(/not an existing partnership, a client relationship, or an authorized submission/);
  });

  it("uses approved facts only and does not call a clearance verified", () => {
    expect(employerFacingCapability({
      name: "Pending translation",
      basis: "inferred",
      reviewStatus: "pending",
      source: "capability_translation",
    })).toBeNull();
    expect(employerFacingCapability({
      name: "Calibration",
      basis: "explicit",
      reviewStatus: "pending",
      source: "recruiter",
    })).toBe("Calibration");
    expect(clearanceSharingWording({ level: "secret", status: "reported_active", humanVerified: false })).toMatch(/not a verified clearance/);
    const review = draftTalentReview({
      candidateName: "Casey Nguyen",
      location: "Norfolk, VA",
      availability: "available_now",
      transitionTiming: "2026-12-01",
      capabilities: ["Calibration"],
      credentials: ["NICET"],
      clearanceWording: clearanceSharingWording({ level: "secret", status: "reported_active", humanVerified: false }),
      aligned: ["Calibration"],
      gaps: ["PLC"],
      jobTitle: "Plant Electrician",
      companyName: "Harbor",
      recruiterNote: "Reviewed by recruiter.",
      militaryContext: "navy electronics",
      resumeOnFile: false,
    });
    expect(review.body).toContain("Casey Nguyen");
    expect(review.body).toContain("Calibration");
    expect(review.body).toMatch(/not a verified clearance/);
  });

  it("blocks a closed job and keeps a non-military candidate on the same rule", () => {
    expect(engagementStartBlock({ ...openPerson, jobStatus: "closed" })).toMatch(/reopened/);
    expect(engagementStartBlock({ ...openPerson, matchCategory: "possible_match", disposition: null })).toBeNull();
  });

  it("leaves no-fit visible for a human next step", () => {
    expect(queueBuckets({
      status: "no_fit",
      waitingOn: "recruiter",
      interviewStatus: null,
      employerResponse: "not_a_fit",
      nextFollowUpAt: null,
    }, new Date("2026-10-22T18:00:00Z"))).toContain("no_fit_needs_decision");
  });

  it("keeps recruiters out of commercial opportunities", () => {
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("opportunities.read");
    expect(ROLE_PERMISSIONS.recruiter).toContain("candidates.write");
    expect(ROLE_PERMISSIONS.recruiter).not.toContain("scout.external_actions");
  });

  it("counts aging from the last activity", () => {
    expect(agingDays(new Date("2026-10-17T12:00:00Z"), new Date("2026-10-22T12:00:00Z"))).toBe(5);
  });
});
