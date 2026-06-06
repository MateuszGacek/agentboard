import type { DatabaseClient } from "@agentboard/db";
import {
  boardColumns,
  boards,
  labels,
  projects,
  taskAssignees,
  tasks,
  workspaceMembers
} from "@agentboard/db";
import { and, eq } from "drizzle-orm";

import { forbidden, notFound } from "../../lib/errors";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];
type WorkspaceQueryClient = DatabaseClient | TransactionClient;

export async function assertWorkspaceMember(
  db: WorkspaceQueryClient,
  userId: string,
  workspaceId: string
) {
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);

  if (!membership) {
    throw forbidden();
  }

  return membership;
}

export async function assertProjectInWorkspace(
  db: WorkspaceQueryClient,
  projectId: string,
  workspaceId: string
) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);

  if (!project) {
    throw notFound("Project was not found in this workspace.");
  }

  return project;
}

export async function assertBoardInWorkspace(
  db: WorkspaceQueryClient,
  boardId: string,
  workspaceId: string
) {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.workspaceId, workspaceId)))
    .limit(1);

  if (!board) {
    throw notFound("Board was not found in this workspace.");
  }

  return board;
}

export async function assertBoardInProjectWorkspace(
  db: WorkspaceQueryClient,
  boardId: string,
  projectId: string,
  workspaceId: string
) {
  const [board] = await db
    .select()
    .from(boards)
    .where(
      and(
        eq(boards.id, boardId),
        eq(boards.projectId, projectId),
        eq(boards.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!board) {
    throw notFound("Board was not found in this project workspace.");
  }

  return board;
}

export async function assertColumnInBoardWorkspace(
  db: WorkspaceQueryClient,
  columnId: string,
  boardId: string,
  workspaceId: string
) {
  const [column] = await db
    .select()
    .from(boardColumns)
    .where(
      and(
        eq(boardColumns.id, columnId),
        eq(boardColumns.boardId, boardId),
        eq(boardColumns.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!column) {
    throw notFound("Column was not found in this board workspace.");
  }

  return column;
}

export async function assertTaskInWorkspaceBoard(
  db: WorkspaceQueryClient,
  taskId: string,
  workspaceId: string,
  boardId: string
) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId), eq(tasks.boardId, boardId))
    )
    .limit(1);

  if (!task) {
    throw notFound("Task was not found in this workspace board.");
  }

  return task;
}

export async function assertLabelInWorkspace(
  db: WorkspaceQueryClient,
  labelId: string,
  workspaceId: string
) {
  const [label] = await db
    .select()
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.workspaceId, workspaceId)))
    .limit(1);

  if (!label) {
    throw notFound("Label was not found in this workspace.");
  }

  return label;
}

export async function assertAssigneeInWorkspace(
  db: WorkspaceQueryClient,
  userId: string,
  workspaceId: string
) {
  return assertWorkspaceMember(db, userId, workspaceId);
}

export async function assertTaskAssigneeInWorkspace(
  db: WorkspaceQueryClient,
  taskId: string,
  userId: string,
  workspaceId: string
) {
  await assertAssigneeInWorkspace(db, userId, workspaceId);

  const [assignee] = await db
    .select()
    .from(taskAssignees)
    .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId)))
    .limit(1);

  if (!assignee) {
    throw notFound("Task assignee was not found.");
  }

  return assignee;
}
