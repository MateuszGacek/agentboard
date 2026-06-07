import type { DatabaseClient } from "@agentboard/db";
import { boardColumns, boards } from "@agentboard/db";
import {
  aiNextActionsRequestSchema,
  idSchema,
  updateBoardColumnRequestSchema
} from "@agentboard/shared";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiEnv } from "../../env";
import { parseJsonBody, parseOptionalJsonBody } from "../../lib/body";
import { notFound } from "../../lib/errors";
import { validationError } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { suggestBoardNextActions } from "../ai/service";
import { requireAuth } from "../auth/sessions";
import { assertWorkspaceMember } from "../workspaces/ownership";
import { getBoardSnapshot } from "./snapshot";

export function createBoardRoutes(db: DatabaseClient, env: ApiEnv) {
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

  boardsRoute.post("/:boardId/ai/next-actions", requireAuth(db), async (c) => {
    const parsedBoardId = idSchema.safeParse(c.req.param("boardId"));

    if (!parsedBoardId.success) {
      throw validationError("Board ID must be a valid UUID.", parsedBoardId.error.flatten());
    }

    const body = await parseOptionalJsonBody(c.req.raw, aiNextActionsRequestSchema);
    const user = c.get("user");

    return success(
      c,
      await suggestBoardNextActions({
        db,
        env,
        userId: user.id,
        boardId: parsedBoardId.data,
        body
      })
    );
  });

  return boardsRoute;
}

export function createBoardColumnRoutes(db: DatabaseClient) {
  const boardColumnsRoute = new Hono<AppBindings>();

  boardColumnsRoute.patch("/:columnId", requireAuth(db), async (c) => {
    const parsedColumnId = idSchema.safeParse(c.req.param("columnId"));

    if (!parsedColumnId.success) {
      throw validationError("Column ID must be a valid UUID.", parsedColumnId.error.flatten());
    }

    const body = await parseJsonBody(c.req.raw, updateBoardColumnRequestSchema);
    const user = c.get("user");

    const result = await db.transaction(async (tx) => {
      const [column] = await tx
        .select()
        .from(boardColumns)
        .where(eq(boardColumns.id, parsedColumnId.data))
        .limit(1);

      if (!column || column.isArchived) {
        throw notFound("Board column was not found.");
      }

      await assertWorkspaceMember(tx, user.id, column.workspaceId);

      const [updatedColumn] = await tx
        .update(boardColumns)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.wipLimit !== undefined ? { wipLimit: body.wipLimit } : {}),
          updatedAt: new Date()
        })
        .where(eq(boardColumns.id, column.id))
        .returning();

      if (!updatedColumn) {
        throw new Error("Expected updated board column to be returned.");
      }

      await tx
        .update(boards)
        .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
        .where(eq(boards.id, column.boardId));

      return { boardId: column.boardId };
    });

    const board = await getBoardSnapshot(db, user.id, result.boardId);
    const updatedSnapshotColumn = board.columns.find((column) => column.id === parsedColumnId.data);

    if (!updatedSnapshotColumn) {
      throw notFound("Board column was not found.");
    }

    return success(c, { column: updatedSnapshotColumn, board });
  });

  return boardColumnsRoute;
}
