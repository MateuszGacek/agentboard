import type { DatabaseClient } from "@kanban/db";
import {
  aiSuggestions,
  boardColumns,
  boards,
  projects,
  taskActivityEvents,
  tasks,
  users
} from "@kanban/db";
import {
  taskPriorityValues,
  type ActivityEventType,
  type DashboardMetrics,
  type TaskPriority,
  type WeeklyReportResponse
} from "@kanban/shared";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";

import { assertProjectInWorkspace, assertWorkspaceMember } from "./ownership";

type DashboardScope = {
  userId: string;
  workspaceId: string;
  projectId?: string;
};

type TaskMetricRow = {
  task: typeof tasks.$inferSelect;
  column: typeof boardColumns.$inferSelect;
  board: Pick<typeof boards.$inferSelect, "id" | "name">;
  project: Pick<typeof projects.$inferSelect, "id" | "name">;
};

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isTaskCompleted(row: TaskMetricRow) {
  return row.column.behavior === "completes_work";
}

function isTaskActive(row: TaskMetricRow) {
  return !isTaskCompleted(row);
}

function isTaskBlocked(row: TaskMetricRow) {
  return row.task.isBlocked || row.column.behavior === "blocks_work";
}

function percent(completed: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}

function displayPercent(value: number) {
  return `${value}%`;
}

