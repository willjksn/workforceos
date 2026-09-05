import { describe, expect, it } from "vitest";

import { redactSnapshot } from "../lib/audit/record-audit-event";

describe("audit redaction", () => {
  it("redacts secrets from snapshots", () => {
    const snapshot = redactSnapshot({
      name: "Harbor Manufacturing",
      password: "should-not-log",
      nested: { apiKey: "secret", website: "https://example.test" },
    });
    expect(snapshot).toEqual({
      name: "Harbor Manufacturing",
      password: "[redacted]",
      nested: { apiKey: "[redacted]", website: "https://example.test" },
    });
  });
});
