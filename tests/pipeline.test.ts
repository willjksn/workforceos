import { describe, expect, it } from "vitest";

import {
  materialRejectionRequiresHuman,
  normalizePipelineStage,
} from "../lib/recruiting/pipeline";
import { canOpenExternalSourcing, externalSourcingHook } from "../lib/recruiting/external-sourcing";

describe("pipeline and internal-first rules", () => {
  it("maps legacy pipeline values to Phase 3 stages", () => {
    expect(normalizePipelineStage("sourced")).toBe("identified");
    expect(normalizePipelineStage("interviewing")).toBe("interview");
  });

  it("requires a human for material rejection", () => {
    expect(materialRejectionRequiresHuman("rejected", "agent")).toBe(true);
    expect(materialRejectionRequiresHuman("rejected", "human")).toBe(false);
  });

  it("blocks external sourcing until internal search is complete", () => {
    expect(canOpenExternalSourcing(null)).toBe(false);
    const hook = externalSourcingHook({
      provider: "linkedin-recruiter",
      jobId: "job-1",
      internalSearchCompletedAt: null,
    });
    expect(hook.allowed).toBe(false);
  });
});
