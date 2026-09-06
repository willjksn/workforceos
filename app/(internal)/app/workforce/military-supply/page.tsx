import { requireAppPermission } from "@/lib/auth/guard";
import { listWorkforceRoles } from "@/lib/repositories/workforce";
import { roleMilitaryOverlay } from "@/lib/workforce/engine";
import { PageHeader, PageShell, formatLabel } from "../../_components/ui";
import { WorkforceSubnav } from "../_components/workforce-subnav";

export default async function MilitarySupplyPage() {
  const principal = await requireAppPermission("workforce.read");
  const roles = await listWorkforceRoles(principal.organizationId);
  const overlays = await Promise.all(
    roles.slice(0, 8).map(async (role) => ({
      role,
      overlay: await roleMilitaryOverlay({ actor: { organizationId: principal.organizationId, userId: principal.id, roleSlugs: principal.roleSlugs }, roleId: role.id }),
    })),
  );
  return (
    <PageShell>
      <PageHeader
        eyebrow="Workforce"
        title="Military supply overlay"
        description="Uses existing military mappings. Occupations, installations, and bridge training are not duplicated here."
      />
      <WorkforceSubnav active="/app/workforce/military-supply" />
      <div className="mt-6 space-y-6">
        {overlays.map(({ role, overlay }) => (
          <section key={role.id} className="rounded-[8px] border border-card-border bg-card px-4 py-4">
            <h2 className="font-medium text-navy">{role.title}</h2>
            <p className="text-sm text-muted-foreground">{overlay.civilianTitle ?? "No civilian occupation linked"}</p>
            <ul className="mt-2 text-sm">
              {overlay.occupations.map((occupation) => (
                <li key={occupation.mappingId}>
                  {formatLabel(occupation.branch)} {occupation.code} {occupation.title} · {occupation.recruitingPriority}
                  {occupation.reviewStatus !== "approved" ? " (not for hiring-manager copy)" : ""}
                </li>
              ))}
              {overlay.occupations.length === 0 ? <li>No stored military mappings for this occupation.</li> : null}
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Installations: {overlay.installations.map((item) => `${item.name}${item.region ? `, ${item.region}` : ""}`).join("; ") || "none recorded"}
            </p>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
