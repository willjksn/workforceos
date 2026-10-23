import { requireAppPermission } from "@/lib/auth/guard";
import { OPERATIONAL_COMMANDS } from "@/lib/scout/operational-commands";
import { PageHeader, PageShell } from "../_components/ui";

export default async function ScoutPage() {
  await requireAppPermission("scout.use");
  const reads = Object.values(OPERATIONAL_COMMANDS).filter((command) => command.risk === "read" && command.id !== "ops.m6_handoff");
  const writes = Object.values(OPERATIONAL_COMMANDS).filter((command) => command.risk === "internal_write");
  return (
    <PageShell>
      <PageHeader
        eyebrow="Scout"
        title="Scout"
        description="Scout is the WorkforceOS assistant. It answers from a closed command registry and the canonical services behind M1–M7. Open Scout from the header to ask. Scout does not run SQL, browse the web, or send employer or candidate messages."
      />
      <section className="mt-8" aria-labelledby="scout-reads">
        <h2 id="scout-reads" className="text-lg font-semibold text-navy">Read commands</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {reads.map((command) => (
            <li key={command.id}>
              <span className="font-medium text-navy">{command.intent}</span>
              <span className="text-muted-foreground"> — {command.canonicalService}. Limit {command.limit}.</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8" aria-labelledby="scout-writes">
        <h2 id="scout-writes" className="text-lg font-semibold text-navy">Controlled writes</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {writes.map((command) => (
            <li key={command.id}>
              <span className="font-medium text-navy">{command.intent}</span>
              <span className="text-muted-foreground"> — confirmation required, then {command.canonicalService}.</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-8 text-sm text-muted-foreground">
        Asking Scout to email, route, or submit a person opens the follow-up workflow. It does not send anything.
      </p>
    </PageShell>
  );
}
