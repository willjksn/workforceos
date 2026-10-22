import Link from "next/link";
import type { ReactNode } from "react";

import { PrimaryButton } from "@/components/ui/button";
import { applyResumeToCandidateAction } from "@/lib/actions/talent";
import {
  addCredentialAction,
  addEducationAction,
  addMilitaryDutyAction,
  addMilitaryEquipmentAction,
  addMilitaryExperienceAction,
  addMilitaryTrainingAction,
  addPreferredLocationAction,
  addTargetRoleAction,
  completeProfileReviewAction,
  setClearanceAction,
  updateLeadershipAction,
  updateTransitionProfileAction,
} from "@/lib/actions/transition-profile";
import { evidenceReviewLabel } from "@/lib/military-talent/evidence-labels";
import { COMPLETENESS_LABELS, type ProfileCompleteness } from "@/lib/military-talent/profile-completeness";
import type { loadTransitionEvidence } from "@/lib/military-talent/transition-evidence";
import type { getSkillBridgeDetail } from "@/lib/skillbridge/service";

import { ActionForm } from "../../../_components/action-form";
import { ResumeViewer } from "../../../_components/resume-viewer";
import { formatDate, formatLabel } from "../../../_components/ui";

type Detail = NonNullable<Awaited<ReturnType<typeof getSkillBridgeDetail>>>;
type Evidence = Awaited<ReturnType<typeof loadTransitionEvidence>>;

const inputClass = "mt-1 w-full rounded-[6px] border border-border px-3 py-2 text-sm";

