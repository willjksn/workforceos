import Link from "next/link";

import { createCandidateAction } from "@/lib/actions/talent";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { searchActiveCandidates } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import { Field, PageHeader, PrimaryButton, SearchForm, inputClassName } from "../_components/ui";

export default async function TalentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const { q } = await searchParams;
  const rows = (await searchActiveCandidates(principal.organizationId, q)).map((candidate) =>
    presentCandidate(candidate, canReadPii),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Talent Network"
        description="Permanent candidate records. One person is never duplicated per job. Email is Restricted PII."
        actions={
          <Link className="rounded-full border px-4 py-2 text-sm" href="/app/talent/pools">
            Pools
          </Link>
        }
      />
      <SearchForm action="/app/talent" q={q} placeholder="Search name or title" />
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">No candidates match.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Name</th>
              <th>Title</th>
              <th>Availability</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((candidate) => (
              <tr key={candidate.id} className="border-b">
                <td className="py-2">
                  <Link className="underline" href={`/app/talent/${candidate.id}`}>
                    {candidate.fullName}
                  </Link>
                </td>
                <td>{candidate.currentTitle ?? "—"}</td>
                <td>{candidate.availability}</td>
                <td>
                  {candidate.emailHidden ? "hidden" : (candidate.email ?? "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {can(principal, "candidates.write") ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Add candidate</h2>
          <ActionForm action={createCandidateAction} className="mt-4 max-w-xl space-y-3">
            <Field label="Full name" name="fullName">
              <input className={inputClassName} id="fullName" name="fullName" required />
            </Field>
            <Field label="Current title" name="currentTitle">
              <input className={inputClassName} id="currentTitle" name="currentTitle" />
            </Field>
            <Field label="Email" name="email">
              <input className={inputClassName} id="email" name="email" type="email" />
            </Field>
            <Field label="Availability" name="availability">
              <select className={inputClassName} id="availability" name="availability" defaultValue="unknown">
                <option value="unknown">unknown</option>
                <option value="available_now">available_now</option>
                <option value="passive">passive</option>
                <option value="not_looking">not_looking</option>
                <option value="do_not_contact">do_not_contact</option>
              </select>
            </Field>
            <Field label="Consent" name="consentStatus">
              <select className={inputClassName} id="consentStatus" name="consentStatus" defaultValue="unknown">
                <option value="unknown">unknown</option>
                <option value="granted">granted</option>
                <option value="withdrawn">withdrawn</option>
                <option value="expired">expired</option>
              </select>
            </Field>
            <PrimaryButton>Create candidate</PrimaryButton>
          </ActionForm>
        </section>
      ) : null}
    </main>
  );
}
