import { NextResponse } from "next/server";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { resumePreviewKind } from "@/lib/hiring/files";
import { convertDocxToPreviewHtml } from "@/lib/hiring/resume-html";
import { downloadStoredFile, HiringError } from "@/lib/hiring/service";
import { AuthorizationError } from "@/lib/rbac/permissions";

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const principal = await requireCurrentPrincipal();
    const { fileId } = await context.params;
    const { file, body } = await downloadStoredFile(principal, fileId);
    const kind = resumePreviewKind({ mimeType: file.mimeType, filename: file.filename, body });
    if (kind === "pdf") {
      return NextResponse.json({ kind: "pdf" });
    }
    if (kind !== "docx") {
      return NextResponse.json({ error: "This resume type cannot be previewed in WorkforceOS." }, { status: 422 });
    }
    const html = await convertDocxToPreviewHtml(body);
    return NextResponse.json({ kind: "html", html });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof HiringError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resume preview failed." },
      { status: 503 },
    );
  }
}
