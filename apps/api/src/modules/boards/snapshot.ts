import type { DatabaseClient } from "@kanban/db";
import {
  boardColumns,
  boards,
  labels,
  projects,
  taskAssignees,
  taskChecklistItems,
  taskComments,
  taskLabels,
  tasks,
  users,
  workspaceMembers,
  workspaces
} from "@kanban/db";
import type { BoardSnapshot, BoardTaskCard } from "@kanban/shared";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { notFound } from "../../lib/errors";
import { assertWorkspaceMember } from "../workspaces/ownership";

function toIsoTimestamp(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toIsoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function previewDescription(description: string | null) {
  if (!description) {
    return null;
  }

  const normalized = description.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function getBoardSnapshot(
  db: DatabaseClient,
  userId: string,
  boardId: string
): Promise<BoardSnapshot> {
  const [boardRow] = await db
    .select({
      board: boards,
      project: projects,
      workspace: workspaces
    })
    .from(boards)
    .innerJoin(
      projects,
      and(eq(boards.projectId, projects.id), eq(projects.workspaceId, boards.workspaceId))
    )
    .innerJoin(workspaces, eq(boards.workspaceId, workspaces.id))
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!boardRow) {
    throw notFound("Board was not found.");
  }

  await assertWorkspaceMember(db, userId, boardRow.workspace.id);

  const columnRows = await db
    .select()
    .from(boardColumns)
    .where(
      and(
        eq(boardColumns.boardId, boardId),
        eq(boardColumns.workspaceId, boardRow.workspace.id),
        eq(boardColumns.isArchived, false)
      )
    )
    .orderBy(asc(boardColumns.position));

  const taskRows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.boardId, boardId),
        eq(tasks.workspaceId, boardRow.workspace.id),
        eq(tasks.projectId, boardRow.project.id),
        isNull(tasks.archivedAt)
      )
    )
    .orderBy(asc(tasks.columnId), asc(tasks.position));

  const taskIds = taskRows.map((task) => task.id);
  const assigneesByTask = new Map<string, BoardTaskCard["assignees"]>();
  const labelsByTask = new Map<string, BoardTaskCard["labels"]>();
  const checklistTotals = new Map<string, { total: number; completed: number }>();
  const commentsCountByTask = new Map<string, number>();

  if (taskIds.length > 0) {
    const assigneeRows = await db
      .select({
        taskId: taskAssignees.taskId,
        user: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl
        }
      })
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(inArray(taskAssignees.taskId, taskIds))
      .orderBy(asc(users.name));

    for (const row of assigneeRows) {
      const assignees = assigneesByTask.get(row.taskId) ?? [];
      assignees.push(row.user);
      assigneesByTask.set(row.taskId, assignees);
    }

    const labelRows = await db
      .select({
        taskId: taskLabels.taskId,
        label: {
          id: labels.id,
          name: labels.name,
          colorKey: labels.colorKey
        }
      })
      .from(taskLabels)
      .innerJoin(labels, eq(taskLabels.labelId, labels.id))
      .where(inArray(taskLabels.taskId, taskIds))
      .orderBy(asc(labels.name));

    for (const row of labelRows) {
      const taskCardLabels = labelsByTask.get(row.taskId) ?? [];
      taskCardLabels.push(row.label);
      labelsByTask.set(row.taskId, taskCardLabels);
    }

    const checklistRows = await db
      .select({
        taskId: taskChecklistItems.taskId,
        isDone: taskChecklistItems.isDone
      })
      .from(taskChecklistItems)
      .where(inArray(taskChecklistItems.taskId, taskIds));

    for (const row of checklistRows) {
      const current = checklistTotals.get(row.taskId) ?? { total: 0, completed: 0 };
      current.total += 1;

      if (row.isDone) {
        current.completed += 1;
      }

      checklistTotals.set(row.taskId, current);
    }

    const commentRows = await db
      .select({
        taskId: taskComments.taskId
      })
      .from(taskComments)
      .where(and(inArray(taskComments.taskId, taskIds), isNull(taskComments.deletedAt)));

    for (const row of commentRows) {
      increment(commentsCountByTask, row.taskId);
    }
  }

  const availableMembers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, boardRow.workspace.id))
    .orderBy(asc(users.name));

  const availableLabels = await db
    .select({
      id: labels.id,
      name: labels.name,
      colorKey: labels.colorKey
    })
    .from(labels)
    .where(eq(labels.workspaceId, boardRow.workspace.id))
    .orderBy(asc(labels.name));

  const tasksByColumn: Record<string, BoardTaskCard[]> = Object.fromEntries(
    columnRows.map((column) => [column.id, []])
  );

  for (const task of taskRows) {
    const taskCard: BoardTaskCard = {
      id: task.id,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      boardId: task.boardId,
      columnId: task.columnId,
      title: task.title,
      descriptionPreview: previewDescription(task.description),
      priority: task.priority,
      position: task.position,
      isBlocked: task.isBlocked,
      blockedReason: task.blockedReason,
      dueDate: toIsoDate(task.dueDate),
      completedAt: toIsoTimestamp(task.completedAt),
      assignees: assigneesByTask.get(task.id) ?? [],
      labels: labelsByTask.get(task.id) ?? [],
      checklist: checklistTotals.get(task.id) ?? { total: 0, completed: 0 },
      commentsCount: commentsCountByTask.get(task.id) ?? 0,
      updatedAt: task.updatedAt.toISOString()
    };

    const columnTasks = tasksByColumn[task.columnId] ?? [];
    columnTasks.push(taskCard);
    tasksByColumn[task.columnId] = columnTasks;
  }

  const columns = columnRows.map((column) => {
    const columnTasks = tasksByColumn[column.id] ?? [];
    const wipCount = columnTasks.filter((task) => task.completedAt === null).length;
    const wipLimit = column.wipLimit;

    return {
      id: column.id,
      boardId: column.boardId,
      name: column.name,
      systemKey: column.systemKey,
      behavior: column.behavior,
      position: column.position,
      wipLimit,
      colorKey: column.colorKey,
      taskCount: columnTasks.length,
      wip: {
        limit: wipLimit,
        count: wipCount,
        exceeded: wipLimit !== null && wipCount > wipLimit
      }
    };
  });

  return {
    id: boardRow.board.id,
    workspaceId: boardRow.workspace.id,
    projectId: boardRow.project.id,
    name: boardRow.board.name,
    version: boardRow.board.version,
    workspace: {
      id: boardRow.workspace.id,
      name: boardRow.workspace.name,
      slug: boardRow.workspace.slug
    },
    project: {
      id: boardRow.project.id,
      workspaceId: boardRow.project.workspaceId,
      name: boardRow.project.name,
      slug: boardRow.project.slug
    },
    board: {
      id: boardRow.board.id,
      workspaceId: boardRow.board.workspaceId,
      projectId: boardRow.board.projectId,
      name: boardRow.board.name,
      slug: boardRow.board.slug,
      version: boardRow.board.version
    },
    columns,
    tasksByColumn,
    availableMembers,
    availableLabels
  };
}
