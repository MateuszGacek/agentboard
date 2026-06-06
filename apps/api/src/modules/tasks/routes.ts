import type { DatabaseClient } from "@agentboard/db";
import {
  boardColumns,
  boards,
  labels,
  taskActivityEvents,
  taskAssignees,
  taskChecklistItems,
  taskComments,
  taskLabels,
  tasks,
  workspaceMembers
} from "@agentboard/db";
import {
  createChecklistItemRequestSchema,
  createCommentRequestSchema,
  createTaskRequestSchema,
  idSchema,
  moveTaskRequestSchema,
  updateChecklistItemRequestSchema,
  updateTaskRequestSchema
} from "@agentboard/shared";
import type { MoveTaskRequest, TaskPriority } from "@agentboard/shared";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiEnv } from "../../env";
import { parseJsonBody } from "../../lib/body";
import { notFound, validationError } from "../../lib/errors";
import { success } from "../../lib/responses";
import type { AppBindings } from "../../types";
import { improveTaskWithAi } from "../ai/service";
import { requireAuth } from "../auth/sessions";
import { getBoardSnapshot } from "../boards/snapshot";
import { assertWorkspaceMember } from "../workspaces/ownership";
import { getTaskDetail } from "./detail";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
type TaskMutationClient = DatabaseClient | TransactionClient;

function uniqueIds(ids: string[] | undefined) {
  return [...new Set(ids ?? [])];
}

function dateFromDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw validationError("Date must use YYYY-MM-DD format.");
  }

  return date;
}

async function assertAllAssigneesInWorkspace(
  db: TaskMutationClient,
  userIds: string[],
  workspaceId: string
) {
  if (userIds.length === 0) {
    return;
  }

  const rows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(inArray(workspaceMembers.userId, userIds), eq(workspaceMembers.workspaceId, workspaceId))
    );

  if (rows.length !== userIds.length) {
    throw validationError("Every assignee must belong to the task workspace.");
  }
}

async function assertAllLabelsInWorkspace(
  db: TaskMutationClient,
  labelIds: string[],
  workspaceId: string
) {
  if (labelIds.length === 0) {
    return;
  }

  const rows = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(inArray(labels.id, labelIds), eq(labels.workspaceId, workspaceId)));

  if (rows.length !== labelIds.length) {
    throw validationError("Every label must belong to the task workspace.");
  }
}

async function replaceAssignees(db: TaskMutationClient, taskId: string, userIds: string[]) {
  await db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));

  if (userIds.length > 0) {
    await db.insert(taskAssignees).values(userIds.map((userId) => ({ taskId, userId })));
  }
}

async function replaceLabels(db: TaskMutationClient, taskId: string, labelIds: string[]) {
  await db.delete(taskLabels).where(eq(taskLabels.taskId, taskId));

  if (labelIds.length > 0) {
    await db.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId, labelId })));
  }
}

function timestampsForColumnBehavior(input: {
  behavior: typeof boardColumns.$inferSelect.behavior;
  existingStartedAt?: Date | null;
  sourceBehavior?: typeof boardColumns.$inferSelect.behavior;
}) {
  const now = new Date();
  const startsWork = input.behavior === "starts_work" || input.behavior === "active";

  return {
    startedAt: startsWork && !input.existingStartedAt ? now : (input.existingStartedAt ?? null),
    completedAt:
      input.behavior === "completes_work"
        ? now
        : input.sourceBehavior === "completes_work"
          ? null
          : undefined
  };
}

async function insertActivity(input: {
  db: TaskMutationClient;
  workspaceId: string;
  taskId: string;
  actorId: string;
  type: typeof taskActivityEvents.$inferInsert.type;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await input.db.insert(taskActivityEvents).values({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    actorId: input.actorId,
    type: input.type,
    message: input.message,
    metadata: input.metadata ?? {}
  });
}

async function compactColumnPositions(db: TaskMutationClient, columnId: string) {
  const columnTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.columnId, columnId), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.position), asc(tasks.createdAt));

  for (const [index, task] of columnTasks.entries()) {
    await db
      .update(tasks)
      .set({ position: (index + 1) * 1000 })
      .where(eq(tasks.id, task.id));
  }
}

