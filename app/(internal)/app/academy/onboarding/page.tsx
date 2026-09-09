import Link from "next/link";

import { AcademyHelp } from "@/components/academy/academy-help";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import { ACADEMY_READ_PERMISSIONS } from "@/lib/academy/access";
import { getStaffOnboardingSnapshot } from "@/lib/staff-onboarding/service";
import { StaffOnboardingPanel } from "../../_components/staff-onboarding-panel";
import { PageHeader, PageShell } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function AcademyStaffOnboardingPage() {
  const principal = await requireAnyAppPermission(ACADEMY_READ_PERMISSIONS);
  const snapshot = await getStaffOnboardingSnapshot({ actor: principal, userId: principal.id });

  return (
    <PageShell>
      <PageHeader
        eyebrow="WorkforceOS Academy"
        title="Employee onboarding"
        description="PierOne staff path: invite → access bundles → Day 1 checklist → required Academy → Week 4 human review. This is not the ATS hire queue at /app/onboarding. Completing training does not grant permissions."
        actions={<AcademyHelp articleSlug="employee-onboarding" />}
        metadata={
          <p>
            <Link className="text-teal underline decoration-border underline-offset-4 hover:decoration-teal" href="/app/academy">
              Help & Training
            </Link>
            {" · "}
            <Link className="text-teal underline decoration-border underline-offset-4 hover:decoration-teal" href="/app/academy/employee-onboarding">
              Academy article
            </Link>
          </p>
        }
      />
      <StaffOnboardingPanel snapshot={snapshot} showAdminControls={snapshot.canManage} />
    </PageShell>
  );
}
