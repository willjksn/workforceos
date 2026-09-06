"use client";

import { useState } from "react";

import { SERVICE_INTEREST } from "@/lib/contracts";
import { buttonPrimaryClass, fieldClass } from "@/components/ui-classes";

const LABELS: Record<(typeof SERVICE_INTEREST)[number], string> = {
  "professional-search": "Professional & Technical Search",
  "military-talent-opportunity-assessment": "Military Talent",
  "ta-performance-assessment": "Talent Acquisition Performance",
  "fractional-talent-partner": "Fractional Talent Partner",
  "workforce-pipeline-assessment": "Workforce Pipeline",
  other: "Not sure / Other",
};

export function InquiryForm({
  defaultService = "other",
  pagePath = "/contact",
}: {
  defaultService?: (typeof SERVICE_INTEREST)[number];
  pagePath?: string;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/inquiry", { method: "POST", body: data });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error ?? "Unable to submit right now. Please try again.");
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="border border-border bg-white p-6 rounded-[6px]">
        <h3 className="font-serif text-2xl text-navy">Thank you</h3>
        <p className="mt-3 text-sm leading-6 text-muted">
          We received your message. This acknowledgement does not confirm a meeting or an engagement.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[6px] border border-border bg-white p-6">
      <input name="company_website_hp" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <input type="hidden" name="pagePath" value={pagePath} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" required />
        <Field label="Last name" name="lastName" required />
        <Field label="Work email" name="email" type="email" required />
        <Field label="Phone (optional)" name="phone" />
        <Field label="Company" name="company" required />
        <Field label="Title (optional)" name="title" />
        <Field label="Company website (optional)" name="companyWebsite" className="sm:col-span-2" />
      </div>
      <label className="block text-sm">
        What can we help with?
        <select name="serviceInterest" defaultValue={defaultService} className={fieldClass}>
          {SERVICE_INTEREST.map((code) => (
            <option key={code} value={code}>
              {LABELS[code]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Hiring or workforce challenge
        <textarea required name="challenge" rows={5} className={fieldClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Approximate timeline (optional)" name="timeline" />
        <Field label="Number/type of roles (optional)" name="roleCount" />
        <Field label="Location (optional)" name="location" />
        <Field label="How did you hear about PierOne? (optional)" name="referralSource" />
      </div>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input required type="checkbox" name="consent" className="mt-1" />
        <span>
          I understand this inquiry will be stored by PierOne Partners to respond to this request. See the{" "}
          <a className="underline" href="/privacy">
            Privacy Policy
          </a>
          .
        </span>
      </label>
      {status === "error" ? <p className="text-sm text-red-800">{message}</p> : null}
      <button type="submit" disabled={status === "submitting"} className={buttonPrimaryClass}>
        {status === "submitting" ? "Submitting…" : "Submit"}
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
