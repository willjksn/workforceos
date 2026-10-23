import Link from "next/link";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { moreGroupsForPrincipal } from "@/components/navigation/nav-config";
import { PageHeader, PageShell } from "../_components/ui";

export default async function MorePage() {
  const principal = await requireCurrentPrincipal();
  const groups = moreGroupsForPrincipal(principal);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Work"
        title="More"
        description="Lower-frequency modules stay here. CRM opportunities are commercial pursuits. Jobs, under the Jobs destination, are employer demand."
      />
      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No additional modules are available for your access bundles.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`more-${group.label}`}>
              <h2 id={`more-${group.label}`} className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link className="font-medium text-navy underline" href={item.href} title={item.title}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
