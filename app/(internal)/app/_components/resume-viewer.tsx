import { canPreviewResumeInline } from "@/lib/hiring/files";

export function ResumeViewer({
  file,
  meta,
}: {
  file: { id: string; filename: string; mimeType: string };
  meta?: string | null;
}) {
  const href = `/api/files/${file.id}`;
  const previewInline = canPreviewResumeInline(file);

  return (
    <div>
      <p className="text-sm">
        <a className="text-navy underline" href={href} target="_blank" rel="noreferrer">
          {file.filename}
        </a>
        {meta ? <span className="text-muted-foreground"> · {meta}</span> : null}
      </p>
      {previewInline ? (
        <iframe
          title={`Resume preview: ${file.filename}`}
          src={href}
          className="mt-3 h-[min(80vh,880px)] w-full rounded-[8px] border border-card-border bg-white"
        />
      ) : (
        <p className="mt-3 rounded-[8px] border border-card-border bg-card p-4 text-sm text-muted-foreground">
          In-page preview is available for PDFs. Word resumes stay in private storage — open the file to review it.
          External document viewers are not used because resumes are Restricted PII.
        </p>
      )}
    </div>
  );
}
