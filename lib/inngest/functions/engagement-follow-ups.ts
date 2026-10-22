import { inngest } from "../client";
import { scanEngagementFollowUps } from "../../recruiting/opportunity-engagement";

export const engagementFollowUpScanJob = inngest.createFunction(
  {
    id: "workforceos-engagement-follow-up-scan",
    triggers: [{ event: "workforceos/engagement-follow-up-scan" }, { cron: "30 13 * * 1-5" }],
  },
  async () => scanEngagementFollowUps(),
);
