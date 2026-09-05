import { describe, expect, it } from "vitest";

import {
  assertLocalAccountActive,
  assertLocalAccountNotDisabled,
} from "../lib/auth/account-status";
import { AuthorizationError } from "../lib/rbac/permissions";

describe("local account status", () => {
  it("rejects a disabled WorkforceOS user even if Clerk still has a session", () => {
    expect(() => assertLocalAccountNotDisabled("disabled")).toThrow(AuthorizationError);
    expect(() => assertLocalAccountNotDisabled("disabled")).toThrow(/disabled/);
    expect(() => assertLocalAccountActive("disabled")).toThrow(/disabled/);
  });

  it("rejects invited or archived-style non-active statuses for protected work", () => {
    expect(() => assertLocalAccountActive("invited")).toThrow(/not active/);
    expect(() => assertLocalAccountNotDisabled("invited")).not.toThrow();
    expect(() => assertLocalAccountActive("active")).not.toThrow();
  });
});
