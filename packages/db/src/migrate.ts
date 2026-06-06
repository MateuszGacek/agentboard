import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";

import { createDatabaseClient } from "./client";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

async function main() {
  const { client, db } = createDatabaseClient();

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
