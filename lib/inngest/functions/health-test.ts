import { inngest } from "../client";

export const healthTest = inngest.createFunction(
  {
    id: "workforceos-health-test",
    triggers: [{ event: "workforceos/health-test" }],
  },
  async ({ event }) => {
    return {
      ok: true,
      receivedAt: new Date().toISOString(),
      eventName: event.name,
    };
  },
);
