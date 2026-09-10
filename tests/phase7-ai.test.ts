import { describe, expect, it } from "vitest";

import { canQueueExternalAction, canWriteDraftRecords, parseAutonomyLevel } from "../lib/ai/autonomy";
import { AgentError } from "../lib/ai/errors";
import { assertPromptImmutable } from "../lib/ai/prompts";
import { agentAllowsTask, isForbiddenTask } from "../lib/ai/registry";
import { assertAgentCannotSelfApprove, assertCanDecideReview, reviewDecidePermission } from "../lib/ai/review";
import { AuthorizationError, ROLE_PERMISSIONS, can } from "../lib/rbac/permissions";

describe("phase 7 AI operations gates", () => {
  it("keeps autonomy level 4 from unsupervised external action helpers", () => {
    expect(parseAutonomyLevel(4)).toBe(4);
    expect(canQueueExternalAction(4)).toBe(true);
    expect(canQueueExternalAction(3)).toBe(false);
    expect(canWriteDraftRecords(2)).toBe(true);
    expect(canWriteDraftRecords(1)).toBe(false);
  });

  it("blocks forbidden agent tasks", () => {
    expect(isForbiddenTask("proposal-agent", "send_proposal")).toBe(true);
    expect(isForbiddenTask("compliance-assistant", "execute_contract")).toBe(true);
    expect(isForbiddenTask("recruiting-agent", "submit_candidate")).toBe(true);
    expect(agentAllowsTask("proposal-agent", "draft_proposal")).toBe(true);
    expect(agentAllowsTask("opportunity-scout", "mark_opportunity_won")).toBe(false);
  });

  it("refuses silent edits to approved prompts", () => {
    expect(() => assertPromptImmutable("approved")).toThrow(AgentError);
    expect(() => assertPromptImmutable("draft")).not.toThrow();
  });

  it("prevents agents from approving their own output", () => {
    expect(() =>
      assertAgentCannotSelfApprove({
        requestingAgentId: "agent-1",
        decidingActorType: "agent",
        decidingAgentId: "agent-1",
      }),
    ).toThrow();
  });

  it("requires a domain approve permission to decide a Review Queue item", () => {
    const recruiter = {
      id: "u",
      status: "active" as const,
      organizationId: "o",
      roleSlugs: ["recruiter"],
      permissions: new Set(ROLE_PERMISSIONS.recruiter),
    };
    expect(reviewDecidePermission("military_mapping")).toBe("military.review");
    expect(reviewDecidePermission("proposal")).toBe("proposals.approve");
    expect(reviewDecidePermission("candidate_submission")).toBe("submissions.approve");
    expect(reviewDecidePermission(null)).toBeNull();
    expect(() => assertCanDecideReview(recruiter, "military_mapping")).toThrow(AuthorizationError);
    expect(() => assertCanDecideReview(recruiter, "proposal")).toThrow(AuthorizationError);
    expect(() => assertCanDecideReview(recruiter, "candidate_submission")).not.toThrow();
    expect(() => assertCanDecideReview(recruiter, null)).toThrow(AuthorizationError);
    expect(() => assertCanDecideReview({ ...recruiter, permissions: new Set(["agents.read"]) }, "candidate_submission")).toThrow(
      AuthorizationError,
    );
  });

  it("does not grant candidate PII to AI operations readers", () => {
    expect(can({
      id: "u",
      status: "active",
      organizationId: "o",
      roleSlugs: ["operations-administrator"],
      permissions: new Set(ROLE_PERMISSIONS["operations-administrator"]),
    }, "candidate_pii.read")).toBe(false);
  });
});
