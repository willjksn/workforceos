import { AuthorizationError } from "../rbac/permissions";

export function assertLocalAccountNotDisabled(status: string) {
  if (status === "disabled") {
    throw new AuthorizationError("This WorkforceOS account is disabled");
  }
}

export function assertLocalAccountActive(status: string) {
  assertLocalAccountNotDisabled(status);
  if (status !== "active") {
    throw new AuthorizationError("This WorkforceOS account is not active");
  }
}
