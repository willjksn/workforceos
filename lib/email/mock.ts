import type { EmailProvider, SendResult, SendTransactionalInput } from "./types";

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";
  readonly configured = false;
  readonly sent: SendTransactionalInput[] = [];

  async sendTransactional(input: SendTransactionalInput): Promise<SendResult> {
    this.sent.push(input);
    return {
      provider: "mock",
      mock: true,
      providerMessageId: `mock-${Date.now()}-${this.sent.length}`,
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

const shared = new MockEmailProvider();

export function getSharedMockEmailProvider() {
  return shared;
}

export function resetMockEmailProvider() {
  shared.sent.length = 0;
}
