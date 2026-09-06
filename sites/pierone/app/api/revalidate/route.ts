import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const ALLOWED_PATHS = new Set(["/", "/careers", "/skillbridge"]);

export async function POST(request: Request) {
  const secret = process.env.WORKFORCEOS_SITE_SECRET;
  const provided = request.headers.get("x-pierone-revalidate-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { paths?: string[] };
  const paths = (body.paths ?? ["/", "/careers", "/skillbridge"]).filter((path) => ALLOWED_PATHS.has(path));
  for (const path of paths) {
    revalidatePath(path);
  }
  return NextResponse.json({ revalidated: true, paths });
}
