import { inngest } from "../client";
import { dispatchOperatingEvent } from "@/lib/ai/automation";
import { ROLE_PERMISSIONS } from "@/lib/rbac/permissions";

function systemActor(organizationId: string, userId: string) {
  return {
    organizationId,
    userId,
    roleSlugs: ["managing-partner"] as string[],
    permissions: new Set(ROLE_PERMISSIONS["managing-partner"]),
  };
}

export const aiAutomationJob = inngest.createFunction(
  {
    id: "workforceos-ai-automation",
    triggers: [{ event: "workforceos/ai-automation" }],
  },
  async ({ event }) => {
    const data = event.data as {
      organizationId: string;
      actorUserId: string;
      eventName: string;
      recordType?: string;
      recordId?: string;
      payload?: Record<string, unknown>;
    };
    return dispatchOperatingEvent({
      actor: systemActor(data.organizationId, data.actorUserId),
      eventName: data.eventName,
      recordType: data.recordType,
      recordId: data.recordId,
      payload: data.payload,
    });
  },
);