async function moveTaskTransaction(input: {
  db: DatabaseClient;
  userId: string;
  taskId: string;
  body: MoveTaskRequest;
}) {
  return input.db.transaction(async (tx) => {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId)).limit(1);

    if (!task || task.archivedAt) {
      throw notFound("Task was not found.");
    }

    await assertWorkspaceMember(tx, input.userId, task.workspaceId);

    const [sourceColumn] = await tx
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.id, task.columnId))
      .limit(1);
    const [targetColumn] = await tx
      .select()
      .from(boardColumns)
      .where(
        and(
          eq(boardColumns.id, input.body.targetColumnId),
          eq(boardColumns.boardId, task.boardId),
          eq(boardColumns.workspaceId, task.workspaceId),
          eq(boardColumns.isArchived, false)
        )
      )
      .limit(1);

    if (!sourceColumn || !targetColumn) {
      throw notFound("Target column was not found.");
    }

    const sourceTasks = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.columnId, sourceColumn.id), isNull(tasks.archivedAt)))
      .orderBy(asc(tasks.position), asc(tasks.createdAt));
    const targetTasks =
      sourceColumn.id === targetColumn.id
        ? sourceTasks
        : await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(and(eq(tasks.columnId, targetColumn.id), isNull(tasks.archivedAt)))
            .orderBy(asc(tasks.position), asc(tasks.createdAt));

    const sourceIds = sourceTasks.map((row) => row.id).filter((id) => id !== task.id);
    const targetIds = targetTasks.map((row) => row.id).filter((id) => id !== task.id);
    const insertIndex = Math.min(input.body.targetIndex, targetIds.length);
    targetIds.splice(insertIndex, 0, task.id);

    for (const [index, id] of sourceIds.entries()) {
      await tx
        .update(tasks)
        .set({ position: (index + 1) * 1000 })
        .where(eq(tasks.id, id));
    }

    const behaviorTimestamps = timestampsForColumnBehavior({
      behavior: targetColumn.behavior,
      sourceBehavior: sourceColumn.behavior,
      existingStartedAt: task.startedAt
    });

    for (const [index, id] of targetIds.entries()) {
      const values: Partial<typeof tasks.$inferInsert> = {
        position: (index + 1) * 1000,
        updatedAt: new Date()
      };

      if (id === task.id) {
        values.columnId = targetColumn.id;
        values.startedAt = behaviorTimestamps.startedAt;

        if (behaviorTimestamps.completedAt !== undefined) {
          values.completedAt = behaviorTimestamps.completedAt;
        }
      }

      await tx.update(tasks).set(values).where(eq(tasks.id, id));
    }

    await tx
      .update(boards)
      .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
      .where(eq(boards.id, task.boardId));

    await insertActivity({
      db: tx,
      workspaceId: task.workspaceId,
      taskId: task.id,
      actorId: input.userId,
      type:
        targetColumn.behavior === "completes_work"
          ? "task.completed"
          : sourceColumn.behavior === "completes_work"
            ? "task.reopened"
            : "task.moved",
      message: "Task moved.",
      metadata: {
        fromColumnId: sourceColumn.id,
        toColumnId: targetColumn.id,
        targetIndex: input.body.targetIndex
      }
    });

    return task.boardId;
  });
}

