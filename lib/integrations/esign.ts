export type EsignResult = {
  provider: string;
  configured: boolean;
  status: "not_configured" | "created" | "sent" | "completed" | "error" | "manual";
  envelopeId?: string | null;
  error?: string | null;
};

export type EsignAdapter = {
  provider: string;
  createEnvelope(input: { contractId: string; signerEmail?: string | null; title: string }): Promise<EsignResult>;
  send(envelopeId: string): Promise<EsignResult>;
  status(envelopeId: string): Promise<EsignResult>;
  completedDocument(envelopeId: string): Promise<EsignResult>;
  auditCertificate(envelopeId: string): Promise<EsignResult>;
};

class ManualEsignAdapter implements EsignAdapter {
  provider = "manual";

  async createEnvelope(): Promise<EsignResult> {
    return { provider: this.provider, configured: true, status: "manual" };
  }
  async send(): Promise<EsignResult> {
    return { provider: this.provider, configured: true, status: "manual" };
  }
  async status(): Promise<EsignResult> {
    return { provider: this.provider, configured: true, status: "manual" };
  }
  async completedDocument(): Promise<EsignResult> {
    return { provider: this.provider, configured: true, status: "manual" };
  }
  async auditCertificate(): Promise<EsignResult> {
    return { provider: this.provider, configured: true, status: "manual" };
  }
}

class DocuSignPlaceholderAdapter implements EsignAdapter {
  provider = "docusign";

  private notConfigured(): EsignResult {
    return {
      provider: this.provider,
      configured: false,
      status: "not_configured",
      error: "DocuSign is not configured. Use manual execution.",
    };
  }

  async createEnvelope() {
    return this.notConfigured();
  }
  async send() {
    return this.notConfigured();
  }
  async status() {
    return this.notConfigured();
  }
  async completedDocument() {
    return this.notConfigured();
  }
  async auditCertificate() {
    return this.notConfigured();
  }
}

export function getEsignAdapter(): EsignAdapter {
  if (process.env.DOCUSIGN_INTEGRATION_KEY) {
    return new DocuSignPlaceholderAdapter();
  }
  return new ManualEsignAdapter();
}

export function getDocuSignAdapter(): EsignAdapter {
  return new DocuSignPlaceholderAdapter();
}
