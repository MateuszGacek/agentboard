import { createDatabaseClient } from "@agentboard/db";
import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { getOptionalDatabaseUrl, loadEnv } from "./env";

const env = loadEnv();
const databaseUrl = getOptionalDatabaseUrl();
const database = databaseUrl ? createDatabaseClient(databaseUrl) : undefined;
const app = database ? createApp({ db: database.db, env }) : createApp({ env });

const server = serve(
  {
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: env.PORT
  },
  (info) => {
    console.info(`agentboard-api listening on http://0.0.0.0:${info.port}/api`);
  }
);

function shutdown(signal: NodeJS.Signals) {
  console.info(`Received ${signal}; shutting down agentboard-api.`);
  server.close(() => {
    if (!database) {
      process.exit(0);
    }

    database.client
      .end()
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error(error);
        process.exit(1);
      });
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
