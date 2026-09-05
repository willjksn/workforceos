import { PlaceholderAdapter, type IntegrationAdapter, type IntegrationHealth } from "./hub";

export type LaborMarketLookup = {
  provider: "bls" | "census" | "onet";
  geography?: string;
  occupationCode?: string;
  metric: string;
};

export type LaborMarketObservation = {
  provider: LaborMarketLookup["provider"];
  geography?: string;
  occupationCode?: string;
  metric: string;
  value: number | null;
  asOfDate: Date | null;
  sourceVersion: string | null;
  isFixture: boolean;
  label: "not_configured" | "fixture" | "sourced";
  notes: string;
};

export class LaborMarketAdapter extends PlaceholderAdapter implements IntegrationAdapter {
  constructor(provider: LaborMarketLookup["provider"]) {
    super(provider);
  }

  labeledUnconfigured(query: LaborMarketLookup): LaborMarketObservation {
    return {
      provider: query.provider,
      geography: query.geography,
      occupationCode: query.occupationCode,
      metric: query.metric,
      value: null,
      asOfDate: null,
      sourceVersion: null,
      isFixture: true,
      label: "not_configured",
      notes: `${query.provider.toUpperCase()} is not configured. This is not live labor-market intelligence.`,
    };
  }
}

export function getLaborMarketAdapters(): Record<LaborMarketLookup["provider"], LaborMarketAdapter> {
  return {
    bls: new LaborMarketAdapter("bls"),
    census: new LaborMarketAdapter("census"),
    onet: new LaborMarketAdapter("onet"),
  };
}

export async function lookupLaborMarket(query: LaborMarketLookup): Promise<LaborMarketObservation> {
  const adapter = getLaborMarketAdapters()[query.provider];
  const health: IntegrationHealth = await adapter.healthCheck();
  if (!health.configured) {
    return adapter.labeledUnconfigured(query);
  }
  const rows = (await adapter.lookup()) as LaborMarketObservation[];
  return (
    rows[0] ?? {
      ...adapter.labeledUnconfigured(query),
      label: "sourced",
      isFixture: false,
      notes: "No observation returned.",
    }
  );
}

export function presentLaborMarketValue(observation: LaborMarketObservation) {
  if (observation.isFixture || observation.label !== "sourced" || observation.value == null) {
    return {
      display: "Not configured / fixture only",
      certain: false,
      isFixture: true,
    };
  }
  return {
    display: String(observation.value),
    certain: false,
    isFixture: false,
  };
}
