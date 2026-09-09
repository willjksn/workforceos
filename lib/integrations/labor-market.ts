import { isBlsConfigured, isCensusConfigured } from "./credentials";
import { integrationFetch } from "./http";
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

function fixtureObservation(query: LaborMarketLookup, notes: string): LaborMarketObservation {
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
    notes,
  };
}

export class LaborMarketAdapter extends PlaceholderAdapter implements IntegrationAdapter {
  constructor(provider: LaborMarketLookup["provider"]) {
    super(provider);
  }

  private keyPresent() {
    if (this.provider === "bls") return isBlsConfigured();
    if (this.provider === "census") return isCensusConfigured();
    return false;
  }

  labeledUnconfigured(query: LaborMarketLookup): LaborMarketObservation {
    return fixtureObservation(
      query,
      `${query.provider.toUpperCase()} is not configured. This is a labeled fixture, not live labor-market intelligence.`,
    );
  }

  override async healthCheck(): Promise<IntegrationHealth> {
    const configured = this.keyPresent();
    return {
      provider: this.provider,
      configured,
      liveWired: configured,
      wiring: configured ? "live" : "mock",
      connectionHealth: configured ? "healthy" : "not_configured",
      lastSyncAt: null,
      lastError: configured
        ? null
        : `${this.provider} is not configured. Adapter and labeled fixtures only.`,
    };
  }

}

async function lookupBls(query: LaborMarketLookup): Promise<LaborMarketObservation> {
  const key = process.env.BLS_API_KEY?.trim();
  if (!key) return fixtureObservation(query, "BLS_API_KEY is unset. Labeled fixture only.");
  const seriesId = query.occupationCode || "LNS14000000";
  const response = await integrationFetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seriesid: [seriesId],
      startyear: String(new Date().getFullYear() - 1),
      endyear: String(new Date().getFullYear()),
      registrationkey: key,
    }),
  });
  if (!response.ok) {
    return {
      ...fixtureObservation(query, `BLS returned HTTP ${response.status}. Not treating this as live data.`),
      label: "not_configured",
    };
  }
  const body = (await response.json()) as {
    Results?: { series?: Array<{ data?: Array<{ year: string; period: string; value: string }> }> };
  };
  const point = body.Results?.series?.[0]?.data?.[0];
  const value = point ? Number(point.value) : null;
  return {
    provider: "bls",
    geography: query.geography,
    occupationCode: query.occupationCode ?? seriesId,
    metric: query.metric,
    value: Number.isFinite(value) ? value : null,
    asOfDate: point ? new Date(`${point.year}-01-01`) : null,
    sourceVersion: "bls-publicAPI-v2",
    isFixture: false,
    label: "sourced",
    notes: "Live BLS series observation. Not a WorkforceOS forecast.",
  };
}

async function lookupCensus(query: LaborMarketLookup): Promise<LaborMarketObservation> {
  const key = process.env.CENSUS_API_KEY?.trim();
  if (!key) return fixtureObservation(query, "CENSUS_API_KEY is unset. Labeled fixture only.");
  const url = new URL("https://api.census.gov/data/2022/acs/acs5");
  url.searchParams.set("get", "NAME,B01003_001E");
  url.searchParams.set("for", "state:*");
  url.searchParams.set("key", key);
  const response = await integrationFetch(url);
  if (!response.ok) {
    return fixtureObservation(query, `Census returned HTTP ${response.status}. Not treating this as live data.`);
  }
  const rows = (await response.json()) as Array<string[]>;
  const data = rows.slice(1);
  const match = query.geography
    ? data.find((row) => (row[0] ?? "").toLowerCase().includes(query.geography!.toLowerCase()))
    : data[0];
  const value = match ? Number(match[1]) : null;
  return {
    provider: "census",
    geography: match?.[0] ?? query.geography,
    occupationCode: query.occupationCode,
    metric: query.metric,
    value: Number.isFinite(value) ? value : null,
    asOfDate: new Date("2022-01-01"),
    sourceVersion: "census-acs5-2022",
    isFixture: false,
    label: "sourced",
    notes: "Live Census ACS observation. Not a WorkforceOS forecast.",
  };
}

export function getLaborMarketAdapters(): Record<LaborMarketLookup["provider"], LaborMarketAdapter> {
  return {
    bls: new LaborMarketAdapter("bls"),
    census: new LaborMarketAdapter("census"),
    onet: new LaborMarketAdapter("onet"),
  };
}

export async function lookupLaborMarket(query: LaborMarketLookup): Promise<LaborMarketObservation> {
  if (query.provider === "bls") return lookupBls(query);
  if (query.provider === "census") return lookupCensus(query);
  return fixtureObservation(query, "O*NET labor-market lookup stays a labeled fixture in this pass.");
}

export function presentLaborMarketValue(observation: LaborMarketObservation) {
  if (observation.isFixture || observation.label !== "sourced" || observation.value == null) {
    return {
      display: observation.label === "sourced" ? "No observation returned" : "Not configured / fixture only",
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
