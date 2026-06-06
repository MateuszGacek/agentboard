import type { DatabaseClient } from "@agentboard/db";
import { dashboardQuerySchema, idSchema } from "@agentboard/shared";
import { Hono } from "hono";

import { validationError } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { requireAuth } from "../auth/sessions";
import { getWorkspaceDashboard } from "./dashboard";

export function createWorkspaceRoutes(db: DatabaseClient) {
  const workspacesRoute = new Hono<AppBindings>();

  workspacesRoute.get("/:workspaceId/dashboard", requireAuth(db), async (c) => {
    const parsedWorkspaceId = idSchema.safeParse(c.req.param("workspaceId"));

    if (!parsedWorkspaceId.success) {
      throw validationError(
        "Workspace ID must be a valid UUID.",
        parsedWorkspaceId.error.flatten()
      );
    }

    const parsedQuery = dashboardQuerySchema.safeParse({
      projectId: c.req.query("projectId")
    });

    if (!parsedQuery.success) {
      throw validationError("Dashboard query is invalid.", parsedQuery.error.flatten());
    }

    const user = c.get("user");
    const dashboardScope = {
      userId: user.id,
      workspaceId: parsedWorkspaceId.data,
      ...(parsedQuery.data.projectId ? { projectId: parsedQuery.data.projectId } : {})
    };
    const dashboard = await getWorkspaceDashboard(db, dashboardScope);

    return success(c, dashboard);
  });

  return workspacesRoute;
}
