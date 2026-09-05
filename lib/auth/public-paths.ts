export const PUBLIC_PATH_PREFIXES = ["/sign-in", "/sign-up", "/api/inngest", "/api/integrations/webhooks"] as const;

export const PROTECTED_ROUTE_SAMPLES = [
  "/app",
  "/app/candidates",
  "/app/talent",
  "/app/jobs",
  "/app/military",
  "/app/admin/system-health",
] as const;

export function isPublicPath(pathname: string) {
  return pathname === "/" || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
