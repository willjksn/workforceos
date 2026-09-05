export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
] as const;

export function assertUploadAllowed(input: { sizeBytes: number; mimeType: string; filename: string }) {
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 25MB upload limit.");
  }
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
    throw new Error("File type is not allowed.");
  }
  if (input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
    throw new Error("Invalid filename.");
  }
}
