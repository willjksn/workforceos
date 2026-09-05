import { createTalentPoolAction } from "@/lib/actions/talent";
import { requireAppPermission } from "@/lib/auth/guard";
import { listTalentPoolSummaries } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Field, PageHeader, PrimaryButton, inputClassName } from "../../_components/ui";

export default async function TalentPoolsPage() {
  const principal = await requireAppPermission("candidates.read");
  const pools = await listTalentPoolSummaries(principal.organizationId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow="Talent Network / Pools"
        title="Talent pools"
        description="Curated talent intelligence. Candidates stay unique and can belong to many pools."
        actions={<ButtonLink href="/app/talent">Candidates</ButtonLink>}
      />
      {pools.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No pools recorded.</p>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pools.map(({ pool, memberCount }) => (
            <a key={pool.id} href={`/app/talent/pools/${pool.id}`} className="block">
              <Card>
                <p className="font-serif text-2xl font-semibold text-navy">{pool.name}</p>
                <p className="mt-2 font-serif text-3xl font-semibold text-navy">{memberCount}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Candidates · {pool.poolType}
                </p>
              </Card>
            </a>
          ))}
        </div>
      )}
      {can(principal, "candidates.write") ? (
        <section className="mt-10">
          <h2 className="section-title">Create pool</h2>
          <ActionForm action={createTalentPoolAction} className="mt-4 max-w-xl space-y-3">
            <Field label="Name" name="name">
              <input className={inputClassName} id="name" name="name" required />
            </Field>
            <Field label="Slug" name="slug">
              <input className={inputClassName} id="slug" name="slug" required placeholder="silver-medalists" />
            </Field>
            <Field label="Description" name="description">
              <textarea className={inputClassName} id="description" name="description" rows={2} />
            </Field>
            <PrimaryButton>Create pool</PrimaryButton>
          </ActionForm>
        </section>
      ) : null}
    </main>
  );
}
