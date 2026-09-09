import { canAny, type Permission, type Principal } from "@/lib/rbac/permissions";

/** Signed-in employees can read Academy. Recruiter has scout.use, not agents.manage. */
export const ACADEMY_READ_PERMISSIONS: Permission[] = ["knowledge.read", "scout.use"];

export function canReadAcademy(principal: Principal) {
  return canAny(principal, ACADEMY_READ_PERMISSIONS);
}
