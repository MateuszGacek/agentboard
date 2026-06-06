import {
  activityEventTypeValues,
  aiSuggestionStatusValues,
  columnBehaviorValues,
  columnSystemKeyValues,
  labelColorValues,
  localeValues,
  projectStatusValues,
  taskPriorityValues,
  themeModeValues,
  workspaceRoleValues
} from "@agentboard/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

function enumValues<T extends readonly [string, ...string[]]>(
  values: T
): [T[number], ...T[number][]] {
  return [...values] as [T[number], ...T[number][]];
}

function createdAtColumn() {
  return timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
}

function updatedAtColumn() {
  return timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
}

export const localeEnum = pgEnum("locale", enumValues(localeValues));
export const themeModeEnum = pgEnum("theme_mode", enumValues(themeModeValues));
export const workspaceRoleEnum = pgEnum("workspace_role", enumValues(workspaceRoleValues));
export const projectStatusEnum = pgEnum("project_status", enumValues(projectStatusValues));
export const columnSystemKeyEnum = pgEnum("column_system_key", enumValues(columnSystemKeyValues));
export const columnBehaviorEnum = pgEnum("column_behavior", enumValues(columnBehaviorValues));
export const taskPriorityEnum = pgEnum("task_priority", enumValues(taskPriorityValues));
export const labelColorEnum = pgEnum("label_color", enumValues(labelColorValues));
export const activityEventTypeEnum = pgEnum(
  "activity_event_type",
  enumValues(activityEventTypeValues)
);
export const aiSuggestionStatusEnum = pgEnum(
  "ai_suggestion_status",
  enumValues(aiSuggestionStatusValues)
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  locale: localeEnum("locale"),
  theme: themeModeEnum("theme"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn()
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAtColumn(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
  },
  (table) => ({
    userIdIdx: index("idx_sessions_user_id").on(table.userId),
    expiresAtIdx: index("idx_sessions_expires_at").on(table.expiresAt)
  })
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn()
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: createdAtColumn()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
    userWorkspaceIdx: index("idx_workspace_members_user_workspace").on(
      table.userId,
      table.workspaceId
    ),
    workspaceIdx: index("idx_workspace_members_workspace").on(table.workspaceId)
  })
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => ({
    workspaceStatusIdx: index("idx_projects_workspace_status").on(table.workspaceId, table.status),
    workspaceSlugUnique: uniqueIndex("idx_projects_workspace_slug_unique").on(
      table.workspaceId,
      table.slug
    )
  })
);

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => ({
    workspaceProjectIdx: index("idx_boards_workspace_project").on(
      table.workspaceId,
      table.projectId
    ),
    projectIdx: index("idx_boards_project").on(table.projectId),
    projectSlugUnique: uniqueIndex("idx_boards_project_slug_unique").on(table.projectId, table.slug)
  })
);

export const boardColumns = pgTable(
  "board_columns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    systemKey: columnSystemKeyEnum("system_key").notNull(),
    behavior: columnBehaviorEnum("behavior").notNull(),
    position: integer("position").notNull(),
    wipLimit: integer("wip_limit"),
    colorKey: text("color_key").notNull().default("slate"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => ({
    boardPositionIdx: index("idx_board_columns_board_position").on(table.boardId, table.position),
    workspaceBoardIdx: index("idx_board_columns_workspace_board").on(
      table.workspaceId,
      table.boardId
    ),
    boardSystemKeyIdx: index("idx_board_columns_board_system_key").on(
      table.boardId,
      table.systemKey
    ),
    boardPositionUnique: uniqueIndex("idx_board_columns_board_position_unique").on(
      table.boardId,
      table.position
    )
  })
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => boardColumns.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    position: integer("position").notNull(),
    isBlocked: boolean("is_blocked").notNull().default(false),
    blockedReason: text("blocked_reason"),
    dueDate: date("due_date", { mode: "date" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => ({
    boardColumnPositionIdx: index("idx_tasks_board_column_position").on(
      table.boardId,
      table.columnId,
      table.position
    ),
    workspaceBoardIdx: index("idx_tasks_workspace_board").on(table.workspaceId, table.boardId),
    workspaceIdx: index("idx_tasks_workspace").on(table.workspaceId),
    projectIdx: index("idx_tasks_project").on(table.projectId),
    dueDateIdx: index("idx_tasks_due_date").on(table.workspaceId, table.dueDate),
    completedAtIdx: index("idx_tasks_completed_at").on(table.workspaceId, table.completedAt),
    priorityIdx: index("idx_tasks_priority").on(table.workspaceId, table.priority),
    blockedIdx: index("idx_tasks_blocked").on(table.workspaceId, table.isBlocked)
  })
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAtColumn()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.userId] }),
    userIdx: index("idx_task_assignees_user").on(table.userId)
  })
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colorKey: labelColorEnum("color_key").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  (table) => ({
    workspaceIdx: index("idx_labels_workspace").on(table.workspaceId),
    workspaceNameUnique: uniqueIndex("idx_labels_workspace_name_unique").on(
      table.workspaceId,
      table.name
    )
  })
);

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.labelId] }),
    labelIdx: index("idx_task_labels_label").on(table.labelId)
  })
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    taskCreatedIdx: index("idx_comments_task_created").on(table.taskId, table.createdAt)
  })
);

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    position: integer("position").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => ({
    taskPositionIdx: index("idx_checklist_task_position").on(table.taskId, table.position)
  })
);

export const taskActivityEvents = pgTable(
  "task_activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: activityEventTypeEnum("type").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAtColumn()
  },
  (table) => ({
    taskCreatedIdx: index("idx_activity_task_created").on(
      table.taskId,
      sql`${table.createdAt} desc`
    )
  })
);

export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    status: aiSuggestionStatusEnum("status").notNull().default("pending"),
    originalPayload: jsonb("original_payload").$type<Record<string, unknown>>().notNull(),
    suggestedPayload: jsonb("suggested_payload").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    appliedAt: timestamp("applied_at", { withTimezone: true })
  },
  (table) => ({
    taskCreatedIdx: index("idx_ai_suggestions_task_created").on(
      table.taskId,
      sql`${table.createdAt} desc`
    )
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
export type BoardColumn = typeof boardColumns.$inferSelect;
export type NewBoardColumn = typeof boardColumns.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type NewTaskAssignee = typeof taskAssignees.$inferInsert;
export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
export type TaskLabel = typeof taskLabels.$inferSelect;
export type NewTaskLabel = typeof taskLabels.$inferInsert;
export type TaskComment = typeof taskComments.$inferSelect;
export type NewTaskComment = typeof taskComments.$inferInsert;
export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect;
export type NewTaskChecklistItem = typeof taskChecklistItems.$inferInsert;
export type TaskActivityEvent = typeof taskActivityEvents.$inferSelect;
export type NewTaskActivityEvent = typeof taskActivityEvents.$inferInsert;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type NewAiSuggestion = typeof aiSuggestions.$inferInsert;
