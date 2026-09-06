import { requireAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { listFeatureableJobs } from "@/lib/public-content/service";
import { PUBLIC_CONTENT_TYPES, type PublicContentType } from "@/lib/public-content/types";
import { PageHeader, PageShell } from "../../_components/ui";
import { PublicContentForm } from "../_components/public-content-form";

export default async function NewPublicContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const principal = await requireAppPermission("public_content.manage");
  const { type } = await searchParams;
  const defaultType = PUBLIC_CONTENT_TYPES.includes(type as PublicContentType) ? (type as PublicContentType) : undefined;
  const jobs = await listFeatureableJobs(principal.organizationId);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Public website"
        title="New public content"
        description="Drafts do not appear on pieronepartners.com until they are active and inside their date window."
      />
      <PublicContentForm
        jobs={jobs}
        defaultType={defaultType}
        canPublish={can(principal, "public_content.publish")}
      />
    </PageShell>
  );
}
