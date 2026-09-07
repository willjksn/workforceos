import { NextResponse } from "next/server";

import { FileValidationError } from "@/lib/hiring/files";
import { HiringError, submitPublicApplication } from "@/lib/hiring/service";
import { parseApplicationRequest } from "@/lib/public-api/application-intake";
import { clientIp } from "@/lib/public-api/normalize";
import { readReplayableBody } from "@/lib/public-api/read-body";
import { PublicGatewayError, assertPublicWriteAccess } from "@/lib/public-api/write-access";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const { replay, raw } = await readReplayableBody(request);
  const ip = clientIp(request);
  try {
    await assertPublicWriteAccess(replay, raw);
    await assertRateLimit({ key: `public-application:${ip}`, ...RATE_LIMITS.publicApplication });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many applications. Try again shortly." }, { status: 429 });
    }
    if (error instanceof PublicGatewayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const parsed = await parseApplicationRequest(replay);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await submitPublicApplication({
      ...parsed.data,
      linkedinUrl: parsed.data.linkedinUrl || null,
      resume: parsed.resume,
      ip,
    });
    return NextResponse.json(
      {
        accepted: true,
        message: "Application received. We will contact you if there is a next step.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HiringError || error instanceof FileValidationError) {
      const storageFailure = /storage is not configured|Resume storage failed|not implemented/i.test(error.message);
      return NextResponse.json({ error: error.message }, { status: storageFailure ? 503 : 400 });
    }
    return NextResponse.json({ error: "Unable to submit application right now." }, { status: 503 });
  }
}
