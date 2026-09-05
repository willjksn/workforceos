import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { getMilitaryOccupationById } from "@/lib/repositories/military";
import { can } from "@/lib/rbac/permissions";
import { PageHeader } from "../../_components/ui";

export default async function MilitaryOccupationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("military.read");
  const { id } = await params;
  const bundle = await getMilitaryOccupationById(id);
  if (!bundle) notFound();
  const canReadPii = can(principal, "candidate_pii.read");
  const { occupation } = bundle;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={`${occupation.code} · ${occupation.title}`}
        description={`${occupation.branch} · ${occupation.classificationType} · mapping quality ${occupation.mappingQuality}`}
        actions={
          <Link className="rounded-full border px-4 py-2 text-sm" href="/app/military">
            All occupations
          </Link>
        }
      />
      {occupation.description ? (
        <p className="mt-3 text-sm text-zinc-600">{occupation.description}</p>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Skills</h2>
        <p className="mt-3 text-sm">
          {bundle.skills.map((skill) => skill.name).join(", ") || "None recorded"}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Civilian mappings</h2>
        <p className="mt-2 text-sm text-zinc-600">
          One military occupation can map to multiple civilian roles, with skills, gaps, and bridge training.
        </p>
        {bundle.civilianRoles.map(({ mapping, occupation: civilian }) => (
          <article key={mapping.id} className="mt-4 rounded border p-4 text-sm">
            <h3 className="font-medium">
              {civilian.title}
              {civilian.code ? ` (${civilian.code})` : ""}
            </h3>
            {mapping.explanation ? <p className="mt-2">{mapping.explanation}</p> : null}
            {mapping.skillsSummary ? (
              <p className="mt-2 text-zinc-600">Skills: {mapping.skillsSummary}</p>
            ) : null}
            {mapping.certifications ? (
              <p className="mt-1 text-zinc-600">Certifications: {mapping.certifications}</p>
            ) : null}
            {mapping.gaps ? <p className="mt-1 text-zinc-600">Gaps: {mapping.gaps}</p> : null}
            {mapping.bridgeTraining ? (
              <p className="mt-1 text-zinc-600">Bridge training: {mapping.bridgeTraining}</p>
            ) : null}
          </article>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Likely installations</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {bundle.installations.map(({ installation, link }) => (
            <li key={link.id}>
              {installation.name}
              {installation.region ? ` · ${installation.region}` : ""} · presence {link.presenceLevel}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Talent Network</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Candidates stay unique. Military history is linked, not copied per requisition.
        </p>
        {bundle.talent.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">No candidates recorded against this occupation.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {bundle.talent.map(({ candidate, experience }) => {
              const presented = presentCandidate(candidate, canReadPii);
              return (
                <li key={experience.id}>
                  {can(principal, "candidates.read") ? (
                    <Link className="underline" href={`/app/talent/${candidate.id}`}>
                      {presented.fullName}
                    </Link>
                  ) : (
                    presented.fullName
                  )}
                  {experience.notes ? ` — ${experience.notes}` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
