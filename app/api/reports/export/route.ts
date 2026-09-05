import { NextResponse } from "next/server";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { isReportCategory, parseReportFilters } from "@/lib/reporting/filters";
import { exportReportCsv } from "@/lib/reporting/export";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";
import { AuthorizationError } from "@/lib/rbac/permissions";

export async function GET(request: Request) {
  try {
    const principal = await requireCurrentPrincipal();
    await assertRateLimit({ key: `export:${principal.id}`, ...RATE_LIMITS.export });
    const url = new URL(request.url);
    const category = url.searchParams.get("category") ?? "";
    if (!isReportCategory(category)) {
      return NextResponse.json({ error: "Unknown report category" }, { status: 400 });
    }
    const includePii = url.searchParams.get("pii") === "1";
    const result = await exportReportCsv({
      actor: principal,
      organizationId: principal.organizationId,
      category,
      filters: parseReportFilters({
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        companyId: url.searchParams.get("companyId") ?? undefined,
        serviceCode: url.searchParams.get("serviceCode") ?? undefined,
        ownerUserId: url.searchParams.get("ownerUserId") ?? undefined,
      }),
      includePii,
    });
    return new NextResponse(result.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to export" }, { status: 500 });
  }
}
