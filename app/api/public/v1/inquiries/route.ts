import { NextResponse } from "next/server";

import { inquiryPayloadSchema } from "@pierone/public-api-contracts";

import { InquiryError, submitWebsiteInquiry } from "@/lib/inquiries/service";
import { clientIp } from "@/lib/public-api/normalize";
import { readReplayableBody } from "@/lib/public-api/read-body";
import { PublicGatewayError, assertPublicWriteAccess } from "@/lib/public-api/write-access";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { replay, text } = await readReplayableBody(request);
  const ip = clientIp(request);
  try {
    await assertRateLimit({ key: `public-inquiry:${ip}`, ...RATE_LIMITS.publicInquiry });
    await assertPublicWriteAccess(replay, text);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many inquiries. Try again shortly." }, { status: 429 });
    }
    if (error instanceof PublicGatewayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = inquiryPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid inquiry" }, { status: 400 });
  }

  try {
    const result = await submitWebsiteInquiry({ ...parsed.data, ip });
    return NextResponse.json(
      { accepted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InquiryError || error instanceof PublicGatewayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to submit inquiry right now." }, { status: 503 });
  }
}