export async function getWorkspaceDashboard(
  db: DatabaseClient,
  scope: DashboardScope
): Promise<DashboardMetrics> {
  await assertWorkspaceMember(db, scope.userId, scope.workspaceId);

  if (scope.projectId) {
    await assertProjectInWorkspace(db, scope.projectId, scope.workspaceId);
  }

  const projectFilter = scope.projectId ? eq(tasks.projectId, scope.projectId) : undefined;
  const boardProjectFilter = scope.projectId ? eq(boards.projectId, scope.projectId) : undefined;
  const today = dateKey(new Date());
  const dueSoonEnd = dateKey(addDays(new Date(), 7));

  const taskRows = await db
    .select({
      task: tasks,
      column: boardColumns,
      board: {
        id: boards.id,
        name: boards.name
      },
      project: {
        id: projects.id,
        name: projects.name
      }
    })
    .from(tasks)
    .innerJoin(boardColumns, eq(tasks.columnId, boardColumns.id))
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.workspaceId, scope.workspaceId),
        isNull(tasks.archivedAt),
        eq(boardColumns.isArchived, false),
        projectFilter
      )
    )
    .orderBy(asc(boards.name), asc(boardColumns.position), asc(tasks.position));

  const columnRows = await db
    .select({
      column: boardColumns,
      board: {
        id: boards.id,
        name: boards.name
      },
      project: {
        id: projects.id,
        name: projects.name
      }
    })
    .from(boardColumns)
    .innerJoin(boards, eq(boardColumns.boardId, boards.id))
    .innerJoin(projects, eq(boards.projectId, projects.id))
    .where(
      and(
        eq(boardColumns.workspaceId, scope.workspaceId),
        eq(boardColumns.isArchived, false),
        boardProjectFilter
      )
    )
    .orderBy(asc(boards.name), asc(boardColumns.position));

  const totalRelevantTasks = taskRows.length;
  const completedTasks = taskRows.filter(isTaskCompleted).length;
  const activeRows = taskRows.filter(isTaskActive);
  const totalActiveTasks = activeRows.length;
  const overdueTasks = activeRows.filter((row) => {
    const dueDate = isoDate(row.task.dueDate);
    return dueDate !== null && dueDate < today;
  }).length;
  const blockedTasks = activeRows.filter(isTaskBlocked).length;
  const completionRateValue = percent(completedTasks, totalRelevantTasks);

  const activeByPriority = new Map<TaskPriority, number>(
    taskPriorityValues.map((priority) => [priority, 0])
  );
  const taskRowsByColumn = new Map<string, TaskMetricRow[]>();

  for (const row of activeRows) {
    activeByPriority.set(row.task.priority, (activeByPriority.get(row.task.priority) ?? 0) + 1);
  }

  for (const row of taskRows) {
    const rows = taskRowsByColumn.get(row.column.id) ?? [];
    rows.push(row);
    taskRowsByColumn.set(row.column.id, rows);
  }

  const tasksByColumn = columnRows.map((row) => {
    const columnTasks = taskRowsByColumn.get(row.column.id) ?? [];
    const activeCount = columnTasks.filter(isTaskActive).length;
    const completedCount = columnTasks.length - activeCount;

    return {
      boardId: row.board.id,
      boardName: row.board.name,
      projectId: row.project.id,
      projectName: row.project.name,
      columnId: row.column.id,
      columnName: row.column.name,
      systemKey: row.column.systemKey,
      behavior: row.column.behavior,
      position: row.column.position,
      count: columnTasks.length,
      activeCount,
      completedCount
    };
  });

  const wipLimitWarnings = tasksByColumn
    .filter((column) => {
      const limit = columnRows.find((row) => row.column.id === column.columnId)?.column.wipLimit;
      return limit !== null && limit !== undefined && column.activeCount > limit;
    })
    .map((column) => {
      const limit =
        columnRows.find((row) => row.column.id === column.columnId)?.column.wipLimit ?? 0;

      return {
        boardId: column.boardId,
        boardName: column.boardName,
        projectId: column.projectId,
        projectName: column.projectName,
        columnId: column.columnId,
        columnName: column.columnName,
        systemKey: column.systemKey,
        behavior: column.behavior,
        count: column.activeCount,
        limit,
        overBy: column.activeCount - limit
      };
    });

  const dueSoonTasks = activeRows
    .filter((row) => {
      const dueDate = isoDate(row.task.dueDate);
      return dueDate !== null && dueDate >= today && dueDate <= dueSoonEnd;
    })
    .sort((left, right) => {
      const leftDate = isoDate(left.task.dueDate) ?? "";
      const rightDate = isoDate(right.task.dueDate) ?? "";
      return leftDate.localeCompare(rightDate) || left.task.title.localeCompare(right.task.title);
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.task.id,
      title: row.task.title,
      projectId: row.project.id,
      projectName: row.project.name,
      boardId: row.board.id,
      boardName: row.board.name,
      columnId: row.column.id,
      columnName: row.column.name,
      priority: row.task.priority,
      dueDate: isoDate(row.task.dueDate) ?? today,
      isBlocked: isTaskBlocked(row)
    }));

  const activityProjectFilter = scope.projectId ? eq(tasks.projectId, scope.projectId) : undefined;
  const activityRows = await db
    .select({
      id: taskActivityEvents.id,
      taskId: taskActivityEvents.taskId,
      taskTitle: tasks.title,
      type: taskActivityEvents.type,
      message: taskActivityEvents.message,
      actor: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl
      },
      createdAt: taskActivityEvents.createdAt
    })
    .from(taskActivityEvents)
    .innerJoin(tasks, eq(taskActivityEvents.taskId, tasks.id))
    .leftJoin(users, eq(taskActivityEvents.actorId, users.id))
    .where(
      and(
        eq(taskActivityEvents.workspaceId, scope.workspaceId),
        isNull(tasks.archivedAt),
        activityProjectFilter
      )
    )
    .orderBy(desc(taskActivityEvents.createdAt))
    .limit(8);

  return {
    workspaceId: scope.workspaceId,
    projectId: scope.projectId ?? null,
    generatedAt: new Date().toISOString(),
    totalRelevantTasks,
    totalActiveTasks,
    completedTasks,
    overdueTasks,
    blockedTasks,
    completionRate: {
      value: completionRateValue,
      displayPercent: displayPercent(completionRateValue),
      completed: completedTasks,
      total: totalRelevantTasks
    },
    metricCards: [
      {
        key: "totalActiveTasks",
        value: totalActiveTasks,
        displayValue: String(totalActiveTasks)
      },
      {
        key: "completedTasks",
        value: completedTasks,
        displayValue: String(completedTasks)
      },
      {
        key: "overdueTasks",
        value: overdueTasks,
        displayValue: String(overdueTasks)
      },
      {
        key: "blockedTasks",
        value: blockedTasks,
        displayValue: String(blockedTasks)
      },
      {
        key: "completionRate",
        value: completionRateValue,
        displayValue: displayPercent(completionRateValue),
        helper: `${completedTasks}/${totalRelevantTasks}`
      }
    ],
    wipLimitWarnings,
    tasksByPriority: taskPriorityValues.map((priority) => ({
      priority,
      count: activeByPriority.get(priority) ?? 0
    })),
    tasksByColumn,
    dueSoonTasks,
    recentActivity: activityRows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      taskTitle: row.taskTitle,
      type: row.type as ActivityEventType,
      message: row.message,
      actor: row.actor?.id ? row.actor : null,
      createdAt: row.createdAt.toISOString()
    }))
  };
}

