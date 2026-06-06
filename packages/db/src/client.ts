import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export const requiredDatabaseUrlMessage =
  "DATABASE_URL is required for database migrations and seed scripts.\n" +
  "Copy .env.example to .env and set DATABASE_URL before running this command.";

export function getRequiredDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(requiredDatabaseUrlMessage);
  }

  return databaseUrl;
}

export function createDatabaseClient(databaseUrl = getRequiredDatabaseUrl()) {
  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false
  });
  const db = drizzle(client, { schema });

  return { client, db };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>["db"];
