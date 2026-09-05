import { requireCurrentPrincipal } from "./session";
import {
  requirePermission,
  type Permission,
  type Principal,
} from "../rbac/permissions";

export async function requireAppPermission(permission: Permission): Promise<Principal> {
  const principal = await requireCurrentPrincipal();
  requirePermission(principal, permission);
  return principal;
}
