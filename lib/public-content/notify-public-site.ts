import { getServerEnv } from "../env";

const REVALIDATE_PATHS = ["/", "/careers", "/skillbridge"];

export async function notifyPublicSiteRevalidate() {
  const env = getServerEnv();
  const careersUrl = env.PUBLIC_CAREERS_URL;
  const secret = env.PUBLIC_SITE_INTEGRATION_SECRET;
  if (!careersUrl || !secret) return;
  const origin = careersUrl.replace(/\/careers\/?$/, "");
  try {
    await fetch(`${origin}/api/revalidate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pierone-revalidate-secret": secret,
      },
      body: JSON.stringify({ paths: REVALIDATE_PATHS }),
    });
  } catch {
    // ISR TTL (60s) still expires the stale public payload.
  }
}
