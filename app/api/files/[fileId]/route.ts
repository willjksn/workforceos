import { NextResponse } from "next/server";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { storedFileContentHeaders } from "@/lib/hiring/files";
import { downloadStoredFile, HiringError } from "@/lib/hiring/service";
import { AuthorizationError } from "@/lib/rbac/permissions";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const principal = await requireCurrentPrincipal();
    const { fileId } = await context.params;
    const download = new URL(request.url).searchParams.get("download") === "1";
    const { file, body } = await downloadStoredFile(principal, fileId);
    const payload = new Uint8Array(body.byteLength);
    payload.set(body);
    return new NextResponse(payload, {
      headers: storedFileContentHeaders({
        filename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: payload.byteLength,
        download,
        body: payload,
      }),
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
