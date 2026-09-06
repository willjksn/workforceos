import { NextResponse } from "next/server";

import { getPublicContentPayload } from "@/lib/public-content/service";
import { PUBLIC_CONTENT_CACHE_CONTROL, filterPublicContentByPlacement } from "@/lib/public-content/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const content = filterPublicContentByPlacement(
    await getPublicContentPayload(),
    url.searchParams.get("placement"),
  );
  return NextResponse.json(content, {
    headers: { "Cache-Control": PUBLIC_CONTENT_CACHE_CONTROL },
  });
}
