import type { EmailProvider, SendResult, SendTransactionalInput } from "./types";

export const UNCONFIGURED_EMAIL_ERROR =
  "Transactional email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL. Verify the sending domain in Resend before production mail will deliver.";

export class UnconfiguredEmailProvider implements EmailProvider {
  readonly name = "unconfigured";
  readonly configured = false;

  async sendTransactional(input?: SendTransactionalInput): Promise<SendResult> {
    void input;
    return {
      provider: "unconfigured",
      mock: false,
      providerMessageId: "",
      status: "failed",
      error: UNCONFIGURED_EMAIL_ERROR,
    };
  }

  sendTemplate(input: SendTransactionalInput) {
    return this.sendTransactional(input);
  }

  sendBatch(inputs: SendTransactionalInput[]) {
    return Promise.all(inputs.map((item) => this.sendTransactional(item)));
  }
}
