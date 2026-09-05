import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addCandidateToPoolAction,
  addExperienceAction,
} from "@/lib/actions/talent";
import { ProfileSnapshot, StatusBadge, TabNav } from "@/components/ui/display";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { getCandidateWithRelationships, listTalentPools } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, formatDate, formatLabel, inputClassName } from "../../_components/ui";

const TABS = [
  "overview",
  "experience",
  "skills",
  "pools",
  "engagement",
  "matches",
  "military",
  "privacy",
] as const;

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const principal = await requireAppPermission("candidates.read");
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = TABS.includes(tabParam as (typeof TABS)[number]) ? tabParam! : "overview";
  const record = await getCandidateWithRelationships(id, principal.organizationId);
  if (!record) notFound();
  const canReadPii = can(principal, "candidate_pii.read");
  const candidate = presentCandidate(record.candidate, canReadPii);
  const canWrite = can(principal, "candidates.write");
  const pools = await listTalentPools(principal.organizationId);
  const memberPoolIds = new Set(record.pools.map((row) => row.pool.id));
  const availablePools = pools.filter((pool) => !memberPoolIds.has(pool.id));
  const tracked = [
    candidate.currentTitle,
    candidate.city,
    candidate.yearsExperience,
    candidate.lastContactedAt,
    record.skills.length ? true : null,
    record.experiences.length ? true : null,
    candidate.availability !== "unknown" ? true : null,
  ];
  const completeness = Math.round((tracked.filter(Boolean).length / tracked.length) * 100);
  const tabs = TABS.map((item) => ({
    id: item,
    href: `/app/talent/${candidate.id}?tab=${item}`,
    label: item === "pools" ? "Talent Pools" : item === "matches" ? "Job Matches" : formatLabel(item),
  }));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Candidate profile"
        title={candidate.fullName}
        description={[candidate.currentTitle, [candidate.city, candidate.region].filter(Boolean).join(", "), candidate.yearsExperience != null ? `${candidate.yearsExperience} years` : null]
          .filter(Boolean)
          .join(" · ")}
        metadata={
          <div className="flex flex-wrap gap-2">
            {record.military.length > 0 ? <StatusBadge tone="navy">Military</StatusBadge> : null}
            <StatusBadge tone={candidate.availability === "available_now" ? "success" : "neutral"}>
              {formatLabel(candidate.availability)}
            </StatusBadge>
            {record.pools.some((row) => row.pool.slug === "silver-medalists") ? (
              <StatusBadge tone="teal">Silver Medalist</StatusBadge>
            ) : null}
          </div>
        }
      />
      <TabNav items={tabs} activeId={tab} />

      {tab === "overview" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section>
            <p className="text-sm text-muted-foreground">
              Email: {candidate.emailHidden ? "hidden without candidate_pii.read" : (candidate.email ?? "—")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Consent: {formatLabel(candidate.consentStatus)}</p>
            {record.experiences[0] ? (
              <p className="mt-6 text-sm">
                <span className="font-medium text-navy">{record.experiences[0].title}</span> · {record.experiences[0].employer}
              </p>
            ) : null}
          </section>
          <ProfileSnapshot
            items={[
              { label: "Years experience", value: candidate.yearsExperience ?? "—" },
              { label: "Skills", value: record.skills.length },
              { label: "Pools", value: record.pools.length },
              { label: "Last contact", value: formatDate(candidate.lastContactedAt) },
              { label: "Availability", value: formatLabel(candidate.availability) },
              { label: "Profile completeness", value: `${completeness}%` },
            ]}
          />
        </div>
      ) : null}

      {tab === "military" ? (
        <section className="mt-6">
          {record.military.length === 0 ? (
            <p className="text-sm text-muted-foreground">No military history recorded.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {record.military.map(({ experience, occupation }) => (
                <li key={experience.id}>
                  {can(principal, "military.read") ? (
                    <Link className="font-medium text-navy" href={`/app/military/${occupation.id}`}>
                      {occupation.branch} {occupation.code} · {occupation.title}
                    </Link>
                  ) : (
                    `${occupation.branch} ${occupation.code} · ${occupation.title}`
                  )}
                  {experience.notes ? ` — ${experience.notes}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "experience" ? (
        <section className="mt-6">
          <ul className="space-y-2 text-sm">
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
      ) : null}

      {tab === "skills" ? (
        <p className="mt-6 text-sm">{record.skills.map((row) => row.skill.name).join(", ") || "None recorded"}</p>
      ) : null}

      {tab === "pools" ? (
        <section className="mt-6">
          <p className="text-sm text-muted-foreground">
            One candidate record can belong to many pools. Membership does not create duplicates.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {record.pools.map(({ pool }) => (
              <li key={pool.id}>
                <Link className="font-medium text-navy" href={`/app/talent/pools/${pool.id}`}>
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
      ) : null}

      {tab === "engagement" ? (
        <p className="mt-6 text-sm text-muted-foreground">Not yet implemented in this phase.</p>
      ) : null}

      {tab === "matches" ? (
        <section className="mt-6">
          <p className="text-sm text-muted-foreground">Scores belong to a job. There is no universal candidate score.</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr>
                <th>Job</th>
                <th>Score</th>
                <th>Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {record.matches.map(({ match, job }) => (
                <tr key={match.id}>
                  <td>
                    <Link className="font-medium text-navy" href={`/app/jobs/${job.id}`}>
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
      ) : null}

      {tab === "privacy" ? (
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Privacy class</dt>
            <dd>{formatLabel(candidate.privacyClass)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Consent</dt>
            <dd>{formatLabel(candidate.consentStatus)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Do not contact</dt>
            <dd>{candidate.doNotContact ? "yes" : "no"}</dd>
          </div>
        </dl>
      ) : null}
    </PageShell>
  );
}
