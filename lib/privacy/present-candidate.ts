import type { candidates } from "../../db/schema";

type CandidateRow = typeof candidates.$inferSelect;

export function presentCandidate<T extends CandidateRow>(
  candidate: T,
  canReadPii: boolean,
) {
  return {
    ...candidate,
    email: canReadPii ? candidate.email : null,
    emailHidden: !canReadPii && Boolean(candidate.email),
  };
}
