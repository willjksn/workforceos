import "./load-env";

import { inngest } from "../lib/inngest/client";

async function main() {
  const result = await inngest.send({
    name: "workforceos/health-test",
    data: { source: "local-script" },
  });
  console.log("Sent workforceos/health-test", result);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
