import Link from "next/link";
import { notFound } from "next/navigation";

import { AcademyHelp } from "@/components/academy/academy-help";
import { requireAppPermission } from "@/lib/auth/guard";
import { getStaffOnboardingSnapshot } from "@/lib/staff-onboarding/service";
import { StaffOnboardingPanel } from "../../../../_components/staff-onboarding-panel";
import { PageHeader, PageShell } from "../../../../_components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUserOnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("admin.users");
  const { id } = await params;
  try {
    const snapshot = await getStaffOnboardingSnapshot({ actor: principal, userId: id });
    return (
      <PageShell>
        <PageHeader
          eyebrow="Admin · People"
          title={`${snapshot.user.fullName} · staff onboarding`}
          description="PierOne employee cadence. Distinct from Talent → Onboarding (ATS client hire). Title ≠ Access. Week 4 review does not grant permissions."
          actions={<AcademyHelp articleSlug="employee-onboarding" />}
          metadata={
            <p>
              <Link className="text-teal underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/admin/users/${id}`}>
                People profile
              </Link>
              {" · "}
              {snapshot.user.email}
              {snapshot.user.organizationalTitle ? ` · ${snapshot.user.organizationalTitle}` : ""}
              {` · ${snapshot.user.status}`}
            </p>
          }
        />
        <StaffOnboardingPanel snapshot={snapshot} showAdminControls />
      </PageShell>
    );
  } catch {
    notFound();
  }
}
