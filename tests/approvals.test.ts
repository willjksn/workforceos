import { describe, expect, it } from "vitest";

import { ApprovalError, assertAgentCannotSelfApprove } from "../lib/approvals/service";

describe("approvals", () => {
  it("blocks an agent from approving its own material output", () => {
    expect(() =>
      assertAgentCannotSelfApprove({
        requestingAgentId: "agent-1",
        decidingActorType: "agent",
        decidingAgentId: "agent-1",
      }),
    ).toThrow(ApprovalError);
  });

  it("allows a human to approve an agent recommendation", () => {
    expect(() =>
      assertAgentCannotSelfApprove({
        requestingAgentId: "agent-1",
        decidingActorType: "human",
      }),
    ).not.toThrow();
  });
});
