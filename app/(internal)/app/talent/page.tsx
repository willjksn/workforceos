import Link from "next/link";

import { createCandidateAction } from "@/lib/actions/talent";
import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { searchActiveCandidates } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../_components/action-form";
import {
  CreatePanel,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  PageShell,
  PrimaryButton,
  SearchForm,
  formatLabel,
  inputClassName,
} from "../_components/ui";
import { StatusBadge } from "@/components/ui/display";
import { AcademyHelp } from "@/components/academy/academy-help";
import { ButtonLink } from "@/components/ui/button";

function availabilityTone(value: string) {
  if (value === "available_now") return "success" as const;
  if (value === "passive") return "teal" as const;
  if (value === "not_looking") return "warning" as const;
  if (value === "do_not_contact") return "danger" as const;
  return "neutral" as const;
}

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
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Candidates"
        title="Talent Network"
        description="Permanent candidate records. One person is never duplicated per job. Email is Restricted PII."
        actions={
          <>
            <AcademyHelp articleSlug="module-talent" />
            <ButtonLink href="/app/talent/pools">Pools</ButtonLink>
          </>
        }
      />
      <FilterBar>
        <SearchForm action="/app/talent" q={q} placeholder="Search name or title" className="" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No candidates match.">
          Search another name or title, or add a candidate if you have write access.
        </EmptyState>
      ) : (
        <DataTable columns={["Name", "Title", "Availability", "Email"]}>
          {rows.map((candidate) => (
            <tr key={candidate.id}>
              <td>
                <Link className="font-medium text-navy" href={`/app/talent/${candidate.id}`}>
                  {candidate.fullName}
                </Link>
              </td>
              <td>{candidate.currentTitle ?? "—"}</td>
              <td>
                <StatusBadge tone={availabilityTone(candidate.availability)}>
                  {formatLabel(candidate.availability)}
                </StatusBadge>
              </td>
              <td className="text-muted-foreground">
                {candidate.emailHidden ? "hidden" : (candidate.email ?? "—")}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {can(principal, "candidates.write") ? (
        <CreatePanel title="Add candidate">
          <ActionForm action={createCandidateAction} className="max-w-xl space-y-3">
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
        </CreatePanel>
      ) : null}
    </PageShell>
  );
}
