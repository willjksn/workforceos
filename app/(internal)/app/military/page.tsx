import Link from "next/link";

import { AcademyHelp } from "@/components/academy/academy-help";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import { PageHeader, PageShell } from "../_components/ui";
import { MilitarySubnav } from "./_components/military-subnav";

const STEPS = [
  ["Transitioning Service Member", "Find transitioning service members. These are Talent Network people, not a separate SkillBridge roster."],
  ["Military Talent Network", "Join or record the person on the Military Talent Network. A current opening is not required."],
  ["Transition Talent Profile", "Build the Transition Talent Profile overlay on the existing Candidate record."],
  ["Skills Translation", "Map military occupation, rank, leadership, and training to civilian value using stored, reviewed mappings."],
  ["Employer Opportunity Search / Development", "Search and develop host-company/employer opportunities. The employer is explicit."],
  ["Employer Match", "Compare the Transition Talent Profile to employer/host-company opportunities."],
  ["Employer Engagement", "Introduce qualified talent. Pier 24 Partners is the intermediary, not automatically the SkillBridge host."],
  ["Interview", "Support interviews between the service member and the employer."],
  ["SkillBridge / Direct Hire / Other Pathway", "Track SkillBridge-eligible, direct-hire, or other transition pathway decisions. Approval is never assumed."],
  ["Placement", "Record placement start with an explicit host company/employer."],
  ["Conversion", "Support conversion to full-time employment and keep the person in the Talent Network."],
] as const;

export default async function MilitaryOverviewPage() {
  await requireAnyAppPermission(["military.read", "skillbridge.read"]);
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Military talent"
        title="Military Talent operations"
        description="Pier 24 Partners is the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is a transition pathway and opportunity type — not a Pier 24 Partners-owned SkillBridge program."
        actions={<AcademyHelp articleSlug="module-military" />}
      />
      <MilitarySubnav active="/app/military" />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OverviewCard href="/app/talent?channel=military" title="Talent Network" body="The same candidate records. Military talent is a channel, not a second person." />
        <OverviewCard href="/app/military/candidates" title="Transition Talent Profiles" body="The profile extends the candidate with service, timing, and preferences." />
        <OverviewCard href="/app/military/translator" title="Capability Translation" body="The canonical translator. Crosswalk and reverse lookup stay available as specialist tools." />
        <OverviewCard href="/app/military/review" title="Mapping Review" body="Pending occupation mappings and person capabilities. The originating agent cannot approve." />
        <OverviewCard href="/app/workforce/military-supply" title="Military Supply" body="Known military people inside a workforce plan. Occupation channels are not people." />
        <OverviewCard href="/app/military/skillbridge" title="Pathway operations" body="SkillBridge windows are one pathway on the Transition Talent Profile." />
      </div>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-navy">Specialist tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">These routes stay available. They are not a second translator.</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <li><Link className="underline" href="/app/military/occupations">Occupation library</Link></li>
          <li><Link className="underline" href="/app/military/crosswalk">Crosswalk</Link></li>
          <li><Link className="underline" href="/app/military/reverse">Reverse lookup</Link></li>
          <li><Link className="underline" href="/app/military/installations">Installations</Link></li>
          <li><Link className="underline" href="/app/military/installation-mapping">Installation mapping</Link></li>
          <li><Link className="underline" href="/app/military/bridge-training">Bridge training</Link></li>
          <li><Link className="underline" href="/app/military/analytics">Analytics</Link></li>
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="section-title">Canonical flow</h2>
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
