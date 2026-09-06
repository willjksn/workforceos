import { NextResponse } from "next/server";

import { getPublicJobBySlug } from "@/lib/hiring/service";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const job = await getPublicJobBySlug(slug);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const { posting, job: internalJob, ...publicJob } = job;
  void posting;
  void internalJob;
  return NextResponse.json({ job: publicJob });
}
