"use client";

import { useState } from "react";

export function PublicApplyForm({ slug, jobTitle }: { slug: string; jobTitle: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const form = event.currentTarget;
    const payload = new FormData(form);
    payload.set("slug", slug);
    const response = await fetch("/api/public/v1/applications", {
      method: "POST",
      body: payload,
    });
    const data = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setStatus("error");
      setMessage(data.error ?? "Unable to submit this application.");
      return;
    }
    setStatus("done");
    setMessage(data.message ?? "Application received.");
  }

  if (status === "done") {
    return (
      <div className="border border-[#DCE2E7] bg-white p-6">
        <h2 className="font-serif text-2xl text-[#0E2D4A]">Thank you</h2>
        <p className="mt-3 text-sm leading-6 text-[#102A3A]">
          Your application for <strong>{jobTitle}</strong> was received. {message} We do not promise an interview or a specific timeline.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-[#DCE2E7] bg-white p-6" encType="multipart/form-data">
      <input name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-[#102A3A]">
          First name
          <input required name="firstName" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          Last name
          <input required name="lastName" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          Preferred name
          <input name="preferredName" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          Email
          <input required type="email" name="email" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          Phone
          <input name="phone" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          City
          <input name="city" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          State
          <input name="region" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          LinkedIn URL
          <input name="linkedinUrl" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm text-[#102A3A]">
        Resume (PDF, DOC, or DOCX)
        <input
          required
          type="file"
          name="resume"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="mt-1 w-full border border-[#DCE2E7] px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-[#6B7280]">Maximum 10MB. Files are stored privately. We do not store the binary in the database.</span>
      </label>
      <label className="block text-sm text-[#102A3A]">
        Are you authorized to work in the United States?
        <select name="workAuthorization" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2">
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <label className="block text-sm text-[#102A3A]">
        How did you hear about us?
        <input name="howHeard" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-[#102A3A]">
          Military branch (if applicable)
          <input name="branch" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
        <label className="text-sm text-[#102A3A]">
          MOS / Rating / AFSC
          <input name="mos" className="mt-1 w-full border border-[#DCE2E7] px-3 py-2" />
        </label>
      </div>
      {status === "error" ? <p className="text-sm text-red-700">{message}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="bg-[#0E2D4A] px-5 py-2.5 text-sm text-white disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
