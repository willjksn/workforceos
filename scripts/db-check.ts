import "./load-env";

import { checkDatabaseConnection } from "../db";

async function main() {
  const result = await checkDatabaseConnection();
  console.log("Database connection OK");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