export function createTaskRoutes(db: DatabaseClient, env: ApiEnv) {
  const taskRoute = new Hono<AppBindings>();

  taskRoute.get("/:taskId", requireAuth(db), async (c) => {
    const parsedTaskId = idSchema.safeParse(c.req.param("taskId"));

    if (!parsedTaskId.success) {
      throw validationError("Task ID must be a valid UUID.", parsedTaskId.error.flatten());
    }

    const user = c.get("user");
    return success(c, await getTaskDetail(db, user.id, parsedTaskId.data));
  });

  taskRoute.post("/", requireAuth(db), async (c) => {
    const body = await parseJsonBody(c.req.raw, createTaskRequestSchema);
    const user = c.get("user");

    const created = await db.transaction(async (tx) => {
      const [board] = await tx.select().from(boards).where(eq(boards.id, body.boardId)).limit(1);

      if (!board) {
        throw notFound("Board was not found.");
      }

      await assertWorkspaceMember(tx, user.id, board.workspaceId);

      const [column] = await tx
        .select()
        .from(boardColumns)
        .where(
          and(
            eq(boardColumns.id, body.columnId),
            eq(boardColumns.boardId, board.id),
            eq(boardColumns.workspaceId, board.workspaceId),
            eq(boardColumns.isArchived, false)
          )
        )
        .limit(1);

      if (!column) {
        throw notFound("Column was not found.");
      }

      const assigneeIds = uniqueIds(body.assigneeIds);
      const labelIds = uniqueIds(body.labelIds);
      await assertAllAssigneesInWorkspace(tx, assigneeIds, board.workspaceId);
      await assertAllLabelsInWorkspace(tx, labelIds, board.workspaceId);

      const [positionRow] = await tx
        .select({ maxPosition: sql<number | null>`max(${tasks.position})` })
        .from(tasks)
        .where(and(eq(tasks.columnId, column.id), isNull(tasks.archivedAt)));
      const maxPosition = positionRow?.maxPosition ?? null;
      const behaviorTimestamps = timestampsForColumnBehavior({ behavior: column.behavior });

      const [createdTask] = await tx
        .insert(tasks)
        .values({
          workspaceId: board.workspaceId,
          projectId: board.projectId,
          boardId: board.id,
          columnId: column.id,
          title: body.title,
          description: body.description ?? null,
          priority: body.priority,
          position: (maxPosition ?? 0) + 1000,
          dueDate: dateFromDateOnly(body.dueDate),
          createdBy: user.id,
          startedAt: behaviorTimestamps.startedAt,
          completedAt: behaviorTimestamps.completedAt ?? null,
          updatedAt: new Date()
        })
        .returning();

      if (!createdTask) {
        throw new Error("Expected created task to be returned.");
      }

      await replaceAssignees(tx, createdTask.id, assigneeIds);
      await replaceLabels(tx, createdTask.id, labelIds);
      await insertActivity({
        db: tx,
        workspaceId: board.workspaceId,
        taskId: createdTask.id,
        actorId: user.id,
        type: "task.created",
        message: "Task created."
      });
      await tx
        .update(boards)
        .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
        .where(eq(boards.id, board.id));

      return {
        boardId: board.id,
        taskId: createdTask.id
      };
    });

    return success(c, {
      task: await getTaskDetail(db, user.id, created.taskId),
      board: await getBoardSnapshot(db, user.id, created.boardId)
    });
  });

  taskRoute.patch("/:taskId", requireAuth(db), async (c) => {
    const parsedTaskId = idSchema.safeParse(c.req.param("taskId"));

    if (!parsedTaskId.success) {
      throw validationError("Task ID must be a valid UUID.", parsedTaskId.error.flatten());
    }

    const body = await parseJsonBody(c.req.raw, updateTaskRequestSchema);
    const user = c.get("user");

    const taskId = parsedTaskId.data;
    const boardId = await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)))
        .limit(1);

      if (!task) {
        throw notFound("Task was not found.");
      }

      await assertWorkspaceMember(tx, user.id, task.workspaceId);

      const assigneeIds = body.assigneeIds === undefined ? undefined : uniqueIds(body.assigneeIds);
      const labelIds = body.labelIds === undefined ? undefined : uniqueIds(body.labelIds);

      if (assigneeIds) {
        await assertAllAssigneesInWorkspace(tx, assigneeIds, task.workspaceId);
      }

      if (labelIds) {
        await assertAllLabelsInWorkspace(tx, labelIds, task.workspaceId);
      }

      const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.priority !== undefined) updates.priority = body.priority as TaskPriority;
      if (body.dueDate !== undefined) updates.dueDate = dateFromDateOnly(body.dueDate);
      if (body.isBlocked !== undefined) updates.isBlocked = body.isBlocked;
      if (body.blockedReason !== undefined) updates.blockedReason = body.blockedReason;

      await tx.update(tasks).set(updates).where(eq(tasks.id, task.id));

      if (assigneeIds) {
        await replaceAssignees(tx, task.id, assigneeIds);
      }

      if (labelIds) {
        await replaceLabels(tx, task.id, labelIds);
      }

      await insertActivity({
        db: tx,
        workspaceId: task.workspaceId,
        taskId: task.id,
        actorId: user.id,
        type:
          body.isBlocked === true
            ? "task.blocked"
            : body.isBlocked === false
              ? "task.unblocked"
              : "task.updated",
        message: "Task updated.",
        metadata: {
          fields: Object.keys(body)
        }
      });
      await tx
        .update(boards)
        .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
        .where(eq(boards.id, task.boardId));

      return task.boardId;
    });

    return success(c, {
      task: await getTaskDetail(db, user.id, taskId),
      board: await getBoardSnapshot(db, user.id, boardId)
    });
  });

  taskRoute.delete("/:taskId", requireAuth(db), async (c) => {
    const parsedTaskId = idSchema.safeParse(c.req.param("taskId"));

    if (!parsedTaskId.success) {
      throw validationError("Task ID must be a valid UUID.", parsedTaskId.error.flatten());
    }

    const user = c.get("user");
    const boardId = await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, parsedTaskId.data), isNull(tasks.archivedAt)))
        .limit(1);

      if (!task) {
        throw notFound("Task was not found.");
      }

      await assertWorkspaceMember(tx, user.id, task.workspaceId);
      await tx
        .update(tasks)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(tasks.id, task.id));
      await compactColumnPositions(tx, task.columnId);
      await tx
        .update(boards)
        .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
        .where(eq(boards.id, task.boardId));

      return task.boardId;
    });

    return success(c, {
      ok: true as const,
      board: await getBoardSnapshot(db, user.id, boardId)
    });
  });

  taskRoute.post("/:taskId/move", requireAuth(db), async (c) => {
    const parsedTaskId = idSchema.safeParse(c.req.param("taskId"));

    if (!parsedTaskId.success) {
      throw validationError("Task ID must be a valid UUID.", parsedTaskId.error.flatten());
    }

    const body = await parseJsonBody(c.req.raw, moveTaskRequestSchema);
    const user = c.get("user");
    const boardId = await moveTaskTransaction({
      db,
      userId: user.id,
      taskId: parsedTaskId.data,
      body
    });

    return success(c, {
      board: await getBoardSnapshot(db, user.id, boardId)
    });
  });

  taskRoute.post("/:taskId/ai/improve", requireAuth(db), async (c) => {
    const parsedTaskId = idSchema.safeParse(c.req.param("taskId"));

    if (!parsedTaskId.success) {
      throw validationError("Task ID must be a valid UUID.", parsedTaskId.error.flatten());
    }

    const user = c.get("user");

    return success(c, {
      suggestion: await improveTaskWithAi({
        db,
        env,
        userId: user.id,
        taskId: parsedTaskId.data
      })
    });
  });

  taskRoute.post("/:taskId/checklist-items", requireAuth(db), async (c) => {
    const parsedTaskId = idSchema.safeParse(c.req.param("taskId"));

    if (!parsedTaskId.success) {
      throw validationError("Task ID must be a valid UUID.", parsedTaskId.error.flatten());
    }

    const body = await parseJsonBody(c.req.raw, createChecklistItemRequestSchema);
    const user = c.get("user");
    const taskId = parsedTaskId.data;

    const boardId = await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)))
        .limit(1);

      if (!task) {
        throw notFound("Task was not found.");
      }

      await assertWorkspaceMember(tx, user.id, task.workspaceId);

      const [positionRow] = await tx
        .select({ maxPosition: sql<number | null>`max(${taskChecklistItems.position})` })
        .from(taskChecklistItems)
        .where(eq(taskChecklistItems.taskId, task.id));

      await tx.insert(taskChecklistItems).values({
        workspaceId: task.workspaceId,
        taskId: task.id,
        title: body.title,
        position: (positionRow?.maxPosition ?? 0) + 1000,
        updatedAt: new Date()
      });

      await insertActivity({
        db: tx,
        workspaceId: task.workspaceId,
        taskId: task.id,
        actorId: user.id,
        type: "checklist.created",
        message: "Checklist item created.",
        metadata: { title: body.title }
      });
      await tx
        .update(boards)
        .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
        .where(eq(boards.id, task.boardId));

      return task.boardId;
    });

    return success(c, {
      task: await getTaskDetail(db, user.id, taskId),
      board: await getBoardSnapshot(db, user.id, boardId)
    });
  });

  taskRoute.patch("/checklist-items/:itemId", requireAuth(db), async (c) => {
    const parsedItemId = idSchema.safeParse(c.req.param("itemId"));

    if (!parsedItemId.success) {
      throw validationError(
        "Checklist item ID must be a valid UUID.",
        parsedItemId.error.flatten()
      );
    }

    const body = await parseJsonBody(c.req.raw, updateChecklistItemRequestSchema);
    const user = c.get("user");

    const updated = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(taskChecklistItems)
        .where(eq(taskChecklistItems.id, parsedItemId.data))
        .limit(1);

      if (!item) {
        throw notFound("Checklist item was not found.");
      }

      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, item.taskId), isNull(tasks.archivedAt)))
        .limit(1);

      if (!task || task.workspaceId !== item.workspaceId) {
        throw notFound("Task was not found.");
      }

      await assertWorkspaceMember(tx, user.id, task.workspaceId);

      const updates: Partial<typeof taskChecklistItems.$inferInsert> = {
        updatedAt: new Date()
      };

      if (body.title !== undefined) updates.title = body.title;
      if (body.position !== undefined) updates.position = body.position;
      if (body.isDone !== undefined) {
        updates.isDone = body.isDone;
        updates.completedAt = body.isDone ? new Date() : null;
      }

      await tx.update(taskChecklistItems).set(updates).where(eq(taskChecklistItems.id, item.id));

      if (body.isDone === true && !item.isDone) {
        await insertActivity({
          db: tx,
          workspaceId: task.workspaceId,
          taskId: task.id,
          actorId: user.id,
          type: "checklist.completed",
          message: "Checklist item completed.",
          metadata: { itemId: item.id }
        });
      }

      await tx
        .update(boards)
        .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
        .where(eq(boards.id, task.boardId));

      return { taskId: task.id, boardId: task.boardId };
    });

    return success(c, {
      task: await getTaskDetail(db, user.id, updated.taskId),
      board: await getBoardSnapshot(db, user.id, updated.boardId)
    });
  });

  taskRoute.post("/:taskId/comments", requireAuth(db), async (c) => {
    const parsedTaskId = idSchema.safeParse(c.req.param("taskId"));

    if (!parsedTaskId.success) {
      throw validationError("Task ID must be a valid UUID.", parsedTaskId.error.flatten());
    }

    const body = await parseJsonBody(c.req.raw, createCommentRequestSchema);
    const user = c.get("user");
    const taskId = parsedTaskId.data;

    const boardId = await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)))
        .limit(1);

      if (!task) {
        throw notFound("Task was not found.");
      }

      await assertWorkspaceMember(tx, user.id, task.workspaceId);

      await tx.insert(taskComments).values({
        workspaceId: task.workspaceId,
        taskId: task.id,
        authorId: user.id,
        body: body.body,
        updatedAt: new Date()
      });

      await insertActivity({
        db: tx,
        workspaceId: task.workspaceId,
        taskId: task.id,
        actorId: user.id,
        type: "comment.created",
        message: "Comment created."
      });
      await tx
        .update(boards)
        .set({ version: sql`${boards.version} + 1`, updatedAt: new Date() })
        .where(eq(boards.id, task.boardId));

      return task.boardId;
    });

    return success(c, {
      task: await getTaskDetail(db, user.id, taskId),
      board: await getBoardSnapshot(db, user.id, boardId)
    });
  });

  return taskRoute;
}
