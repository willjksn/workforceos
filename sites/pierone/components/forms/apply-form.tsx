"use client";

import { useState } from "react";

import { buttonPrimaryClass, fieldClass } from "@/components/ui-classes";
import { readPublicJsonError } from "@/lib/public-errors";

export function ApplyForm({ slug, jobTitle }: { slug: string; jobTitle: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const form = new FormData(event.currentTarget);
    form.set("slug", slug);
    const response = await fetch("/api/apply", { method: "POST", body: form });
    if (!response.ok) {
      setStatus("error");
      setMessage(await readPublicJsonError(response, "Unable to submit this application."));
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="rounded-[6px] border border-border bg-white p-6">
        <h2 className="font-serif text-2xl text-navy">Application received</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Thank you for applying to {jobTitle}. Receiving this confirmation does not mean an interview has been scheduled.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[6px] border border-border bg-white p-6" encType="multipart/form-data">
      <input name="honeypot" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" required />
        <Field label="Last name" name="lastName" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone" name="phone" />
        <Field label="City" name="city" />
        <Field label="State" name="region" />
        <Field label="LinkedIn" name="linkedinUrl" className="sm:col-span-2" />
      </div>
      <label className="block text-sm">
        Resume (PDF, DOC, or DOCX)
        <input
          required
          type="file"
          name="resume"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className={`${fieldClass} text-sm`}
        />
      </label>
      <p className="text-xs text-muted">
        By applying you acknowledge the{" "}
        <a className="underline" href="/candidate-privacy">
          Candidate Privacy Notice
        </a>
        .
      </p>
      {status === "error" ? <p className="text-sm text-red-800">{message}</p> : null}
      <button type="submit" disabled={status === "submitting"} className={buttonPrimaryClass}>
        {status === "submitting" ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      {label}
      <input required={required} type={type} name={name} className={fieldClass} />
    </label>
  );
}
