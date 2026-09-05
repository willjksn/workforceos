export function toNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pricingOutsideRange(input: {
  price: string | number | null | undefined;
  minPrice?: string | number | null;
  maxPrice?: string | number | null;
}) {
  const price = toNumber(input.price);
  if (price == null) return false;
  const min = toNumber(input.minPrice);
  const max = toNumber(input.maxPrice);
  if (min != null && price < min) return true;
  if (max != null && price > max) return true;
  return false;
}

export function assertPricingApproved(input: {
  price: string | number | null | undefined;
  minPrice?: string | number | null;
  maxPrice?: string | number | null;
  overrideReason?: string | null;
  pricingApprovedByUserId?: string | null;
}) {
  if (!pricingOutsideRange(input)) return;
  if (!input.overrideReason?.trim() || !input.pricingApprovedByUserId) {
    throw new Error(
      "Pricing outside the configured range requires approval, an override reason, and an approver",
    );
  }
}

export function describePricingModel(model: string | null | undefined) {
  switch (model) {
    case "percentage_fee":
      return "Percentage-based search fee with a minimum fee";
    case "monthly_recurring":
      return "Monthly recurring engagement fee";
    case "fixed_project":
      return "Fixed project fee";
    default:
      return "Pricing model is defined on the approved service version";
  }
}
