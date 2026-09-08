import Link from "next/link";

import { requireAnyAppPermission } from "@/lib/auth/guard";
import { PageHeader, PageShell } from "../_components/ui";
import { MilitarySubnav } from "./_components/military-subnav";

const STEPS = [
  ["Identify", "Find transitioning service members and employer workforce needs."],
  ["Profile", "Build the Transition Talent Profile on the existing Candidate record."],
  ["Translate", "Map military occupation, rank, leadership, and training to civilian value."],
  ["Match", "Compare the profile to employer/host-company opportunities — a public job posting is not required to join the network."],
  ["Engage employer", "Introduce qualified talent. PierOne is the intermediary, not automatically the SkillBridge host."],
  ["Interview", "Support interviews between the service member and the employer."],
  ["Approval", "Track SkillBridge or direct-hire decisions where they apply. Approval is never assumed."],
  ["Place", "Record placement start with an explicit host company/employer."],
  ["Manage", "Follow the transition window, documents, and employer feedback."],
  ["Convert", "Support conversion to full-time employment and keep the person in the Talent Network."],
] as const;

export default async function MilitaryOverviewPage() {
  await requireAnyAppPermission(["military.read", "skillbridge.read"]);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Military talent"
        title="Military Talent operations"
        description="PierOne is the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is a transition pathway and opportunity type — not a PierOne-owned SkillBridge program."
      />
      <MilitarySubnav active="/app/military" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard href="/app/military/candidates" title="Transitioning Talent" body="Talent Network candidates with military experience. Same person record used in recruiting." />
        <OverviewCard href="/app/military/opportunities" title="Employer Opportunities" body="Host-company and employer matching records. PierOne facilitates; the employer is explicit." />
        <OverviewCard href="/app/military/skillbridge" title="SkillBridge" body="SkillBridge-eligible windows, approvals, placements, and conversion — one part of Military Talent operations." />
        <OverviewCard href="/app/military/translator" title="Skills Translator" body="Translate military occupations and skills into civilian workforce value." />
        <OverviewCard href="/app/military/occupations" title="Occupation Library" body="MOS, Rating, and AFSC mappings used in matching." />
        <OverviewCard href="/app/military/analytics" title="Analytics" body="Stored counts for windows, unmatched talent, placements, and conversion." />
      </div>
      <section className="mt-10">
        <h2 className="section-title">Operating workflow</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="rounded-[8px] border border-card-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                {String(index + 1).padStart(2, "0")} · {title}
              </p>
              <p className="mt-2 text-sm leading-6 text-navy">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}

function OverviewCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="rounded-[8px] border border-card-border bg-card p-5 shadow-[var(--shadow-sm)] hover:border-navy/30">
      <h2 className="font-serif text-xl text-navy">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </Link>
  );
}
