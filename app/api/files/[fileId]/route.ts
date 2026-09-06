import { NextResponse } from "next/server";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { downloadStoredFile, HiringError } from "@/lib/hiring/service";
import { AuthorizationError } from "@/lib/rbac/permissions";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const principal = await requireCurrentPrincipal();
    const { fileId } = await context.params;
    const { file, body } = await downloadStoredFile(principal, fileId);
    const filename = file.filename.replace(/[\r\n"]/g, "_");
    const payload = new Uint8Array(body.byteLength);
    payload.set(body);
    return new NextResponse(payload, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof HiringError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
