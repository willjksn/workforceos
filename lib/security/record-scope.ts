import { AuthorizationError } from "../rbac/permissions";

export function assertOrganizationScope(
  recordOrganizationId: string | null | undefined,
  organizationId: string,
) {
  if (!recordOrganizationId || recordOrganizationId !== organizationId) {
    throw new AuthorizationError("Record not found");
  }
}
