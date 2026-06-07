import type { DatabaseClient } from "@agentboard/db";
import { idSchema, updateProjectRequestSchema } from "@agentboard/shared";
import { Hono } from "hono";

import { parseJsonBody } from "../../lib/body";
import { validationError } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { requireAuth } from "../auth/sessions";
import { listProjectTemplates, updateProject } from "./service";

export function createProjectTemplateRoutes(db: DatabaseClient) {
  const projectTemplatesRoute = new Hono<AppBindings>();

  projectTemplatesRoute.get("/", requireAuth(db), (c) =>
    success(c, {
      templates: listProjectTemplates()
    })
  );

  return projectTemplatesRoute;
}

export function createProjectRoutes(db: DatabaseClient) {
  const projectsRoute = new Hono<AppBindings>();

  projectsRoute.patch("/:projectId", requireAuth(db), async (c) => {
    const parsedProjectId = idSchema.safeParse(c.req.param("projectId"));

    if (!parsedProjectId.success) {
      throw validationError("Project ID must be a valid UUID.", parsedProjectId.error.flatten());
    }

    const body = await parseJsonBody(c.req.raw, updateProjectRequestSchema);
    const user = c.get("user");
    const project = await updateProject(db, {
      userId: user.id,
      projectId: parsedProjectId.data,
      body
    });

    return success(c, { project });
  });

  return projectsRoute;
}
