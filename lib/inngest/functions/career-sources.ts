import { runScheduledCareerSourceSyncs } from "@/lib/recruiting/opportunity-discovery";

import { inngest } from "../client";

/** One daily pass over active Greenhouse sources. Manual sync stays available. This does not poll. */
export const careerSourceDailySyncJob = inngest.createFunction(
  {
    id: "workforceos-career-source-daily-sync",
    triggers: [{ cron: "TZ=America/New_York 0 6 * * *" }],
  },
  async () => {
    const results = await runScheduledCareerSourceSyncs();
    return {
      ran: results.length,
      failed: results.filter((result) => result.outcome === "failed").length,
    };
  },
);
