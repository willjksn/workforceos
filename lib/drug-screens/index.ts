import { isDrugScreenConfigured } from "../integrations/credentials";

export type DrugScreenOrder = {
  provider: string;
  mock: boolean;
  orderId: string;
};

export interface DrugScreenProvider {
  readonly name: string;
  readonly configured: boolean;
  createOrder(input: { candidateId: string }): Promise<DrugScreenOrder>;
  getStatus(orderId: string): Promise<{ status: string }>;
  cancelOrder(orderId: string): Promise<{ status: "cancelled" }>;
  handleWebhook(payload: unknown): Promise<{ ok: true }>;
}

export class ManualDrugScreenProvider implements DrugScreenProvider {
  readonly name = "manual";
  readonly configured = false;

  async createOrder(input: { candidateId: string }): Promise<DrugScreenOrder> {
    return { provider: "manual", mock: true, orderId: `drug-${input.candidateId}-${Date.now()}` };
  }

  async getStatus() {
    return { status: "ordered" };
  }

  async cancelOrder() {
    return { status: "cancelled" as const };
  }

  async handleWebhook() {
    return { ok: true as const };
  }
}

export function getDrugScreenProvider(): DrugScreenProvider {
  if (isDrugScreenConfigured() && process.env.NODE_ENV !== "test") {
    return new ManualDrugScreenProvider();
  }
  return new ManualDrugScreenProvider();
}

export function drugScreenProviderStatus() {
  return {
    provider: process.env.DRUG_SCREEN_PROVIDER ?? "none",
    configured: isDrugScreenConfigured(),
  };
}
