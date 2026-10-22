/** Vendor-neutral employer job discovered from a public career source. */
export type NormalizedEmployerJob = {
  externalKey: string;
  title: string;
  location: string | null;
  description: string | null;
  sourceUrl: string;
  department: string | null;
  employmentType: string | null;
  workplaceType: string | null;
  publicSalaryText: string | null;
  compensationMin: string | null;
  compensationMax: string | null;
  qualifications: string | null;
  certifications: string | null;
  education: string | null;
  experience: string | null;
  /** CSV row said the posting is closed. Absence from a feed is handled separately. */
  explicitlyClosed?: boolean;
};

export type CareerSourceCategory = "public_careers_page" | "feed" | "employer_api" | "manual_url" | "csv";

export type SourceAccessState = "supported_structured" | "supported_public" | "manual_only" | "blocked" | "error";

export type CareerSourceHealthState = "not_yet_synced" | "live" | "manual" | "error" | "blocked";

export type CareerSourceConfig = {
  sourceType: CareerSourceCategory;
  adapterKey?: string | null;
  careersUrl?: string | null;
  baseUrl?: string | null;
  active?: boolean;
};

export type DiscoveryDeps = {
  fetchImpl?: typeof fetch;
  lookup?: (hostname: string) => Promise<string[]>;
  minIntervalMs?: number;
};

export type DiscoverResult = {
  ok: boolean;
  blocked: boolean;
  complete: boolean;
  jobs: NormalizedEmployerJob[];
  errors: { externalKey: string | null; message: string }[];
  discoveredCount: number;
  error: string | null;
};

export const GREENHOUSE_ADAPTER_KEY = "greenhouse_public_board";
export const DISCOVERY_USER_AGENT = "WorkforceOS-OpportunityDiscovery/1.0";
export const MAX_DISCOVERED_JOBS = 100;
export const MAX_RESPONSE_BYTES = 2_000_000;
export const MAX_REDIRECTS = 3;
