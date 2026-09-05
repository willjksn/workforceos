import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addCandidateToPoolAction,
  addExperienceAction,
} from "@/lib/actions/talent";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { getCandidateWithRelationships, listTalentPools } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PrimaryButton, inputClassName } from "../../_components/ui";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("candidates.read");
  const { id } = await params;
  const record = await getCandidateWithRelationships(id, principal.organizationId);
  if (!record) notFound();
  const canReadPii = can(principal, "candidate_pii.read");
  const candidate = presentCandidate(record.candidate, canReadPii);
  const canWrite = can(principal, "candidates.write");
  const pools = await listTalentPools(principal.organizationId);
  const memberPoolIds = new Set(record.pools.map((row) => row.pool.id));
  const availablePools = pools.filter((pool) => !memberPoolIds.has(pool.id));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={candidate.fullName}
        description={`${candidate.currentTitle ?? "No current title"} · ${candidate.availability} · Restricted PII`}
      />
      <p className="mt-3 text-sm">
        Email: {candidate.emailHidden ? "hidden without candidate_pii.read" : (candidate.email ?? "—")}
      </p>
      <p className="mt-1 text-sm text-zinc-600">Consent: {candidate.consentStatus}</p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Experience</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {record.experiences.map((experience) => (
            <li key={experience.id}>
              <strong>{experience.title}</strong> · {experience.employer}
              {experience.summary ? ` — ${experience.summary}` : ""}
            </li>
          ))}
        </ul>
        {canWrite ? (
          <ActionForm action={addExperienceAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="candidateId" value={candidate.id} />
            <Field label="Employer" name="employer">
              <input className={inputClassName} id="employer" name="employer" required />
            </Field>
            <Field label="Title" name="title">
              <input className={inputClassName} id="title" name="title" required />
            </Field>
            <Field label="Summary" name="summary">
              <textarea className={inputClassName} id="summary" name="summary" rows={2} />
            </Field>
            <PrimaryButton>Add experience</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Skills</h2>
        <p className="mt-3 text-sm">
          {record.skills.map((row) => row.skill.name).join(", ") || "None recorded"}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Talent pools</h2>
        <p className="mt-2 text-sm text-zinc-600">
          One candidate record can belong to many pools. Membership does not create duplicates.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {record.pools.map(({ pool }) => (
            <li key={pool.id}>
              <Link className="underline" href={`/app/talent/pools/${pool.id}`}>
                {pool.name}
              </Link>
            </li>
          ))}
        </ul>
        {canWrite && availablePools.length > 0 ? (
          <ActionForm action={addCandidateToPoolAction} className="mt-4 max-w-xl space-y-3">
            <input type="hidden" name="candidateId" value={candidate.id} />
            <Field label="Add to pool" name="talentPoolId">
              <select className={inputClassName} id="talentPoolId" name="talentPoolId">
                {availablePools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </select>
            </Field>
            <PrimaryButton>Add to pool</PrimaryButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Job-specific matches</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Scores belong to a job. There is no universal candidate score.
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Job</th>
              <th>Score</th>
              <th>Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {record.matches.map(({ match, job }) => (
              <tr key={match.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/app/jobs/${job.id}`}>
                    {job.title}
                  </Link>
                </td>
                <td>{match.score}</td>
                <td>{match.pipelineStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
