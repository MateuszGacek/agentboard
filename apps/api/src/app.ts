import type { DatabaseClient } from "@agentboard/db";
import type { HealthResponse } from "@agentboard/shared";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ApiEnv } from "./env";
import { isProduction } from "./env";
import { serviceUnavailable, notFound } from "./lib/errors";
import { errorResponse } from "./lib/responses";
import { requestLogger } from "./middleware/logger";
import { requestIdMiddleware } from "./middleware/request-id";
import { createAiSuggestionRoutes } from "./modules/ai/routes";
import { createAuthRoutes } from "./modules/auth/routes";
import { createBoardRoutes } from "./modules/boards/routes";
import { createTaskRoutes } from "./modules/tasks/routes";
import { createWorkspaceRoutes } from "./modules/workspaces/routes";
import type { AppBindings } from "./types";

type CreateAppOptions = {
  db?: DatabaseClient;
  env?: ApiEnv;
};

function databaseUnavailableMessage() {
  return "Database connection is not configured for this API route.";
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<AppBindings>();
  const api = new Hono<AppBindings>();
  const env = options.env;

  app.use("*", requestIdMiddleware());
  app.use("*", requestLogger());

  if (env && !isProduction(env)) {
    app.use(
      "/api/*",
      cors({
        origin: env.APP_URL,
        credentials: true,
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["content-type", "x-request-id"]
      })
    );
  }

  api.get("/health", (c) => {
    const payload: HealthResponse = {
      ok: true,
      service: "agentboard-api",
      timestamp: new Date().toISOString()
    };

    return c.json(payload);
  });

  if (options.db && env) {
    api.route("/auth", createAuthRoutes(options.db, env));
    api.route("/ai-suggestions", createAiSuggestionRoutes(options.db));
    api.route("/boards", createBoardRoutes(options.db));
    api.route("/tasks", createTaskRoutes(options.db, env));
    api.route("/workspaces", createWorkspaceRoutes(options.db));
  } else {
    api.all("/auth/*", () => {
      throw serviceUnavailable(databaseUnavailableMessage());
    });
    api.all("/boards/*", () => {
      throw serviceUnavailable(databaseUnavailableMessage());
    });
    api.all("/ai-suggestions/*", () => {
      throw serviceUnavailable(databaseUnavailableMessage());
    });
    api.all("/tasks/*", () => {
      throw serviceUnavailable(databaseUnavailableMessage());
    });
    api.all("/workspaces/*", () => {
      throw serviceUnavailable(databaseUnavailableMessage());
    });
  }

  app.route("/api", api);

  if (env && isProduction(env)) {
    app.use(
      "*",
      serveStatic({
        root: env.WEB_DIST_DIR
      })
    );

    app.get("*", async (c) => {
      if (c.req.path === "/api" || c.req.path.startsWith("/api/")) {
        throw notFound();
      }

      const indexHtml = await readFile(join(env.WEB_DIST_DIR, "index.html"), "utf8");
      return c.html(indexHtml);
    });
  }

  app.notFound((c) => errorResponse(c, notFound()));
  app.onError((error, c) => errorResponse(c, error));

  return app;
}