function startOfUtcWeek(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function parseWeekStart(value: string | undefined) {
  if (!value) {
    return startOfUtcWeek(new Date());
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return startOfUtcWeek(new Date());
  }

  return parsed;
}

function markdownReport(input: {
  dashboard: DashboardMetrics;
  weekStart: string;
  weekEnd: string;
  newTasksCount: number;
  completedTasksCount: number;
  aiSuggestionsCount: number;
}) {
  const warningLine =
    input.dashboard.wipLimitWarnings.length > 0
      ? `${input.dashboard.wipLimitWarnings.length} WIP warning(s)`
      : "No WIP warnings";
  const dueLine =
    input.dashboard.dueSoonTasks.length > 0
      ? `${input.dashboard.dueSoonTasks.length} due-soon task(s)`
      : "No due-soon tasks";

  return [
    `## Kanban weekly report (${input.weekStart} - ${input.weekEnd})`,
    "",
    `- New tasks: ${input.newTasksCount}`,
    `- Completed tasks: ${input.completedTasksCount}`,
    `- Active tasks: ${input.dashboard.totalActiveTasks}`,
    `- Blocked tasks: ${input.dashboard.blockedTasks}`,
    `- Overdue tasks: ${input.dashboard.overdueTasks}`,
    `- AI suggestions created: ${input.aiSuggestionsCount}`,
    `- WIP: ${warningLine}`,
    `- Due soon: ${dueLine}`,
    `- Completion rate: ${input.dashboard.completionRate.displayPercent}`
  ].join("\n");
}

export async function getWorkspaceWeeklyReport(
  db: DatabaseClient,
  scope: DashboardScope & { weekStart?: string }
): Promise<WeeklyReportResponse> {
  await assertWorkspaceMember(db, scope.userId, scope.workspaceId);

  if (scope.projectId) {
    await assertProjectInWorkspace(db, scope.projectId, scope.workspaceId);
  }

  const dashboard = await getWorkspaceDashboard(db, scope);
  const weekStartDate = parseWeekStart(scope.weekStart);
  const weekEndExclusive = addDays(weekStartDate, 7);
  const weekEndInclusive = addDays(weekStartDate, 6);
  const projectFilter = scope.projectId ? eq(tasks.projectId, scope.projectId) : undefined;

  const newTaskRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, scope.workspaceId),
        isNull(tasks.archivedAt),
        gte(tasks.createdAt, weekStartDate),
        lt(tasks.createdAt, weekEndExclusive),
        projectFilter
      )
    );

  const completedTaskRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, scope.workspaceId),
        isNull(tasks.archivedAt),
        gte(tasks.completedAt, weekStartDate),
        lt(tasks.completedAt, weekEndExclusive),
        projectFilter
      )
    );

  const aiSuggestionRows = await db
    .select({ id: aiSuggestions.id })
    .from(aiSuggestions)
    .innerJoin(tasks, eq(aiSuggestions.taskId, tasks.id))
    .where(
      and(
        eq(aiSuggestions.workspaceId, scope.workspaceId),
        isNull(tasks.archivedAt),
        gte(aiSuggestions.createdAt, weekStartDate),
        lt(aiSuggestions.createdAt, weekEndExclusive),
        projectFilter
      )
    );

  const weekStart = dateKey(weekStartDate);
  const weekEnd = dateKey(weekEndInclusive);

  return {
    workspaceId: scope.workspaceId,
    projectId: scope.projectId ?? null,
    generatedAt: new Date().toISOString(),
    weekStart,
    weekEnd,
    newTasksCount: newTaskRows.length,
    completedTasksCount: completedTaskRows.length,
    overdueTasksCount: dashboard.overdueTasks,
    blockedTasksCount: dashboard.blockedTasks,
    aiSuggestionsCount: aiSuggestionRows.length,
    wipLimitWarnings: dashboard.wipLimitWarnings,
    dueSoonTasks: dashboard.dueSoonTasks,
    recentActivity: dashboard.recentActivity,
    summaryMarkdown: markdownReport({
      dashboard,
      weekStart,
      weekEnd,
      newTasksCount: newTaskRows.length,
      completedTasksCount: completedTaskRows.length,
      aiSuggestionsCount: aiSuggestionRows.length
    })
  };
}
