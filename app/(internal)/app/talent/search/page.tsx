import Link from "next/link";

import { requireAppPermission } from "@/lib/auth/guard";
import { presentCandidate } from "@/lib/privacy/present-candidate";
import { searchActiveCandidates } from "@/lib/repositories/talent";
import { can } from "@/lib/rbac/permissions";
import { RATE_LIMITS, RateLimitError, assertRateLimit } from "@/lib/security/rate-limit";
import {
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  SearchForm,
  ListPager,
  StatusBadge,
  formatLabel,
  inputClassName,
} from "../../_components/ui";

const AVAILABILITY = ["unknown", "available_now", "passive", "not_looking", "do_not_contact"] as const;

function availabilityTone(value: string) {
  if (value === "available_now") return "success" as const;
  if (value === "passive") return "teal" as const;
  if (value === "not_looking") return "warning" as const;
  if (value === "do_not_contact") return "danger" as const;
  return "neutral" as const;
}

export default async function TalentSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; availability?: string; page?: string }>;
}) {
  const principal = await requireAppPermission("candidates.read");
  const canReadPii = can(principal, "candidate_pii.read");
  const { q, availability, page } = await searchParams;
  if (q) {
    try {
      await assertRateLimit({ key: `search:${principal.id}`, ...RATE_LIMITS.search });
    } catch (error) {
      if (error instanceof RateLimitError) {
        return (
          <PageShell>
            <PageHeader
              eyebrow="Talent Network / Search"
              title="Talent Search"
              description="Search the internal Talent Network. Restricted PII is hidden without candidate contact access."
            />
            <EmptyState title="Too many searches.">Wait a moment and try again. Ordinary browsing is not limited.</EmptyState>
          </PageShell>
        );
      }
      throw error;
    }
  }
  const availabilityFilter = AVAILABILITY.includes(availability as (typeof AVAILABILITY)[number])
    ? (availability as (typeof AVAILABILITY)[number])
    : undefined;
  const result = await searchActiveCandidates(principal.organizationId, q, availabilityFilter, { page });
  const rows = result.items.map((candidate) => presentCandidate(candidate, canReadPii));

  return (
    <PageShell>
      <PageHeader
        eyebrow="Talent Network / Search"
        title="Talent Search"
        description="Search the internal Talent Network. Restricted PII is hidden without candidate contact access."
      />
      <FilterBar>
        <SearchForm action="/app/talent/search" q={q} placeholder="Search name or title" className="">
          <select name="availability" defaultValue={availabilityFilter ?? ""} className={`${inputClassName} max-w-xs`}>
            <option value="">Any availability</option>
            {AVAILABILITY.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </SearchForm>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No candidates match.">Try another name, title, or availability filter.</EmptyState>
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
      <ListPager
        pathname="/app/talent/search"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, availability }}
      />
    </PageShell>
  );
}
