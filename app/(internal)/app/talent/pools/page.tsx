import Link from "next/link";

import { createTalentPoolAction } from "@/lib/actions/talent";
import { ButtonLink } from "@/components/ui/button";
import { requireAppPermission } from "@/lib/auth/guard";
import { listTalentPoolSummaries } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  Card,
  CreatePanel,
  EmptyState,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  formatLabel,
  inputClassName,
} from "../../_components/ui";

export default async function TalentPoolsPage() {
  const principal = await requireAppPermission("candidates.read");
  const pools = await listTalentPoolSummaries(principal.organizationId);
  const canWrite = can(principal, "candidates.write");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Pools"
        title="Talent pools"
        description="Curated talent intelligence. Candidates stay unique and can belong to many pools."
        actions={<ButtonLink href="/app/talent">Candidates</ButtonLink>}
      />
      {pools.length === 0 ? (
        <EmptyState title="No pools recorded.">
          Create a pool when you have write access. Membership does not duplicate the candidate.
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pools.map(({ pool, memberCount }) => (
            <Link key={pool.id} href={`/app/talent/pools/${pool.id}`} className="block">
              <Card className="h-full transition-colors hover:border-teal">
                <p className="eyebrow">{formatLabel(pool.poolType)}</p>
                <p className="mt-2 font-serif text-2xl font-semibold text-navy">{pool.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {memberCount} candidate{memberCount === 1 ? "" : "s"}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {canWrite ? (
        <CreatePanel title="Create pool">
          <ActionForm action={createTalentPoolAction} className="max-w-xl space-y-3">
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
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
