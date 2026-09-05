import { describe, expect, it } from "vitest";

import {
  canCreateDeliveryProject,
  mappingIsClientFacingDraft,
  originatingAgentCannotApprove,
} from "../lib/military/mtoa";

describe("military talent opportunity assessment gates", () => {
  it("keeps client-facing drafts from becoming delivery projects", () => {
    expect(canCreateDeliveryProject("draft")).toBe(false);
    expect(canCreateDeliveryProject("in_review")).toBe(false);
    expect(canCreateDeliveryProject("approved")).toBe(true);
    expect(mappingIsClientFacingDraft("draft")).toBe(true);
  });

  it("prevents agents from approving their own material output", () => {
    expect(originatingAgentCannotApprove("agent")).toBe(true);
    expect(originatingAgentCannotApprove("human")).toBe(false);
  });
});
