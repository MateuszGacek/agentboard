import type { DatabaseClient } from "@agentboard/db";
import { taskActivityEvents, taskChecklistItems, taskComments, tasks, users } from "@agentboard/db";
import type { BoardTaskCard, TaskDetail } from "@agentboard/shared";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { notFound } from "../../lib/errors";
import { getBoardSnapshot } from "../boards/snapshot";

function toIsoTimestamp(value: Date | null) {
  return value ? value.toISOString() : null;
}

function taskDetailFromCard(input: {
  task: typeof tasks.$inferSelect;
  card: BoardTaskCard;
  createdBy: TaskDetail["createdBy"];
  checklistItems: TaskDetail["checklistItems"];
  comments: TaskDetail["comments"];
  activity: TaskDetail["activity"];
}): TaskDetail {
  return {
    ...input.card,
    description: input.task.description,
    createdBy: input.createdBy,
    createdAt: input.task.createdAt.toISOString(),
    startedAt: toIsoTimestamp(input.task.startedAt),
    checklistItems: input.checklistItems,
    comments: input.comments,
    activity: input.activity
  };
}

export async function getTaskDetail(
  db: DatabaseClient,
  userId: string,
  taskId: string
): Promise<TaskDetail> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt)))
    .limit(1);

  if (!task) {
    throw notFound("Task was not found.");
  }

  const board = await getBoardSnapshot(db, userId, task.boardId);
  const card = board.tasksByColumn[task.columnId]?.find((candidate) => candidate.id === task.id);

  if (!card) {
    throw notFound("Task was not found in this board.");
  }

  const [creator] = task.createdBy
    ? await db
        .select({
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl
        })
        .from(users)
        .where(eq(users.id, task.createdBy))
        .limit(1)
    : [];

  const checklistItems = await db
    .select({
      id: taskChecklistItems.id,
      title: taskChecklistItems.title,
      isDone: taskChecklistItems.isDone,
      position: taskChecklistItems.position,
      completedAt: taskChecklistItems.completedAt
    })
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, task.id))
    .orderBy(asc(taskChecklistItems.position));

  const comments = await db
    .select({
      id: taskComments.id,
      body: taskComments.body,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl
      },
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt
    })
    .from(taskComments)
    .innerJoin(users, eq(taskComments.authorId, users.id))
    .where(and(eq(taskComments.taskId, task.id), isNull(taskComments.deletedAt)))
    .orderBy(asc(taskComments.createdAt));

  const activity = await db
    .select({
      id: taskActivityEvents.id,
      type: taskActivityEvents.type,
      message: taskActivityEvents.message,
      metadata: taskActivityEvents.metadata,
      actor: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl
      },
      createdAt: taskActivityEvents.createdAt
    })
    .from(taskActivityEvents)
    .leftJoin(users, eq(taskActivityEvents.actorId, users.id))
    .where(eq(taskActivityEvents.taskId, task.id))
    .orderBy(desc(taskActivityEvents.createdAt));

  return taskDetailFromCard({
    task,
    card,
    createdBy: creator ?? null,
    checklistItems: checklistItems.map((item) => ({
      ...item,
      completedAt: toIsoTimestamp(item.completedAt)
    })),
    comments: comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString()
    })),
    activity: activity.map((event) => ({
      ...event,
      actor: event.actor?.id ? event.actor : null,
      createdAt: event.createdAt.toISOString()
    }))
  });
}
