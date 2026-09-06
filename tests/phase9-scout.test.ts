import { describe, expect, it } from "vitest";

import { isRegisteredCommand } from "../lib/scout/commands";
import { parseScoutPageContext } from "../lib/scout/page-context";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { stripScoutPii } from "../lib/scout/pii";
import { ROLE_PERMISSIONS, can, type Principal } from "../lib/rbac/permissions";
import { cardsToQueueItems, indexInScoutQueue, scoutQueueNeighbor } from "../lib/scout/result-queue";

function principalFor(role: keyof typeof ROLE_PERMISSIONS): Principal {
  return {
    id: "user-1",
    status: "active",
    organizationId: "org-1",
    roleSlugs: [role],
    permissions: new Set(ROLE_PERMISSIONS[role]),
  };
}

describe("Phase 9 Scout", () => {
  it("rejects SQL and unknown commands", () => {
    expect(parseScoutIntent("SELECT email FROM candidates").ok).toBe(false);
    expect(parseScoutIntent("DELETE_EVERYTHING now").ok).toBe(false);
    expect(isRegisteredCommand("SEARCH")).toBe(true);
    expect(isRegisteredCommand("RUN_SQL")).toBe(false);
  });

  it("parses page context from candidate and job routes", () => {
    const candidate = parseScoutPageContext("/app/talent/00000000-0000-4000-8c00-000000000101");
    expect(candidate.entityType).toBe("candidate");
    const job = parseScoutPageContext("/app/jobs/00000000-0000-4000-8c00-000000000011");
    expect(job.entityType).toBe("job");
  });

  it("strips restricted PII before model context", () => {
    const stripped = stripScoutPii({ email: "hidden@example.test", phone: "555", currentTitle: "EM" }, false);
    expect(stripped.email).toBeNull();
    expect(stripped.phone).toBeNull();
    expect(stripped.currentTitle).toBe("EM");
  });

  it("grants Scout and SkillBridge permissions to operating roles without giving read-only PII", () => {
    const recruiter = principalFor("recruiter");
    const reader = principalFor("read-only");
    expect(can(recruiter, "scout.use")).toBe(true);
    expect(can(recruiter, "skillbridge.write")).toBe(true);
    expect(can(reader, "scout.search")).toBe(true);
    expect(can(reader, "candidate_pii.read")).toBe(false);
    expect(can(reader, "scout.internal_actions")).toBe(false);
  });

  it("builds a Scout result queue that can step to previous and next records", () => {
    const items = cardsToQueueItems([
      { href: "/app/talent/a", title: "Ann", type: "candidate", id: "a" },
      { href: "/app/talent/a", title: "Ann duplicate", type: "candidate", id: "a" },
      { href: "/app/talent/b", title: "Blake", type: "candidate", id: "b" },
      { href: "/app/military/skillbridge/c", title: "Carter", type: "skillbridge", id: "c" },
    ]);
    expect(items).toHaveLength(3);
    expect(indexInScoutQueue(items, "/app/talent/b")).toBe(1);
    expect(scoutQueueNeighbor(items, "/app/talent/b", -1)?.title).toBe("Ann");
    expect(scoutQueueNeighbor(items, "/app/talent/b", 1)?.title).toBe("Carter");
    expect(scoutQueueNeighbor(items, "/app/talent/a", -1)).toBeNull();
    expect(scoutQueueNeighbor(items, "/app/jobs/missing", 1)).toBeNull();
  });
});
