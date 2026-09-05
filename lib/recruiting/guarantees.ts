export function addUtcDays(start: Date, days: number) {
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

export function guaranteeDates(startDate: Date, guaranteeDays: number) {
  if (!Number.isInteger(guaranteeDays) || guaranteeDays <= 0) {
    throw new Error("Guarantee days must come from the search agreement and be a positive integer");
  }
  const startsOn = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  return {
    startsOn,
    endsOn: addUtcDays(startsOn, guaranteeDays),
    guaranteeDays,
  };
}

export function guaranteeStatusOn(endsOn: Date, now = new Date(), warningDays = 14) {
  const end = new Date(Date.UTC(endsOn.getUTCFullYear(), endsOn.getUTCMonth(), endsOn.getUTCDate()));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (today > end) return "completed" as const;
  const warning = addUtcDays(today, warningDays);
  if (warning >= end) return "expiring_soon" as const;
  return "active" as const;
}

export type PlacementFeeInput = {
  startingSalary?: number | null;
  feePercent?: number | null;
  feeAmount?: number | null;
};

export function placementFeeFromTerms(input: PlacementFeeInput) {
  if (input.feeAmount != null) return input.feeAmount;
  if (input.startingSalary != null && input.feePercent != null) {
    return Math.round(input.startingSalary * (input.feePercent / 100) * 100) / 100;
  }
  return null;
}
