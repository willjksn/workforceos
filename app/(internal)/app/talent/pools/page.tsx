import Link from "next/link";

import { createTalentPoolAction } from "@/lib/actions/talent";
import { requireAppPermission } from "@/lib/auth/guard";
import { listTalentPools } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import { Field, PageHeader, PrimaryButton, inputClassName } from "../../_components/ui";

export default async function TalentPoolsPage() {
  const principal = await requireAppPermission("candidates.read");
  const pools = await listTalentPools(principal.organizationId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Talent pools"
        description="Static or dynamic groups. Candidates stay unique and can belong to many pools."
        actions={
          <Link className="rounded-full border px-4 py-2 text-sm" href="/app/talent">
            Candidates
          </Link>
        }
      />
      <ul className="mt-6 space-y-2 text-sm">
        {pools.map((pool) => (
          <li key={pool.id}>
            <Link className="underline" href={`/app/talent/pools/${pool.id}`}>
              {pool.name}
            </Link>{" "}
            · {pool.poolType} · {pool.slug}
          </li>
        ))}
      </ul>
      {can(principal, "candidates.write") ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Create pool</h2>
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
