import Link from "next/link";
import { notFound } from "next/navigation";

import { updateAcademyTrainingAction } from "@/lib/actions/academy";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import { ACADEMY_READ_PERMISSIONS, ACADEMY_SECTION_LABELS, academyArticleHref } from "@/lib/academy";
import { getAcademyArticle } from "@/lib/academy/catalog";
import { listUserTrainingProgress, upsertTrainingProgress } from "@/lib/academy/progress";
import { isTrainingModuleSlug, isTrainingRequired, trainingDisplayState } from "@/lib/academy/training";
import { buttonClassName } from "@/components/ui/button";
import { ActionForm } from "../../_components/action-form";
import { PageHeader, PageShell } from "../../_components/ui";

export const dynamic = "force-dynamic";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="section-title">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-6 text-navy">{children}</div>
    </section>
  );
}

export default async function AcademyArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const principal = await requireAnyAppPermission(ACADEMY_READ_PERMISSIONS);
  const { slug } = await params;
  const article = getAcademyArticle(slug);
  if (!article) notFound();

  const progress = isTrainingModuleSlug(slug)
    ? (await listUserTrainingProgress(principal.id)).find((row) => row.moduleSlug === slug)
    : undefined;
  if (isTrainingModuleSlug(slug) && isTrainingRequired(principal, slug) && progress?.status !== "completed") {
    await upsertTrainingProgress({ userId: principal.id, moduleSlug: slug, status: "in_progress" });
  }
  const state = isTrainingModuleSlug(slug)
    ? trainingDisplayState({
        principal,
        moduleSlug: slug,
        persisted: progress?.status === "completed" ? "completed" : progress ? "in_progress" : null,
      })
    : null;

  return (
    <PageShell>
      <p className="text-sm">
        <Link className="text-teal underline decoration-border underline-offset-4 hover:decoration-teal" href="/app/academy">
          Help & Training
        </Link>
        <span className="text-muted-foreground"> · {ACADEMY_SECTION_LABELS[article.section]}</span>
      </p>
      <PageHeader
        eyebrow="WorkforceOS Academy"
        title={article.title}
        description={article.summary}
        actions={
          state && state !== "not_required" && state !== "completed" ? (
            <ActionForm action={updateAcademyTrainingAction}>
              <input type="hidden" name="moduleSlug" value={slug} />
              <button className={buttonClassName("primary")} name="status" value="completed" type="submit">
                Mark complete
              </button>
            </ActionForm>
          ) : state === "completed" ? (
            <p className="text-sm text-muted-foreground">Completed</p>
          ) : undefined
        }
      />

      <Block title="Purpose">{article.purpose}</Block>
      <Block title="When to Use It">{article.whenToUse}</Block>
      <Block title="Who Uses It">{article.whoUsesIt}</Block>
      <Block title="Access Required">
        <p>{article.accessRequired.join(", ") || "Signed-in employee (knowledge.read or scout.use)."}</p>
        <p className="text-muted-foreground">
          Required training uses effective permissions. Organizational title is never an input.
        </p>
      </Block>
      <Block title="Screen Overview">
        <ul className="list-disc pl-5">
          {article.screenOverview.map((screen) => (
            <li key={screen.href}>
              <Link className="text-teal underline decoration-border underline-offset-4 hover:decoration-teal" href={screen.href}>
                {screen.label}
              </Link>
              <span className="text-muted-foreground"> · {screen.href}</span>
              {screen.note ? <span className="text-muted-foreground"> — {screen.note}</span> : null}
            </li>
          ))}
        </ul>
      </Block>
      {article.fields?.length ? (
        <Block title="Fields">
          <ul className="list-disc pl-5">
            {article.fields.map((field) => (
              <li key={field.name}>
                <span className="font-medium">{field.name}</span>
                <span className="text-muted-foreground"> — {field.notes}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
      <Block title="Step-by-Step">
        <ol className="list-decimal space-y-2 pl-5">
          {article.stepByStep.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Block>
      <Block title="Scout Commands">
        <p>{article.scoutCommands.join(" · ")}</p>
        <p className="text-muted-foreground">Closed registry only. Scout never generates SQL and cannot send externally yet.</p>
      </Block>
      <Block title="Approval Requirements">{article.approvalRequirements}</Block>
      <Block title="Related Modules">
        <ul className="list-disc pl-5">
          {article.relatedSlugs.map((related) => (
            <li key={related}>
              <Link className="text-teal underline decoration-border underline-offset-4 hover:decoration-teal" href={academyArticleHref(related)}>
                {getAcademyArticle(related)?.title ?? related}
              </Link>
            </li>
          ))}
        </ul>
      </Block>
      <Block title="Common Mistakes">
        <ul className="list-disc pl-5">
          {article.commonMistakes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Block>
      <Block title="Troubleshooting">
        <ul className="list-disc pl-5">
          {article.troubleshooting.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Block>
      <Block title="Approved sources">
        <ul className="list-disc pl-5">
          {article.sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      </Block>
    </PageShell>
  );
}
