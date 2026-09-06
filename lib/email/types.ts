export type TransactionalEmailTemplate =
  | "application_received"
  | "interview_invitation"
  | "interview_confirmation"
  | "interview_reminder"
  | "interview_rescheduled"
  | "interview_cancelled"
  | "resume_request"
  | "application_update"
  | "background_check_next_step"
  | "drug_screen_next_step"
  | "offer_available"
  | "onboarding_welcome"
  | "onboarding_reminder"
  | "start_date_reminder";

export type SendTransactionalInput = {
  organizationId: string;
  to: string;
  template: TransactionalEmailTemplate;
  subject: string;
  html: string;
  text?: string;
  entityType?: string;
  entityId?: string;
  replyTo?: string;
};

export type SendResult = {
  provider: string;
  mock: boolean;
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
  error?: string;
};

export interface EmailProvider {
  readonly name: string;
  readonly configured: boolean;
  sendTransactional(input: SendTransactionalInput): Promise<SendResult>;
  sendTemplate(input: SendTransactionalInput): Promise<SendResult>;
  sendBatch(inputs: SendTransactionalInput[]): Promise<SendResult[]>;
}
