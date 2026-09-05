import "./load-env";

import { getServerEnv } from "../lib/env";
import { seedFoundation } from "../db/seed";
import { assertDevSeedAllowed } from "../lib/seed/guards";

function refuseProductionFixtureSeed() {
  assertDevSeedAllowed();
  const env = getServerEnv();
  if (env.NEON_BRANCH === "production") {
    console.warn(
      "Warning: NEON_BRANCH=production. Development fixtures (Harbor, Taylor Ellis, Navy EM test mappings) will be written to this database. Do not use this command against a live production database. Prefer a dedicated `development` Neon branch.",
    );
  }
}

async function main() {
  refuseProductionFixtureSeed();
  const result = await seedFoundation();
  console.log(`Development seed complete: ${result.seedVersion}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
