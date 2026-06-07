import type { DatabaseClient } from "@agentboard/db";
import {
  createProjectRequestSchema,
  dashboardQuerySchema,
  idSchema,
  weeklyReportQuerySchema
} from "@agentboard/shared";
import { Hono } from "hono";

import { parseJsonBody } from "../../lib/body";
import { validationError } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { requireAuth } from "../auth/sessions";
import { createWorkspaceProject, listWorkspaceProjects } from "../projects/service";
import { getWorkspaceDashboard, getWorkspaceWeeklyReport } from "./dashboard";

export function createWorkspaceRoutes(db: DatabaseClient) {
  const workspacesRoute = new Hono<AppBindings>();

  workspacesRoute.get("/:workspaceId/projects", requireAuth(db), async (c) => {
    const parsedWorkspaceId = idSchema.safeParse(c.req.param("workspaceId"));

    if (!parsedWorkspaceId.success) {
      throw validationError(
        "Workspace ID must be a valid UUID.",
        parsedWorkspaceId.error.flatten()
      );
    }

    const user = c.get("user");
    const projects = await listWorkspaceProjects(db, {
      userId: user.id,
      workspaceId: parsedWorkspaceId.data
    });

    return success(c, { projects });
  });

  workspacesRoute.post("/:workspaceId/projects", requireAuth(db), async (c) => {
    const parsedWorkspaceId = idSchema.safeParse(c.req.param("workspaceId"));

    if (!parsedWorkspaceId.success) {
      throw validationError(
        "Workspace ID must be a valid UUID.",
        parsedWorkspaceId.error.flatten()
      );
    }

    const body = await parseJsonBody(c.req.raw, createProjectRequestSchema);
    const user = c.get("user");

    const project = await createWorkspaceProject(db, {
      userId: user.id,
      workspaceId: parsedWorkspaceId.data,
      body
    });

    return success(c, { project });
  });

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

  workspacesRoute.get("/:workspaceId/reports/weekly", requireAuth(db), async (c) => {
    const parsedWorkspaceId = idSchema.safeParse(c.req.param("workspaceId"));

    if (!parsedWorkspaceId.success) {
      throw validationError(
        "Workspace ID must be a valid UUID.",
        parsedWorkspaceId.error.flatten()
      );
    }

    const parsedQuery = weeklyReportQuerySchema.safeParse({
      projectId: c.req.query("projectId"),
      weekStart: c.req.query("weekStart")
    });

    if (!parsedQuery.success) {
      throw validationError("Weekly report query is invalid.", parsedQuery.error.flatten());
    }

    const user = c.get("user");
    const reportScope = {
      userId: user.id,
      workspaceId: parsedWorkspaceId.data,
      ...(parsedQuery.data.projectId ? { projectId: parsedQuery.data.projectId } : {}),
      ...(parsedQuery.data.weekStart ? { weekStart: parsedQuery.data.weekStart } : {})
    };

    return success(c, await getWorkspaceWeeklyReport(db, reportScope));
  });

  return workspacesRoute;
}
