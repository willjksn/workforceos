import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { can } from "@/lib/rbac/permissions";
import { listPublicContentItems } from "@/lib/public-content/service";
import { PUBLIC_CONTENT_TYPE_LABELS, type PublicContentType } from "@/lib/public-content/types";
import { getServerEnv } from "@/lib/env";
import { ActionForm } from "../_components/action-form";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  PageHeader,
  PageShell,
  StatusBadge,
  TabNav,
  formatDate,
  formatLabel,
} from "../_components/ui";
import { archivePublicContentAction, togglePublicContentAction } from "@/lib/actions/public-content";

const TABS: Array<{ id: string; href: string; label: string; type?: PublicContentType }> = [
  { id: "overview", href: "/app/public-content", label: "Overview" },
  { id: "featured_job", href: "/app/public-content?type=featured_job", label: "Featured jobs" },
  { id: "featured_skillbridge", href: "/app/public-content?type=featured_skillbridge", label: "SkillBridge features" },
  { id: "homepage_banner", href: "/app/public-content?type=homepage_banner", label: "Banners" },
  { id: "urgent_hiring_notice", href: "/app/public-content?type=urgent_hiring_notice", label: "Urgent notices" },
  { id: "temporary_announcement", href: "/app/public-content?type=temporary_announcement", label: "Announcements" },
  { id: "featured_industry_campaign", href: "/app/public-content?type=featured_industry_campaign", label: "Campaigns" },
];

const STATUS_TONE = {
  live: "success",
  scheduled: "navy",
  expired: "warning",
  draft: "neutral",
  inactive: "danger",
} as const;

export default async function PublicContentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const principal = await requireAppPermission("public_content.read");
  const { type } = await searchParams;
  const contentType = TABS.some((tab) => tab.type === type) ? (type as PublicContentType) : undefined;
  const rows = await listPublicContentItems({ principal, contentType });
  const live = rows.filter((row) => row.rendering);
  const env = getServerEnv();
  const publicSite = env.PUBLIC_CAREERS_URL?.replace(/\/careers$/, "") || "https://pieronepartners.com";
  const canManage = can(principal, "public_content.manage");
  const canPublish = can(principal, "public_content.publish");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Public website"
        title="Public content"
        description="Control featured jobs, hiring banners, and temporary announcements without redeploying pieronepartners.com. Stable brand copy stays in the website codebase."
        actions={
          canManage ? (
            <ButtonLink href="/app/public-content/new">New item</ButtonLink>
          ) : null
        }
      />
      <TabNav items={TABS} activeId={contentType ?? "overview"} />

      {!contentType ? (
        <section className="mt-8">
          <h2 className="section-title">Preview public placement</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Live items below are what GET /api/public/v1/content will return right now. The public site refreshes within about a minute.
          </p>
          {live.length === 0 ? (
            <EmptyState title="Nothing is live.">Create and activate an item to place it on the public site.</EmptyState>
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border bg-card">
              {live.map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-navy">{row.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {PUBLIC_CONTENT_TYPE_LABELS[row.contentType]} · {formatLabel(row.placement)}
                      {row.linkedJobSlug ? ` · /jobs/${row.linkedJobSlug}` : ""}
                    </p>
                  </div>
                  <a className="text-sm text-navy underline" href={`${publicSite}${row.placement === "careers" ? "/careers" : row.placement === "skillbridge" ? "/skillbridge" : "/"}`}>
                    Open placement
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title="No public content in this view.">
          {canManage ? "Use New item to feature a job or schedule a banner." : "You can view items once they are created."}
        </EmptyState>
      ) : (
        <DataTable columns={["Title", "Type", "Placement", "Linked job", "Schedule", "Status", ""]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/public-content/${row.id}`}>
                  {row.title}
                </Link>
              </td>
              <td>{PUBLIC_CONTENT_TYPE_LABELS[row.contentType]}</td>
              <td>{formatLabel(row.placement)}</td>
              <td>
                {row.linkedJobTitle ? (
                  <span>
                    {row.linkedJobTitle}
                    {row.linkedJobPublic ? "" : " (not public)"}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {formatDate(row.startsAt)} – {formatDate(row.endsAt)}
              </td>
              <td>
                <StatusBadge tone={STATUS_TONE[row.status]}>{row.status}</StatusBadge>
                {row.status === "live" && !row.rendering ? (
                  <span className="ml-2 text-xs text-muted-foreground">hidden (job closed)</span>
                ) : null}
              </td>
              <td>
                <div className="flex flex-wrap gap-2">
                  {canPublish ? (
                    <ActionForm action={togglePublicContentAction} className="inline">
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="isActive" value={row.isActive ? "false" : "true"} />
                      <button type="submit" className="text-sm text-navy underline">
                        {row.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </ActionForm>
                  ) : null}
                  {canManage ? (
                    <ActionForm action={archivePublicContentAction} className="inline">
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="text-sm text-muted-foreground underline">
                        Archive
                      </button>
                    </ActionForm>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </PageShell>
  );
}
