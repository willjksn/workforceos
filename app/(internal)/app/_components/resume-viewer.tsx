"use client";

import { useEffect, useState } from "react";

import { canPreviewResumeInline } from "@/lib/hiring/files";

export function ResumeViewer({
  file,
  meta,
}: {
  file: { id: string; filename: string; mimeType: string };
  meta?: string | null;
}) {
  const previewInline = canPreviewResumeInline(file);
  const downloadHref = `/api/files/${file.id}?download=1`;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewInline) return;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/files/${file.id}`, {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Could not load resume.");
        }
        const buffer = await response.arrayBuffer();
        objectUrl = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
        setPreviewUrl(objectUrl);
        setError(null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setPreviewUrl(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load resume.");
      }
    }

    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, previewInline]);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 truncate text-sm text-navy">{file.filename}</p>
        <p className="shrink-0 text-sm">
          <a className="text-navy underline" href={downloadHref}>
            Download
          </a>
          {meta ? <span className="text-muted-foreground"> · {meta}</span> : null}
        </p>
      </div>
      {previewInline ? (
        <div className="mt-3 overflow-hidden rounded-[8px] border border-card-border bg-white">
          {previewUrl ? (
            <object
              title={`Resume preview: ${file.filename}`}
              data={previewUrl}
              type="application/pdf"
              className="block h-[70vh] min-h-[32rem] w-full"
            >
              <p className="p-4 text-sm text-muted-foreground">
                Preview did not render.{" "}
                <a className="text-navy underline" href={downloadHref}>
                  Download the resume
                </a>
                .
              </p>
            </object>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{error ?? "Loading resume…"}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-[8px] border border-card-border bg-card p-4 text-sm text-muted-foreground">
          In-page preview is available for PDFs. Word resumes stay in private storage — download the file to review it.
          External document viewers are not used because resumes are Restricted PII.
        </p>
      )}
    </div>
  );
}
