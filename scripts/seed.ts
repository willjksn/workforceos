import "./load-env";

import { seedFoundation } from "../db/seed";

async function main() {
  const result = await seedFoundation();
  console.log(`Seed complete: ${result.seedVersion}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
