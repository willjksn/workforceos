import "./load-env";

import { seedProductionSafe } from "../db/seed";

async function main() {
  console.log(
    "Seeding production-safe catalog only: organization, roles, permissions, approved agent registry, launch services, locked requirements, SkillBridge alert-rule defaults, and decision log.",
  );
  console.log("Not inserting fake companies, candidates, jobs, placements, users, or military development mappings.");
  const result = await seedProductionSafe();
  console.log(`Production-safe seed complete: ${result.seedVersion}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
