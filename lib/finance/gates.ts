import { AuthorizationError, can, type Permission, type Principal } from "../rbac/permissions";
import { FinanceError } from "./money";

export function assertFinancePermission(principal: Principal, permission: Permission) {
  if (!can(principal, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
}

export function assertFeeOverrideAllowed(input: {
  reason?: string | null;
  approved: boolean;
}) {
  if (!input.reason?.trim()) {
    throw new FinanceError("Fee override requires a reason, user, date, and approval");
  }
  if (!input.approved) {
    throw new FinanceError("Fee override requires human approval");
  }
}

export function assertScheduleChangeAfterExecutionAllowed(input: {
  contractStatus?: string | null;
  approved: boolean;
  reason?: string | null;
}) {
  if (input.contractStatus !== "executed") return;
  if (!input.reason?.trim() || !input.approved) {
    throw new FinanceError("Billing schedule changes after contract execution require human approval");
  }
}
