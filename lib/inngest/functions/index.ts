import { runInternalTalentSearch } from "@/lib/repositories/recruiting";
import { recruitingAnalytics } from "@/lib/repositories/recruiting-delivery";

import { inngest } from "../client";
import { healthTest } from "./health-test";
import {
  apolloEnrichmentJob,
  docusignStatusJob,
  onetImportJob,
  quickbooksSyncJob,
  sourcingSyncJob,
  workspaceSyncJob,
} from "./integrations";
import { aiAutomationJob } from "./ai";
import { skillbridgeFollowUpScanJob, skillbridgeMatchJob } from "./skillbridge";

export const internalTalentSearchJob = inngest.createFunction(
  {
    id: "workforceos-internal-talent-search",
    triggers: [{ event: "workforceos/internal-talent-search" }],
  },
  async ({ event }) => {
    const data = event.data as { organizationId: string; actorUserId: string; jobId: string };
    return runInternalTalentSearch(data);
  },
);

export const stalledRecruitingAlertJob = inngest.createFunction(
  {
    id: "workforceos-stalled-recruiting-alerts",
    triggers: [{ event: "workforceos/stalled-recruiting-alerts" }],
  },
  async ({ event }) => {
    const data = event.data as { organizationId: string };
    const analytics = await recruitingAnalytics(data.organizationId);
    return { alertCount: analytics.alerts.length, codes: analytics.alerts.map((alert) => alert.code) };
  },
);

export const inngestFunctions = [
  healthTest,
  internalTalentSearchJob,
  stalledRecruitingAlertJob,
  quickbooksSyncJob,
  docusignStatusJob,
  apolloEnrichmentJob,
  onetImportJob,
  sourcingSyncJob,
  workspaceSyncJob,
  aiAutomationJob,
  skillbridgeFollowUpScanJob,
  skillbridgeMatchJob,
];