export function TransitionProfileSections({
  profileId,
  detail,
  evidence,
  completeness,
  canReadPii,
  canWriteProfile,
  canWriteEvidence,
  canApplyResume,
}: {
  profileId: string;
  detail: Detail;
  evidence: Evidence;
  completeness: ProfileCompleteness;
  canReadPii: boolean;
  canWriteProfile: boolean;
  canWriteEvidence: boolean;
  canApplyResume: boolean;
}) {
  const candidate = detail.card.candidate;
  const profile = detail.card.profile;
  const hidden = { candidateId: candidate.id, profileId };

  return (
    <div className="mt-6 space-y-10">
      <section>
        <h2 className="section-title">Profile completeness</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informational only. These states do not rank this person, change matches, or reject anyone.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {completeness.sections.map((section) => (
            <li key={section.key} className="rounded-[8px] border border-card-border bg-card p-3 text-sm">
              <p className="text-muted-foreground">{section.label}</p>
              <p className="font-medium text-navy">{COMPLETENESS_LABELS[section.state]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="section-title">Identity</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Fact label="Name" value={candidate.fullName} />
          <Fact label="Military status" value={formatLabel(candidate.militaryStatus)} />
          <Fact label="Location" value={[candidate.city, candidate.region].filter(Boolean).join(", ")} />
          <Fact label="Contact" value={canReadPii ? [candidate.email, candidate.phone].filter(Boolean).join(" · ") : "Hidden without candidate contact access"} />
          <Fact label="Person relocation" value={candidate.relocationWillingness} />
          <Fact label="Person remote preference" value={candidate.remotePreference} />
        </dl>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-navy">Resume</h3>
          {canReadPii && detail.resumeFile ? (
            <div className="mt-2 space-y-3">
              <ResumeViewer file={detail.resumeFile} meta={`${formatLabel(profile.resumeStatus)} · ${formatDate(detail.resumeFile.createdAt)}`} />
              {canApplyResume ? (
                <ActionForm action={applyResumeToCandidateAction} className="space-y-2">
                  <input type="hidden" name="candidateId" value={candidate.id} />
                  <input type="hidden" name="redirectTo" value={`/app/military/skillbridge/${profileId}`} />
                  <p className="text-sm text-muted-foreground">
                    Fills blank fields and adds unverified suggestions. Human-reviewed values are not overwritten.
                  </p>
                  <PrimaryButton>Fill empty fields from resume</PrimaryButton>
                </ActionForm>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {detail.resumeFile || profile.resumeStatus !== "missing"
                ? canReadPii
                  ? "Resume metadata is missing."
                  : "Resume on file is hidden without candidate contact access."
                : "No resume on file."}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">Transition</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Separation timing and the SkillBridge pathway live on this Transition Talent Profile. Rank on the snapshot below is the current display copy. Each tour keeps its own rank.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Current snapshot" value={[detail.card.occupation?.branch, detail.card.occupation?.code ?? profile.mosRateAfscDisplay, profile.rankTitle ?? profile.payGrade].filter(Boolean).join(" · ")} />
          <Fact label="Separation" value={formatDate(profile.separationDate)} />
          <Fact label="ETS (Army / USMC)" value={formatDate(profile.etsDate)} />
          <Fact label="EAOS (Navy)" value={formatDate(profile.eaosDate)} />
          <Fact label="End of service" value={formatDate(profile.endOfServiceDate)} />
          <Fact label="Retirement" value={formatDate(profile.retirementDate)} />
          <Fact label="Available" value={formatDate(profile.candidateAvailableDate)} />
          <Fact label="SkillBridge eligibility" value={formatDate(profile.skillbridgeEligibilityDate)} />
          <Fact label="SkillBridge approval" value={formatLabel(profile.skillbridgeApprovalStatus)} />
          <Fact label="SkillBridge window" value={[formatDate(profile.skillbridgeWindowStart), formatDate(profile.skillbridgeWindowEnd)].filter((value) => value && value !== "—").join(" – ")} />
          <Fact label="Terminal leave" value={formatDate(profile.terminalLeaveStart)} />
          <Fact label="Relocation for this transition" value={profile.relocationWillingness} />
          <Fact label="Remote preference for this transition" value={profile.remotePreference} />
          <Fact label="Primary preferred location" value={profile.preferredLocationPrimary} />
        </dl>
        {detail.card.preferredLocations.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {detail.card.preferredLocations.map((location) => (
              <li key={location.id}>
                {location.locationLabel}
                {location.isPrimary ? " · primary" : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {canWriteProfile ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <ActionForm action={updateTransitionProfileAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <Label text="Separation date"><input className={inputClass} type="date" name="separationDate" /></Label>
              <Label text="ETS date"><input className={inputClass} type="date" name="etsDate" /></Label>
              <Label text="EAOS date"><input className={inputClass} type="date" name="eaosDate" /></Label>
              <Label text="Available date"><input className={inputClass} type="date" name="candidateAvailableDate" /></Label>
              <Label text="SkillBridge window start"><input className={inputClass} type="date" name="skillbridgeWindowStart" /></Label>
              <Label text="SkillBridge window end"><input className={inputClass} type="date" name="skillbridgeWindowEnd" /></Label>
              <Label text="Relocation willingness"><input className={inputClass} name="relocationWillingness" /></Label>
              <Label text="Remote preference"><input className={inputClass} name="remotePreference" /></Label>
              <PrimaryButton>Save transition timing</PrimaryButton>
            </ActionForm>
            <ActionForm action={addPreferredLocationAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <Label text="Preferred location"><input className={inputClass} name="locationLabel" required /></Label>
              <Label text="City"><input className={inputClass} name="city" /></Label>
              <Label text="Region"><input className={inputClass} name="region" /></Label>
              <PrimaryButton>Add preferred location</PrimaryButton>
            </ActionForm>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="section-title">Military experience</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One person can have several tours. Branch, occupation, rank, and pay grade on a tour are the history.
        </p>
        <div className="mt-3 space-y-4">
          {evidence.experiences.map((row) => (
            <article key={row.experience.id} className="rounded-[8px] border border-card-border bg-card p-4">
              <h3 className="font-medium text-navy">
                {formatLabel(row.occupation.branch)} · {row.occupation.code} · {row.occupation.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {[row.experience.rank, row.experience.payGrade, row.experience.unit, row.experience.dutyStations].filter(Boolean).join(" · ") || "Rank and unit not recorded"}
              </p>
              {row.experience.notes ? <p className="mt-2 text-sm">Duty narrative: {row.experience.notes}</p> : null}
              {row.experience.platforms ? <p className="mt-1 text-sm">Platform narrative: {row.experience.platforms}</p> : null}
              {row.experience.training ? <p className="mt-1 text-sm">Training narrative: {row.experience.training}</p> : null}
              {row.experience.clearance ? <p className="mt-1 text-sm">Historical clearance note: {row.experience.clearance}</p> : null}
              <p className="mt-2 text-sm">
                Leadership: {[
                  row.experience.leadershipLevel,
                  row.experience.directReportsCount != null ? `${row.experience.directReportsCount} direct` : null,
                  row.experience.teamSize != null ? `team ${row.experience.teamSize}` : null,
                  row.experience.resourceScope,
                ].filter(Boolean).join(" · ") || "Not recorded"}
                {row.experience.leadershipHumanVerified ? " · Human reviewed" : ""}
              </p>
            </article>
          ))}
          {evidence.experiences.length === 0 ? <p className="text-sm text-muted-foreground">No tours recorded.</p> : null}
        </div>
        {canWriteEvidence ? (
          <ActionForm action={addMilitaryExperienceAction} className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
            <HiddenIds {...hidden} />
            <Label text="Branch">
              <select className={inputClass} name="branch" defaultValue="navy">
                <option value="army">Army</option>
                <option value="navy">Navy</option>
                <option value="air_force">Air Force</option>
                <option value="marine_corps">Marine Corps</option>
                <option value="coast_guard">Coast Guard</option>
                <option value="space_force">Space Force</option>
              </select>
            </Label>
            <Label text="MOS / Rating / AFSC code"><input className={inputClass} name="code" required /></Label>
            <Label text="Rank"><input className={inputClass} name="rank" /></Label>
            <Label text="Pay grade"><input className={inputClass} name="payGrade" /></Label>
            <Label text="Unit"><input className={inputClass} name="unit" /></Label>
            <div className="sm:col-span-2"><PrimaryButton>Add tour</PrimaryButton></div>
          </ActionForm>
        ) : null}
      </section>

      <section>
        <h2 className="section-title">Capability evidence</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Duties, equipment, training, credentials, clearance, and leadership are evidence for later translation. AI suggestions stay pending until a person reviews them.
        </p>
        <EvidenceList title="Duties" rows={evidence.duties.map((row) => ({ id: row.id, label: row.title, detail: row.description, source: row.source, humanVerified: row.humanVerified }))} />
        <EvidenceList title="Equipment and systems" rows={evidence.equipment.map((row) => ({ id: row.id, label: `${row.name} · ${formatLabel(row.kind)}`, detail: row.description, source: row.source, humanVerified: row.humanVerified }))} />
        <EvidenceList title="Training" rows={evidence.training.map((row) => ({ id: row.id, label: `${row.schoolName} · ${formatLabel(row.category)}`, detail: row.description, source: row.source, humanVerified: row.humanVerified }))} />
        <EvidenceList title="Credentials" rows={evidence.credentials.map((row) => ({ id: row.id, label: row.name, detail: row.issuer, source: row.source, humanVerified: row.humanVerified }))} />
        <div className="mt-4">
          <h3 className="text-sm font-medium text-navy">Current clearance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Current clearance is stored on the person. Pier 24 does not independently verify it. Historical tour notes stay on the tour.
          </p>
          <p className="mt-2 text-sm">
            {evidence.clearance
              ? `${formatLabel(evidence.clearance.clearanceLevel)} · ${formatLabel(evidence.clearance.clearanceStatus)} · ${evidenceReviewLabel(evidence.clearance)}`
              : "No current clearance recorded."}
          </p>
        </div>
        {canWriteEvidence && evidence.experiences[0] ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <ActionForm action={addMilitaryDutyAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <ExperienceSelect experiences={evidence.experiences} />
              <Label text="Duty"><input className={inputClass} name="title" required /></Label>
              <Label text="Description"><textarea className={inputClass} name="description" rows={3} /></Label>
              <PrimaryButton>Add duty</PrimaryButton>
            </ActionForm>
            <ActionForm action={addMilitaryEquipmentAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <ExperienceSelect experiences={evidence.experiences} />
              <Label text="Equipment or system"><input className={inputClass} name="name" required /></Label>
              <Label text="Kind">
                <select className={inputClass} name="kind" defaultValue="system">
                  <option value="platform">Platform</option>
                  <option value="system">System</option>
                  <option value="equipment">Equipment</option>
                  <option value="tool">Tool</option>
                </select>
              </Label>
              <PrimaryButton>Add equipment</PrimaryButton>
            </ActionForm>
            <ActionForm action={addMilitaryTrainingAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <ExperienceSelect experiences={evidence.experiences} />
              <Label text="School"><input className={inputClass} name="schoolName" required /></Label>
              <Label text="Category">
                <select className={inputClass} name="category" defaultValue="technical">
                  {["technical", "nuclear", "leadership", "cyber", "maintenance", "logistics", "aviation", "instructor", "other"].map((category) => (
                    <option key={category} value={category}>{formatLabel(category)}</option>
                  ))}
                </select>
              </Label>
              <PrimaryButton>Add training</PrimaryButton>
            </ActionForm>
            <ActionForm action={updateLeadershipAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <ExperienceSelect experiences={evidence.experiences} />
              <Label text="Leadership level"><input className={inputClass} name="leadershipLevel" /></Label>
              <Label text="Direct reports"><input className={inputClass} name="directReportsCount" type="number" min={0} /></Label>
              <Label text="Team size"><input className={inputClass} name="teamSize" type="number" min={0} /></Label>
              <Label text="Resource scope"><input className={inputClass} name="resourceScope" /></Label>
              <PrimaryButton>Save leadership</PrimaryButton>
            </ActionForm>
          </div>
        ) : null}
        {canWriteEvidence ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <ActionForm action={addCredentialAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <Label text="Credential"><input className={inputClass} name="name" required /></Label>
              <Label text="Issuer"><input className={inputClass} name="issuer" /></Label>
              <PrimaryButton>Add credential</PrimaryButton>
            </ActionForm>
            <ActionForm action={setClearanceAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <Label text="Clearance level">
                <select className={inputClass} name="clearanceLevel" defaultValue={evidence.clearance?.clearanceLevel ?? "unknown"}>
                  {["unknown", "none", "confidential", "secret", "top_secret", "ts_sci"].map((level) => (
                    <option key={level} value={level}>{formatLabel(level)}</option>
                  ))}
                </select>
              </Label>
              <Label text="Reported status">
                <select className={inputClass} name="clearanceStatus" defaultValue={evidence.clearance?.clearanceStatus ?? "unknown"}>
                  <option value="unknown">Unknown</option>
                  <option value="reported_active">Reported active</option>
                  <option value="reported_inactive">Reported inactive</option>
                  <option value="expired">Expired</option>
                </select>
              </Label>
              <PrimaryButton>Save current clearance</PrimaryButton>
            </ActionForm>
            <ActionForm action={addEducationAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <Label text="Institution"><input className={inputClass} name="institution" required /></Label>
              <Label text="Degree or credential"><input className={inputClass} name="degreeOrCredential" required /></Label>
              <Label text="Field of study"><input className={inputClass} name="fieldOfStudy" /></Label>
              <PrimaryButton>Add education</PrimaryButton>
            </ActionForm>
          </div>
        ) : null}
        {evidence.education.length ? (
          <ul className="mt-4 space-y-1 text-sm">
            {evidence.education.map((row) => (
              <li key={row.id}>
                {row.degreeOrCredential}
                {row.fieldOfStudy ? `, ${row.fieldOfStudy}` : ""} · {row.institution} · {evidenceReviewLabel(row)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="section-title">Civilian direction</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Fact label="Career interests" value={candidate.careerInterests} />
          <Fact label="Current priorities" value={profile.careerPriorities} />
          <Fact label="Target industry" value={profile.idealIndustry} />
          <Fact label="Target employer" value={profile.idealEmployer} />
          <Fact label="Compensation expectations" value={canReadPii ? candidate.compensationExpectations : "Hidden without candidate contact access"} />
        </dl>
        {detail.card.targetRoles.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {detail.card.targetRoles.map((role) => (
              <li key={role.id}>
                {role.roleTitle}
                {role.jobFamily ? ` · ${role.jobFamily}` : ""}
                {role.civilianOccupationId ? " · occupation linked" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No target roles yet. Titles stay free text, with an optional job family for later matching.</p>
        )}
        {canWriteProfile ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <ActionForm action={updateTransitionProfileAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <Label text="Target industry"><input className={inputClass} name="idealIndustry" /></Label>
              <Label text="Target employer"><input className={inputClass} name="idealEmployer" /></Label>
              <Label text="Current priorities"><textarea className={inputClass} name="careerPriorities" rows={3} /></Label>
              <PrimaryButton>Save civilian direction</PrimaryButton>
            </ActionForm>
            <ActionForm action={addTargetRoleAction} className="space-y-3">
              <HiddenIds {...hidden} />
              <Label text="Target role"><input className={inputClass} name="roleTitle" required /></Label>
              <Label text="Job family"><input className={inputClass} name="jobFamily" /></Label>
              <PrimaryButton>Add target role</PrimaryButton>
            </ActionForm>
          </div>
        ) : null}
        <p className="mt-3 text-sm">
          <Link className="text-navy underline" href={`/app/talent/${candidate.id}`}>Open the Talent Network record</Link>
        </p>
      </section>

      <section>
        <h2 className="section-title">Workflow</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Status" value={formatLabel(profile.candidateStatus)} />
          <Fact label="Next action" value={profile.nextAction} />
          <Fact label="Next follow-up" value={formatDate(profile.nextFollowUpAt)} />
          <Fact label="Last profile review" value={formatDate(candidate.lastProfileReviewAt)} />
          <Fact label="Resume status" value={formatLabel(profile.resumeStatus)} />
        </dl>
        {canWriteProfile ? (
          <ActionForm action={completeProfileReviewAction} className="mt-4 space-y-2">
            <HiddenIds {...hidden} />
            <p className="text-sm text-muted-foreground">Records that a person reviewed this profile. It does not submit the candidate or change matches.</p>
            <PrimaryButton>Mark profile reviewed</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>
    </div>
  );
}

function HiddenIds({ candidateId, profileId }: { candidateId: string; profileId: string }) {
  return (
    <>
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="profileId" value={profileId} />
    </>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-navy">{value || "—"}</dd>
    </div>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      {text}
      {children}
    </label>
  );
}

function ExperienceSelect({
  experiences,
}: {
  experiences: Evidence["experiences"];
}) {
  return (
    <label className="block text-sm">
      Tour
      <select className={inputClass} name="experienceId" required>
        {experiences.map((row) => (
          <option key={row.experience.id} value={row.experience.id}>
            {row.occupation.code} · {row.experience.rank || row.occupation.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function EvidenceList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; label: string; detail?: string | null; source: string; humanVerified: boolean }>;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-navy">{title}</h3>
      {rows.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">None recorded.</p> : (
        <ul className="mt-1 space-y-1 text-sm">
          {rows.map((row) => (
            <li key={row.id}>
              {row.label}
              {row.detail ? ` — ${row.detail}` : ""} · {evidenceReviewLabel(row)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
