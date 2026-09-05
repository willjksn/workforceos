type CandidatePiiFields = {
  email?: string | null;
  phone?: string | null;
  compensationExpectations?: string | null;
};

export function presentCandidate<T extends CandidatePiiFields>(
  candidate: T,
  canReadPii: boolean,
) {
  return {
    ...candidate,
    email: canReadPii ? candidate.email ?? null : null,
    phone: canReadPii ? candidate.phone ?? null : null,
    compensationExpectations: canReadPii ? candidate.compensationExpectations ?? null : null,
    emailHidden: !canReadPii && Boolean(candidate.email),
    phoneHidden: !canReadPii && Boolean(candidate.phone),
  };
}
