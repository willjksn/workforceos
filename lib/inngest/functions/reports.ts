import { runDueReportExportJobs } from "@/lib/reporting/schedules";

import { inngest } from "../client";

export const scheduledReportExportJob = inngest.createFunction(
  {
    id: "workforceos-scheduled-report-exports",
    triggers: [{ cron: "TZ=America/New_York 15 6 * * *" }],
  },
  async () => {
    const results = await runDueReportExportJobs();
    return { ran: results.length, results };
  },
);
