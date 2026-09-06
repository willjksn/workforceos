import { notFound } from "next/navigation";

import { requireAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { getPublicContentItem, listFeatureableJobs } from "@/lib/public-content/service";
import { PageHeader, PageShell } from "../../_components/ui";
import { PublicContentForm } from "../_components/public-content-form";

export default async function PublicContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const principal = await requireAppPermission("public_content.read");
  const { id } = await params;
  const item = await getPublicContentItem(principal, id);
  if (!item) notFound();
  const jobs = await listFeatureableJobs(principal.organizationId);
  const canManage = can(principal, "public_content.manage");
  return (
    <PageShell>
      <PageHeader
        eyebrow="Public website"
        title={item.title}
        description={`${item.status} · ${item.placement.replaceAll("_", " ")}${item.linkedJobTitle ? ` · ${item.linkedJobTitle}` : ""}`}
      />
      {canManage ? (
        <PublicContentForm
          item={item}
          jobs={jobs}
          canPublish={can(principal, "public_content.publish")}
        />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">You can view this item. Publishing changes require public_content.manage.</p>
      )}
    </PageShell>
  );
}
