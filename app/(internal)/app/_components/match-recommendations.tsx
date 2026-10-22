import Link from "next/link";

import {
  setMatchDispositionAction,
} from "@/lib/actions/opportunity-matching";
import type { MatchCard } from "@/lib/recruiting/opportunity-matching";
import { ActionForm } from "./action-form";
import { formatLabel } from "./ui";

function dispositionLabel(value: string) {
  if (value === "viable") return "Viable";
  if (value === "not_viable") return "Not viable";
  if (value === "needs_information") return "Needs more information";
  return formatLabel(value);
}

export function MatchRecommendationList({
  cards,
  canReview,
  returnPath,
  empty,
  showCandidate,
}: {
  cards: MatchCard[];
  canReview: boolean;
  returnPath: string;
  empty: string;
  showCandidate?: boolean;
}) {
  if (!cards.length) return <p className="mt-3 text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="mt-4 space-y-3">
      {cards.map((card) => (
        <article key={card.matchId} className="rounded-[8px] border border-card-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-navy">
                {showCandidate ? (
                  <Link className="underline" href={`/app/talent/${card.candidateId}`}>{card.candidateName}</Link>
                ) : (
                  <Link className="underline" href={`/app/jobs/${card.jobId}`}>{card.jobTitle}</Link>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {showCandidate ? card.jobTitle : card.companyName ?? "No company"}{" "}
                · {card.locationLabel ?? "Location not recorded"} · {card.contextLabel}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium text-navy">{card.freshness === "current" ? card.categoryLabel : "Stale"}</p>
              <p className="text-muted-foreground">{card.freshness === "current" ? "Current" : "Needs recalculation"}</p>
            </div>
          </div>
          {card.military ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {[card.military.branch ? formatLabel(card.military.branch) : null, card.military.occupation, card.military.timing]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {card.freshness === "current" ? (
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Aligned capabilities</p>
                <ul className="mt-1">{card.aligned.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Documented gaps</p>
                <ul className="mt-1">{card.gaps.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Evidence</p>
                <ul className="mt-1">{card.evidence.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">This recommendation is stale and is not shown as current.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {card.sourceUrl ? <a className="text-navy underline" href={card.sourceUrl} rel="noreferrer">Source</a> : "No public source link"}
            {card.lastEvaluatedAt ? ` · Last evaluated ${card.lastEvaluatedAt.slice(0, 10)}` : ""}
            {card.disposition ? ` · ${dispositionLabel(card.disposition)}` : ""}
          </p>
          {canReview ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["viable", "Confirm as viable"],
                ["not_viable", "Mark not viable"],
                ["needs_information", "Needs more information"],
              ] as const).map(([disposition, label]) => (
                <ActionForm key={disposition} action={setMatchDispositionAction}>
                  <input type="hidden" name="matchId" value={card.matchId} />
                  <input type="hidden" name="disposition" value={disposition} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <button className="rounded-[6px] border border-border px-2 py-1 text-xs" type="submit">{label}</button>
                </ActionForm>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
