export const PUBLIC_PATH_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/api/inngest",
  "/api/integrations/webhooks",
  "/careers",
  "/jobs",
  "/api/public",
  "/onboarding/access",
] as const;

export const PROTECTED_ROUTE_SAMPLES = [
  "/app",
  "/app/candidates",
  "/app/talent",
  "/app/jobs",
  "/app/military",
  "/app/admin/system-health",
  "/app/onboarding",
  "/api/files",
] as const;

export function isPublicPath(pathname: string) {
  return pathname === "/" || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
