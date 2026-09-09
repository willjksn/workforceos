import Link from "next/link";

import { updateAcademyTrainingAction } from "@/lib/actions/academy";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import {
  ACADEMY_READ_PERMISSIONS,
  ACADEMY_SECTION_LABELS,
  academyArticleHref,
  academySections,
  listTrainingProgressByUserIds,
  listUserTrainingProgress,
  requiredTrainingSlugs,
  trainingDisplayState,
  trainingModuleSlugs,
  type PersistedTrainingRow,
} from "@/lib/academy";
import { getAcademyArticle } from "@/lib/academy/catalog";
import { can } from "@/lib/rbac/permissions";
import { listOrganizationUsers } from "@/lib/repositories/platform";
import { buttonClassName } from "@/components/ui/button";
import { ActionForm } from "../_components/action-form";
import { PageHeader, PageShell, SectionHeader } from "../_components/ui";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, string> = {
  required: "Required",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  not_required: "Not Required",
};

export default async function AcademyIndexPage() {
  const principal = await requireAnyAppPermission(ACADEMY_READ_PERMISSIONS);
  const [progress, sections] = await Promise.all([listUserTrainingProgress(principal.id), Promise.resolve(academySections())]);
  const persisted = new Map(progress.map((row) => [row.moduleSlug, row.status]));
  const required = requiredTrainingSlugs(principal);
  const canViewOthers = can(principal, "admin.users");
  const others = canViewOthers ? await listOrganizationUsers(principal.organizationId) : [];
  const otherProgress: Map<string, PersistedTrainingRow[]> = canViewOthers
    ? await listTrainingProgressByUserIds(others.map((user) => user.id))
    : new Map();

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="WorkforceOS Academy"
        title="Help & Training"
        description="Approved operating knowledge for PierOne employees. Training is required from your effective access, not from job title. Completing a module does not grant permissions."
      />

      <section className="mt-8">
        <SectionHeader
          title="Your training"
          description="Required modules follow the permissions you actually have. Title on People is ignored."
        />
        <div className="overflow-x-auto rounded-[8px] border border-card-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {trainingModuleSlugs().map((slug) => {
                const article = getAcademyArticle(slug);
                const state = trainingDisplayState({
                  principal,
                  moduleSlug: slug,
                  persisted: persisted.get(slug),
                });
                return (
                  <tr key={slug} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={academyArticleHref(slug)}>
                        {article?.title ?? slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{STATE_LABEL[state]}</td>
                    <td className="px-4 py-3">
                      {state === "not_required" || state === "completed" ? (
                        <span className="text-muted-foreground">{state === "completed" ? "Done" : "—"}</span>
                      ) : (
                        <ActionForm action={updateAcademyTrainingAction} className="flex flex-wrap gap-2">
                          <input type="hidden" name="moduleSlug" value={slug} />
                          {state === "required" || state === "assigned" ? (
                            <button name="status" value="in_progress" className="text-sm text-teal underline">
                              Start
                            </button>
                          ) : null}
                          <button className={buttonClassName("primary")} name="status" value="completed" type="submit">
                            Mark complete
                          </button>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {required.length} module{required.length === 1 ? "" : "s"} required for your current access.{" "}
          <Link className="text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href="/app/academy/onboarding">
            Open staff onboarding
          </Link>
          {" — not the ATS hire queue."}
        </p>
      </section>

      {[...sections.entries()].map(([section, articles]) => (
        <section key={section} className="mt-10">
          <SectionHeader title={ACADEMY_SECTION_LABELS[section]} />
          <ul className="grid gap-3 md:grid-cols-2">
            {articles.map((article) => (
              <li key={article.slug} className="rounded-[8px] border border-card-border bg-card p-4">
                <Link className="font-medium text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={academyArticleHref(article.slug)}>
                  {article.title}
                </Link>
                <p className="mt-2 text-sm text-muted-foreground">{article.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {canViewOthers ? (
        <section className="mt-10">
          <SectionHeader
            title="People training (admin view)"
            description="Admins can view completion. They cannot complete training for someone else from this list."
          />
          <div className="overflow-x-auto rounded-[8px] border border-card-border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">Completed modules</th>
                </tr>
              </thead>
              <tbody>
                {others.map((user) => {
                  const rows = otherProgress.get(user.id) ?? [];
                  const completed = rows.filter((row) => row.status === "completed").length;
                  return (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link className="font-medium text-navy underline decoration-border underline-offset-4 hover:decoration-teal" href={`/app/admin/users/${user.id}`}>
                          {user.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{completed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
