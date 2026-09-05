import { notFound } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { translatorView } from "@/lib/repositories/military";
import { can } from "@/lib/rbac/permissions";
import { PageHeader, PageShell, formatLabel } from "../../../_components/ui";
import { Card, StatusBadge } from "@/components/ui/display";
import { MilitarySubnav } from "../../_components/military-subnav";

export default async function MilitaryOccupationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("military.read");
  const { id } = await params;
  const view = await translatorView(id);
  if (!view) notFound();
  const canReadPii = can(principal, "candidate_pii.read");
  const { occupation } = view.bundle;
  const hm = view.hiringManager;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Occupation library"
        title={`${occupation.code} · ${occupation.title}`}
        description={`${formatLabel(occupation.branch)} · ${occupation.classificationType} · ${occupation.mappingQuality}`}
      />
      <MilitarySubnav active="/app/military/occupations" />
      <p className="mt-4 text-sm text-muted-foreground">
        Source {occupation.source ?? "not recorded"} · version {occupation.sourceVersion ?? "—"} · last verified {occupation.lastVerifiedAt?.toISOString() ?? "not verified"}
      </p>
      <Card className="mt-6">
        <p className="eyebrow">Hiring manager translation</p>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-navy">{hm.militaryExperience}</pre>
        <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">Strong alignment</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {hm.civilianTranslation.strongAlignment.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">Potential gaps</p>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {hm.civilianTranslation.potentialGaps.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-4 text-sm">Overall alignment: {hm.civilianTranslation.overallAlignment}</p>
        <p className="mt-2 text-sm text-muted-foreground">{hm.civilianTranslation.why}</p>
      </Card>
      <section className="mt-8">
        <h2 className="section-title">Civilian mappings</h2>
        {view.bundle.civilianRoles.map(({ mapping, occupation: civilian }) => (
          <article key={mapping.id} className="mt-4 rounded-[8px] border border-border p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{civilian.title}</h3>
              <StatusBadge>{formatLabel(mapping.reviewStatus)}</StatusBadge>
            </div>
            <p className="mt-2">{mapping.explanation}</p>
            <p className="mt-2 text-muted-foreground">Source {mapping.source ?? mapping.mappingQuality} · confidence {mapping.confidence ?? "—"} · origin {mapping.origin}</p>
            {mapping.gaps ? <p className="mt-1">Gaps: {mapping.gaps}</p> : null}
            {mapping.bridgeTraining ? <p className="mt-1">Bridge training: {mapping.bridgeTraining}</p> : null}
          </article>
        ))}
      </section>
      <section className="mt-8">
        <h2 className="section-title">Likely installations</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {view.bundle.installations.map(({ installation, link }) => (
            <li key={link.id}>
              {installation.name} · {installation.city ?? installation.region} · {link.presenceLevel} · review {link.reviewStatus}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="section-title">Talent Network people with this occupation</h2>
        <p className="mt-2 text-sm text-muted-foreground">These are the same candidate records used everywhere else.</p>
        <ul className="mt-3 text-sm">
          {view.bundle.talent.map(({ candidate }) => (
            <li key={candidate.id}>{presentCandidate(candidate, canReadPii).fullName}</li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
