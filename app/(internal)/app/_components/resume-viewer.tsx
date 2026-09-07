"use client";

import { useEffect, useState } from "react";

import { resumePreviewKind } from "@/lib/hiring/files";

export function ResumeViewer({
  file,
  meta,
}: {
  file: { id: string; filename: string; mimeType: string };
  meta?: string | null;
}) {
  const kind = resumePreviewKind(file);
  const downloadHref = `/api/files/${file.id}?download=1`;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "none") return;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    async function load() {
      try {
        if (kind === "docx") {
          const response = await fetch(`/api/files/${file.id}/preview`, {
            signal: controller.signal,
            credentials: "same-origin",
            cache: "no-store",
          });
          const payload = (await response.json()) as { html?: string; error?: string };
          if (!response.ok || !payload.html) {
            throw new Error(payload.error || "Could not load resume.");
          }
          setHtml(payload.html);
          setPreviewUrl(null);
          setError(null);
          return;
        }

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
        setHtml(null);
        setError(null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setPreviewUrl(null);
        setHtml(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load resume.");
      }
    }

    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, kind]);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 truncate text-sm text-navy">{file.filename}</p>
        <p className="shrink-0 text-sm">
          <a className="text-navy underline" href={downloadHref}>
            Download original
          </a>
          {meta ? <span className="text-muted-foreground"> · {meta}</span> : null}
        </p>
      </div>
      {kind === "pdf" ? (
        <div className="mt-3 overflow-hidden rounded-[8px] border border-card-border bg-white shadow-[var(--shadow-card)]">
          {previewUrl ? (
            <object
              title={`Resume preview: ${file.filename}`}
              data={previewUrl}
              type="application/pdf"
              className="block h-[80vh] min-h-[36rem] w-full"
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
      ) : kind === "docx" ? (
        <div className="mt-3 overflow-hidden rounded-[8px] border border-card-border bg-white shadow-[var(--shadow-card)]">
          {html ? (
            <div className="max-h-[80vh] overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
              <article className="resume-html mx-auto max-w-[46rem]" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{error ?? "Loading resume…"}</p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-[8px] border border-card-border bg-card p-4 text-sm text-muted-foreground">
          Legacy .doc files cannot be previewed in WorkforceOS. Download the original to review it.
        </p>
      )}
    </div>
  );
}
