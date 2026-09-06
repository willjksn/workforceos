const EXECUTABLE_EXTENSIONS = [".exe", ".bat", ".cmd", ".com", ".msi", ".js", ".sh", ".ps1", ".dll", ".scr"];
const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];
const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

function extensionOf(filename: string) {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return "application/x-msdownload";
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export function validateResumeUpload(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  body: Uint8Array;
}) {
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
  if (!ALLOWED_RESUME_EXTENSIONS.includes(ext)) {
    throw new FileValidationError("Resume must be a PDF, Word document, or text file.");
  }
  const sniffed = sniffMime(input.body);
  if (sniffed === "application/x-msdownload") {
    throw new FileValidationError("Executable content is not allowed.");
  }
  const claimed = input.mimeType.toLowerCase();
  if (claimed.includes("javascript") || claimed.includes("x-msdownload") || claimed.includes("octet-stream") && ext === ".exe") {
    throw new FileValidationError("File type is not allowed.");
  }
  if (ext === ".pdf" && sniffed && sniffed !== "application/pdf") {
    throw new FileValidationError("File content does not match the PDF type.");
  }
  if (claimed === "application/pdf" && sniffed && sniffed !== "application/pdf") {
    throw new FileValidationError("Reported file type does not match file contents.");
  }
  return {
    mimeType:
      sniffed ??
      (ext === ".pdf"
        ? "application/pdf"
        : ext === ".docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : ext === ".doc"
            ? "application/msword"
            : "text/plain"),
  };
}
