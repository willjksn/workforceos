import { inngest } from "../client";
import { sendInterviewReminder } from "@/lib/hiring/service";

export const interviewReminderJob = inngest.createFunction(
  {
    id: "workforceos-interview-reminder",
    triggers: [{ event: "workforceos/interview-reminder" }],
  },
  async ({ event }) => {
    const data = event.data as { interviewId: string; window?: string };
    return sendInterviewReminder({ interviewId: data.interviewId, window: data.window ?? "24h" });
  },
);

export const onboardingReminderJob = inngest.createFunction(
  {
    id: "workforceos-onboarding-reminders",
    triggers: [{ cron: "TZ=America/New_York 0 8 * * *" }],
  },
  async () => {
    return { scanned: true };
  },
);

export const offerExpirationJob = inngest.createFunction(
  {
    id: "workforceos-offer-expiration",
    triggers: [{ cron: "TZ=America/New_York 0 9 * * *" }],
  },
  async () => {
    return { scanned: true };
  },
);
