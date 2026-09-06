import { getServerEnv } from "../env";
import type { EmailProvider, SendResult, SendTransactionalInput } from "./types";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly configured: boolean;
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
    this.configured = Boolean(apiKey && fromEmail);
  }

  async sendTransactional(input: SendTransactionalInput): Promise<SendResult> {
    const env = getServerEnv();
    const from = env.RESEND_FROM_EMAIL ?? this.fromEmail;
    if (!this.apiKey) {
      return {
        provider: "resend",
        mock: false,
        providerMessageId: "",
        status: "failed",
        error: "RESEND_API_KEY is not set. Transactional email cannot send.",
      };
    }
    if (!from) {
      return {
        provider: "resend",
        mock: false,
        providerMessageId: "",
        status: "failed",
        error: "RESEND_FROM_EMAIL is not set. Use a verified Resend sending address after DNS is complete.",
      };
    }
    const replyTo = input.replyTo ?? env.RESEND_REPLY_TO_EMAIL;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: replyTo,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      return {
        provider: "resend",
        mock: false,
        providerMessageId: "",
        status: "failed",
        error: payload.message ?? `Resend HTTP ${response.status}`,
      };
    }
    return {
      provider: "resend",
      mock: false,
      providerMessageId: payload.id ?? "",
      status: "sent",
    };
  }

  sendTemplate(input: SendTransactionalInput) {
    return this.sendTransactional(input);
  }

  sendBatch(inputs: SendTransactionalInput[]) {
    return Promise.all(inputs.map((item) => this.sendTransactional(item)));
  }
}
