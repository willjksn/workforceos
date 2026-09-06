import { NextResponse } from "next/server";

import { listPublicJobs } from "@/lib/hiring/service";

export async function GET() {
  const jobs = await listPublicJobs();
  return NextResponse.json(
    { jobs },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
