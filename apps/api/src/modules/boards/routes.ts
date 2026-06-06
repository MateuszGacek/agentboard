import type { DatabaseClient } from "@agentboard/db";
import { idSchema } from "@agentboard/shared";
import { Hono } from "hono";

import { validationError } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { requireAuth } from "../auth/sessions";
import { getBoardSnapshot } from "./snapshot";

export function createBoardRoutes(db: DatabaseClient) {
  const boardsRoute = new Hono<AppBindings>();

  boardsRoute.get("/:boardId", requireAuth(db), async (c) => {
    const parsedBoardId = idSchema.safeParse(c.req.param("boardId"));

    if (!parsedBoardId.success) {
      throw validationError("Board ID must be a valid UUID.", parsedBoardId.error.flatten());
    }

    const user = c.get("user");
    const snapshot = await getBoardSnapshot(db, user.id, parsedBoardId.data);
    return success(c, snapshot);
  });

  return boardsRoute;
}
