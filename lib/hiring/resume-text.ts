import mammoth from "mammoth";

import { looksLikePdf, resumePreviewKind } from "./files";

export async function extractResumeText(input: {
  filename: string;
  mimeType: string;
  body: Uint8Array;
}) {
  const kind = resumePreviewKind(input);
  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(input.body) });
    const text = result.value.replace(/\u0000/g, "").trim();
    if (!text) throw new Error("The Word resume did not contain extractable text.");
    return text;
  }
  if (kind === "pdf" || looksLikePdf(input)) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(input.body);
    const extracted = await extractText(pdf, { mergePages: true });
    const text = extracted.text.replace(/\u0000/g, "").trim();
    if (!text) throw new Error("The PDF resume did not contain extractable text.");
    return text;
  }
  throw new Error("Resume text extraction is available for PDF and DOCX files.");
}
