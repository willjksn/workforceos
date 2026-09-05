import { FinanceError, parseMoney } from "./money";

export type PlacementFeeTerms = {
  startingSalary?: number | string | null;
  feePercent?: number | string | null;
  feeAmount?: number | string | null;
  minimumFee?: number | string | null;
};

export type PlacementFeeResult = {
  calculated: number;
  fee: number;
  minimumFeeApplied: boolean;
  source: "negotiated_amount" | "salary_percent";
};

export function calculatePlacementFee(terms: PlacementFeeTerms): PlacementFeeResult {
  const negotiated = parseMoney(terms.feeAmount);
  const salary = parseMoney(terms.startingSalary);
  const percent = parseMoney(terms.feePercent);
  const minimum = parseMoney(terms.minimumFee);

  let calculated: number;
  let source: PlacementFeeResult["source"];
  if (negotiated != null) {
    calculated = negotiated;
    source = "negotiated_amount";
  } else if (salary != null && percent != null) {
    calculated = Math.round(salary * (percent / 100) * 100) / 100;
    source = "salary_percent";
  } else {
    throw new FinanceError("Placement fee terms must come from the search agreement");
  }

  if (minimum != null && calculated < minimum) {
    return { calculated, fee: minimum, minimumFeeApplied: true, source };
  }
  return { calculated, fee: calculated, minimumFeeApplied: false, source };
}
