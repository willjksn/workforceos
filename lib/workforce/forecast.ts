export const FORECAST_HORIZONS = [12, 24, 36] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

export type ForecastComponentInput = {
  code: string;
  label: string;
  included: boolean;
  ratePercent?: number | null;
  quantity?: number | null;
  explanation?: string | null;
};

export type DemandForecastInput = {
  currentHeadcount: number;
  vacancies: number;
  horizonMonths: number;
  components: ForecastComponentInput[];
};

export type DemandForecastResult = {
  currentRequired: number;
  growthDemand: number;
  replacementDemand: number;
  backlogDemand: number;
  expectedInternalSupply: number;
  futureDemand: number;
  includedCodes: string[];
  excludedCodes: string[];
  calculationMethod: string;
};

function yearsForHorizon(horizonMonths: number) {
  return Math.max(horizonMonths, 0) / 12;
}

function roundHeadcount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function componentValue(component: ForecastComponentInput, base: number, horizonMonths: number) {
  if (!component.included) return 0;
  if (component.quantity != null && Number.isFinite(component.quantity)) {
    return roundHeadcount(component.quantity);
  }
  const rate = Number(component.ratePercent ?? 0);
  if (!Number.isFinite(rate) || rate === 0) return 0;
  return roundHeadcount(base * (rate / 100) * yearsForHorizon(horizonMonths));
}

export function defaultForecastComponents(input: {
  attritionRatePercent?: number | null;
  retirementRatePercent?: number | null;
  growthRatePercent?: number | null;
  backlog?: number | null;
  internalMobilityRatePercent?: number | null;
}): ForecastComponentInput[] {
  return [
    {
      code: "current_required",
      label: "Current required workforce",
      included: true,
      explanation: "Current headcount plus vacancies.",
    },
    {
      code: "growth",
      label: "Growth demand",
      included: (input.growthRatePercent ?? 0) !== 0,
      ratePercent: input.growthRatePercent ?? 0,
      explanation: "Configurable growth rate applied over the forecast horizon.",
    },
    {
      code: "replacement_attrition",
      label: "Replacement from attrition",
      included: (input.attritionRatePercent ?? 0) !== 0,
      ratePercent: input.attritionRatePercent ?? 0,
      explanation: "Expected attrition replacement demand.",
    },
    {
      code: "replacement_retirement",
      label: "Replacement from retirement",
      included: (input.retirementRatePercent ?? 0) !== 0,
      ratePercent: input.retirementRatePercent ?? 0,
      explanation: "Expected retirement replacement demand.",
    },
    {
      code: "backlog",
      label: "Hiring backlog",
      included: (input.backlog ?? 0) > 0,
      quantity: input.backlog ?? 0,
      explanation: "Open vacancies or known hiring backlog.",
    },
    {
      code: "internal_supply",
      label: "Expected internal supply",
      included: (input.internalMobilityRatePercent ?? 0) !== 0,
      ratePercent: input.internalMobilityRatePercent ?? 0,
      explanation: "Internal mobility that can offset external demand.",
    },
  ];
}

export function computeDemandForecast(input: DemandForecastInput): DemandForecastResult {
  const currentRequired = roundHeadcount(input.currentHeadcount + input.vacancies);
  const byCode = Object.fromEntries(input.components.map((component) => [component.code, component]));
  const growthDemand = componentValue(byCode.growth ?? { code: "growth", label: "Growth", included: false }, input.currentHeadcount, input.horizonMonths);
  const attrition = componentValue(
    byCode.replacement_attrition ?? { code: "replacement_attrition", label: "Attrition", included: false },
    input.currentHeadcount,
    input.horizonMonths,
  );
  const retirement = componentValue(
    byCode.replacement_retirement ?? { code: "replacement_retirement", label: "Retirement", included: false },
    input.currentHeadcount,
    input.horizonMonths,
  );
  const replacementDemand = attrition + retirement;
  const backlogDemand = componentValue(
    byCode.backlog ?? { code: "backlog", label: "Backlog", included: false },
    input.currentHeadcount,
    input.horizonMonths,
  );
  const expectedInternalSupply = componentValue(
    byCode.internal_supply ?? { code: "internal_supply", label: "Internal supply", included: false },
    input.currentHeadcount,
    input.horizonMonths,
  );
  const includeCurrent = byCode.current_required?.included !== false;
  const futureDemand = roundHeadcount(
    (includeCurrent ? currentRequired : 0) + growthDemand + replacementDemand + backlogDemand - expectedInternalSupply,
  );
  return {
    currentRequired,
    growthDemand,
    replacementDemand,
    backlogDemand,
    expectedInternalSupply,
    futureDemand,
    includedCodes: input.components.filter((component) => component.included).map((component) => component.code),
    excludedCodes: input.components.filter((component) => !component.included).map((component) => component.code),
    calculationMethod:
      "Configurable planning model: future demand = current required + growth + replacement + backlog - expected internal supply. Estimates only; not a guaranteed forecast.",
  };
}

export function applyScenarioDeltas(
  components: ForecastComponentInput[],
  deltas: {
    growthDeltaPercent?: number | null;
    attritionDeltaPercent?: number | null;
    retirementDeltaPercent?: number | null;
    hiringDelta?: number | null;
    internalMobilityDeltaPercent?: number | null;
  },
): ForecastComponentInput[] {
  return components.map((component) => {
    if (component.code === "growth") {
      return {
        ...component,
        ratePercent: Number(component.ratePercent ?? 0) + Number(deltas.growthDeltaPercent ?? 0),
        included: true,
      };
    }
    if (component.code === "replacement_attrition") {
      return {
        ...component,
        ratePercent: Number(component.ratePercent ?? 0) + Number(deltas.attritionDeltaPercent ?? 0),
        included: true,
      };
    }
    if (component.code === "replacement_retirement") {
      return {
        ...component,
        ratePercent: Number(component.ratePercent ?? 0) + Number(deltas.retirementDeltaPercent ?? 0),
        included: true,
      };
    }
    if (component.code === "backlog") {
      return {
        ...component,
        quantity: Number(component.quantity ?? 0) + Number(deltas.hiringDelta ?? 0),
        included: true,
      };
    }
    if (component.code === "internal_supply") {
      return {
        ...component,
        ratePercent: Number(component.ratePercent ?? 0) + Number(deltas.internalMobilityDeltaPercent ?? 0),
        included: true,
      };
    }
    return component;
  });
}
