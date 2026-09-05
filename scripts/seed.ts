import "./load-env";

import { getServerEnv } from "../lib/env";
import { seedFoundation } from "../db/seed";

function refuseProductionFixtureSeed() {
  const env = getServerEnv();
  if (env.NODE_ENV === "production" && process.env.ALLOW_DEV_SEED !== "true") {
    throw new Error(
      "Refusing to seed development fixtures while NODE_ENV=production. Use `npm run db:seed:prod` for production-safe catalog data, or set ALLOW_DEV_SEED=true only for an isolated preview database.",
    );
  }
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
