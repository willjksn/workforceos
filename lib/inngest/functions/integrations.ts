import { inngest } from "../client";
import { getApolloAdapter, getOnetAdapter, getQuickBooksAdapter } from "@/lib/integrations/providers";
import { logIntegrationEvent } from "@/lib/integrations/retry";
import { applyDocuSignStatus } from "@/lib/integrations/webhooks";

export const quickbooksSyncJob = inngest.createFunction(
  {
    id: "workforceos-quickbooks-sync",
    triggers: [{ event: "workforceos/quickbooks.sync" }],
  },
  async ({ event }) => {
    const data = event.data as { organizationId: string; invoiceId?: string; invoiceNumber?: string; amount?: string };
    const adapter = getQuickBooksAdapter();
    if (data.invoiceId && data.invoiceNumber && data.amount) {
      await adapter.mockExportInvoice({
        organizationId: data.organizationId,
        invoiceId: data.invoiceId,
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
      });
    }
    return adapter.healthCheck();
  },
);

export const docusignStatusJob = inngest.createFunction(
  {
    id: "workforceos-docusign-status",
    triggers: [{ event: "workforceos/docusign.status" }],
  },
  async ({ event }) => {
    const data = event.data as {
      organizationId: string;
      envelopeId: string;
      status: string;
      confirmed?: boolean;
      completedDocumentKey?: string;
    };
    if (!data.confirmed) {
      await logIntegrationEvent({
        organizationId: data.organizationId,
        provider: "docusign",
        action: "status.poll",
        status: "ignored",
        detail: "Unconfirmed DocuSign status was not applied.",
      });
      return { applied: false };
    }
    return applyDocuSignStatus({
      organizationId: data.organizationId,
      envelopeId: data.envelopeId,
      status: data.status,
      completedDocumentKey: data.completedDocumentKey,
      confirmed: true,
    });
  },
);

export const apolloEnrichmentJob = inngest.createFunction(
  {
    id: "workforceos-apollo-enrichment",
    triggers: [{ event: "workforceos/apollo.enrich" }],
  },
  async ({ event }) => {
    const data = event.data as {
      organizationId: string;
      companyId: string;
      proposed: Record<string, unknown>;
    };
    return getApolloAdapter().proposeCompanyEnrichment({
      organizationId: data.organizationId,
      companyId: data.companyId,
      proposed: data.proposed,
    });
  },
);

export const onetImportJob = inngest.createFunction(
  {
    id: "workforceos-onet-import",
    triggers: [{ event: "workforceos/onet.import" }],
  },
  async ({ event }) => {
    const data = event.data as {
      organizationId: string;
      sourceVersion: string;
      records: Array<{ onetCode: string; title: string }>;
    };
    return getOnetAdapter().importCatalog({
      organizationId: data.organizationId,
      sourceVersion: data.sourceVersion,
      records: data.records,
    });
  },
);

export const sourcingSyncJob = inngest.createFunction(
  {
    id: "workforceos-sourcing-sync",
    triggers: [{ event: "workforceos/sourcing.sync" }],
  },
  async ({ event }) => {
    const data = event.data as { organizationId: string; provider?: string };
    await logIntegrationEvent({
      organizationId: data.organizationId,
      provider: data.provider ?? "seekout",
      action: "sourcing.sync",
      status: "dev_mock",
      detail: "External sourcing sync stored as an integration event. Internal Talent Network remains first.",
    });
    return { ok: true };
  },
);

export const workspaceSyncJob = inngest.createFunction(
  {
    id: "workforceos-workspace-sync",
    triggers: [{ event: "workforceos/workspace.sync" }],
  },
  async ({ event }) => {
    const data = event.data as { organizationId: string; provider?: "microsoft" | "google" };
    await logIntegrationEvent({
      organizationId: data.organizationId,
      provider: data.provider ?? "microsoft",
      action: "workspace.sync",
      status: "dev_mock",
      detail: "Workspace references only. WorkforceOS does not duplicate Outlook or Gmail.",
    });
    return { ok: true };
  },
);
