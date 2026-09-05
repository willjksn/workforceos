import { buildProviderAdapters } from "./providers";

export type IntegrationHealth = {
  provider: string;
  configured: boolean;
  connectionHealth: "unknown" | "healthy" | "error" | "not_configured";
  lastSyncAt: Date | null;
  lastError: string | null;
};

export type IntegrationAdapter = {
  provider: string;
  connect(): Promise<IntegrationHealth>;
  disconnect(): Promise<IntegrationHealth>;
  healthCheck(): Promise<IntegrationHealth>;
  sync(): Promise<IntegrationHealth>;
  lookup(query: string): Promise<unknown[]>;
  importRecords(): Promise<{ imported: number }>;
  exportRecords(): Promise<{ exported: number }>;
};

export const INTEGRATION_PROVIDERS = [
  "apollo",
  "onet",
  "bls",
  "census",
  "linkedin-recruiter",
  "seekout",
  "hireez",
  "microsoft",
  "google",
  "docusign",
  "quickbooks",
  "checkr",
] as const;

export type IntegrationProviderId = (typeof INTEGRATION_PROVIDERS)[number];

export class PlaceholderAdapter implements IntegrationAdapter {
  constructor(public readonly provider: string) {}

  private status(): IntegrationHealth {
    return {
      provider: this.provider,
      configured: false,
      connectionHealth: "not_configured",
      lastSyncAt: null,
      lastError: `${this.provider} is not configured. Adapter and labeled mock/dev setup only.`,
    };
  }

  async connect() {
    return this.status();
  }

  async disconnect() {
    return this.status();
  }

  async healthCheck() {
    return this.status();
  }

  async sync() {
    return this.status();
  }

  async lookup() {
    return [];
  }

  async importRecords() {
    return { imported: 0 };
  }

  async exportRecords() {
    return { exported: 0 };
  }
}

export function getIntegrationAdapters(): IntegrationAdapter[] {
  return buildProviderAdapters();
}

export async function getIntegrationHubStatus() {
  const adapters = getIntegrationAdapters();
  return Promise.all(adapters.map((adapter) => adapter.healthCheck()));
}
