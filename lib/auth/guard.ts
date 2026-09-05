import { requireCurrentPrincipal } from "./session";
import {
  AuthorizationError,
  isPlatformAdmin,
  requireAnyPermission,
  requirePermission,
  type Permission,
  type Principal,
} from "../rbac/permissions";

export async function requireAppPermission(permission: Permission): Promise<Principal> {
  const principal = await requireCurrentPrincipal();
  requirePermission(principal, permission);
  return principal;
}

export async function requireAnyAppPermission(permissions: Permission[]): Promise<Principal> {
  const principal = await requireCurrentPrincipal();
  requireAnyPermission(principal, permissions);
  return principal;
}

export async function requirePlatformAdmin(): Promise<Principal> {
  const principal = await requireCurrentPrincipal();
  if (!isPlatformAdmin(principal)) {
    throw new AuthorizationError("Administrator access required");
  }
  return principal;
}
