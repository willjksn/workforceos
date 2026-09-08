"use client";

import { useState } from "react";

import { buttonPrimaryClass, fieldClass } from "@/components/ui-classes";
import { readPublicJsonError } from "@/lib/public-errors";

export function MilitaryJoinForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const response = await fetch("/api/military-talent", { method: "POST", body: new FormData(event.currentTarget) });
    if (!response.ok) {
      setStatus("error");
      setMessage(await readPublicJsonError(response, "Unable to submit right now."));
      return;
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="rounded-[6px] border border-border bg-white p-6">
        <h2 className="font-serif text-2xl text-navy">Submission received</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Thanks for joining the PierOne Military Talent Network. We received your transition profile. Our team may use
          your military experience, career goals, location preferences, and transition timing to identify potential
          employer and SkillBridge-eligible opportunities. Joining does not guarantee a SkillBridge approval, interview,
          placement, or employment.
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
        <label className="block text-sm">
          Branch
          <select name="branch" className={fieldClass}>
            <option value="">Select</option>
            <option value="army">Army</option>
            <option value="navy">Navy</option>
            <option value="air_force">Air Force</option>
            <option value="marine_corps">Marine Corps</option>
            <option value="coast_guard">Coast Guard</option>
            <option value="space_force">Space Force</option>
          </select>
        </label>
        <Field label="MOS / Rating / AFSC" name="mos" />
        <Field label="Rank" name="rank" />
        <Field label="Current installation" name="currentInstallation" />
        <Field label="Current location" name="currentLocation" />
        <Field label="Separation / retirement date" name="separationDate" type="date" />
        <Field label="SkillBridge window start" name="skillbridgeWindowStart" type="date" />
        <Field label="SkillBridge window end" name="skillbridgeWindowEnd" type="date" />
        <Field label="Preferred location" name="preferredLocation" />
        <Field label="Relocation willingness" name="relocationWillingness" />
        <Field label="Remote preference" name="remotePreference" />
        <Field label="Ideal industry" name="idealIndustry" />
        <Field label="Ideal employer (optional)" name="idealEmployer" />
        <label className="block text-sm">
          Employment preference
          <select name="employmentPreference" className={fieldClass}>
            <option value="">Select</option>
            <option value="skillbridge">SkillBridge-eligible opportunity</option>
            <option value="direct_hire">Direct civilian employment</option>
            <option value="either">Either / open</option>
          </select>
        </label>
        <Field label="LinkedIn (optional)" name="linkedinUrl" className="sm:col-span-2" />
      </div>
      <label className="block text-sm">
        Target civilian roles
        <textarea name="targetCivilianRoles" rows={4} className={fieldClass} />
      </label>
      <label className="block text-sm">
        Resume (PDF, DOC, or DOCX)
        <input
          type="file"
          name="resume"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className={`${fieldClass} text-sm`}
        />
      </label>
      <label className="flex items-start gap-2 text-sm text-muted">
        <input required type="checkbox" name="consent" className="mt-1" />
        <span>
          I have read the{" "}
          <a className="underline" href="/candidate-privacy">
            Candidate Privacy Notice
          </a>
          .
        </span>
      </label>
      {status === "error" ? <p className="text-sm text-red-800">{message}</p> : null}
      <button type="submit" disabled={status === "submitting"} className={buttonPrimaryClass}>
        {status === "submitting" ? "Submitting…" : "Join the Military Talent Network"}
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
