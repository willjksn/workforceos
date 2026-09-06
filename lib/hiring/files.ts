const EXECUTABLE_EXTENSIONS = [".exe", ".bat", ".cmd", ".com", ".msi", ".js", ".sh", ".ps1", ".dll", ".scr"];
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const PDF_MIME = "application/pdf";
const DOC_MIME = "application/msword";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALLOWED_RESUME_MIMES = new Set([
  PDF_MIME,
  DOC_MIME,
  "application/vnd.ms-word",
  DOCX_MIME,
  "application/octet-stream",
]);

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function extensionOf(filename: string) {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

export function sanitizeResumeFilename(filename: string) {
  const trimmed = filename.trim().replace(/\\/g, "/").split("/").pop() ?? "resume";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return safe || "resume";
}

function sniffKind(bytes: Uint8Array): "pdf" | "ole" | "zip" | "executable" | "html" | "unknown" {
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) return "executable";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  ) {
    return "ole";
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)) {
    return "zip";
  }
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 16)).trim().toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<script")) return "html";
  return "unknown";
}

export function validateResumeUpload(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  body: Uint8Array;
}) {
  if (input.sizeBytes <= 0 || input.body.byteLength <= 0) {
    throw new FileValidationError("Resume file is empty.");
  }
  if (input.sizeBytes > MAX_RESUME_BYTES || input.body.byteLength > MAX_RESUME_BYTES) {
    throw new FileValidationError("Resume exceeds the 10MB limit.");
  }
  if (input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
    throw new FileValidationError("Invalid filename.");
  }
  const ext = extensionOf(input.filename);
  if (EXECUTABLE_EXTENSIONS.includes(ext)) {
    throw new FileValidationError("Executable uploads are not allowed.");
  }
  if (!ALLOWED_RESUME_EXTENSIONS.includes(ext as (typeof ALLOWED_RESUME_EXTENSIONS)[number])) {
    throw new FileValidationError("Resume must be a PDF, DOC, or DOCX file.");
  }
  const claimed = input.mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (claimed.includes("javascript") || claimed.includes("x-msdownload")) {
    throw new FileValidationError("File type is not allowed.");
  }
  if (claimed && !ALLOWED_RESUME_MIMES.has(claimed)) {
    throw new FileValidationError("Resume MIME type is not allowed.");
  }
  const kind = sniffKind(input.body);
  if (kind === "executable") {
    throw new FileValidationError("Executable content is not allowed.");
  }
  if (kind === "html") {
    throw new FileValidationError("File content does not match an allowed resume type.");
  }
  if (ext === ".pdf") {
    if (kind !== "pdf") throw new FileValidationError("File content does not match the PDF type.");
    if (claimed && claimed !== PDF_MIME && claimed !== "application/octet-stream") {
      throw new FileValidationError("Reported file type does not match file contents.");
    }
    return { mimeType: PDF_MIME };
  }
  if (ext === ".docx") {
    if (kind !== "zip") throw new FileValidationError("File content does not match the DOCX type.");
    if (claimed && claimed !== DOCX_MIME && claimed !== "application/octet-stream") {
      throw new FileValidationError("Reported file type does not match file contents.");
    }
    return { mimeType: DOCX_MIME };
  }
  if (kind !== "ole") {
    throw new FileValidationError("File content does not match the DOC type.");
  }
  if (claimed && claimed !== DOC_MIME && claimed !== "application/vnd.ms-word" && claimed !== "application/octet-stream") {
    throw new FileValidationError("Reported file type does not match file contents.");
  }
  return { mimeType: DOC_MIME };
}
