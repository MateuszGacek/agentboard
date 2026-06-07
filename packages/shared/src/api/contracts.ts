import { z } from "zod";

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
} from "../domain";

export const idSchema = z.string().uuid();

export const localeSchema = z.enum(localeValues);
export const themeModeSchema = z.enum(themeModeValues);
export const workspaceRoleSchema = z.enum(workspaceRoleValues);
export const projectStatusSchema = z.enum(projectStatusValues);
export const columnSystemKeySchema = z.enum(columnSystemKeyValues);
export const columnBehaviorSchema = z.enum(columnBehaviorValues);
export const taskPrioritySchema = z.enum(taskPriorityValues);
export const labelColorSchema = z.enum(labelColorValues);
export const activityEventTypeSchema = z.enum(activityEventTypeValues);
export const aiSuggestionStatusSchema = z.enum(aiSuggestionStatusValues);

export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "AI_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR"
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string()
  })
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiMetaSchema = z.record(z.unknown());

export function apiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: apiMetaSchema.optional()
  });
}

export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("agentboard-api"),
  timestamp: z.string().datetime()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const currentUserSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  locale: localeSchema.nullable(),
  theme: themeModeSchema.nullable(),
  isDemo: z.boolean()
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const currentWorkspaceSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  role: workspaceRoleSchema,
  isDemo: z.boolean()
});

export type CurrentWorkspace = z.infer<typeof currentWorkspaceSchema>;

export const sessionResponseSchema = z.object({
  user: currentUserSchema,
  workspaces: z.array(currentWorkspaceSchema),
  activeWorkspaceId: idSchema.nullable()
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const registerRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const demoLoginRequestSchema = z
  .object({
    template: z.literal("ai-agency-default").optional()
  })
  .optional()
  .default({});

export type DemoLoginRequest = z.infer<typeof demoLoginRequestSchema>;

export const demoLoginResponseDataSchema = sessionResponseSchema.extend({
  demo: z.object({
    workspaceId: idSchema,
    projectId: idSchema,
    boardId: idSchema,
    expiresAt: z.string().datetime()
  })
});

export type DemoLoginResponseData = z.infer<typeof demoLoginResponseDataSchema>;

export const logoutResponseDataSchema = z.object({
  ok: z.literal(true)
});

export type LogoutResponseData = z.infer<typeof logoutResponseDataSchema>;

export const boardFiltersSchema = z.object({
  q: z.string().trim().min(1).optional(),
  priority: z.array(taskPrioritySchema).optional(),
  assigneeId: z.array(idSchema).optional(),
  labelId: z.array(idSchema).optional(),
  columnSystemKey: z.array(columnSystemKeySchema).optional(),
  blocked: z.boolean().optional(),
  due: z.enum(["overdue", "today", "week", "none"]).optional()
});

export type BoardFilters = z.infer<typeof boardFiltersSchema>;

export const boardColumnSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  name: z.string(),
  systemKey: columnSystemKeySchema,
  behavior: columnBehaviorSchema,
  position: z.number().int(),
  wipLimit: z.number().int().nullable(),
  colorKey: z.string(),
  taskCount: z.number().int().nonnegative(),
  wip: z.object({
    limit: z.number().int().nullable(),
    count: z.number().int().nonnegative(),
    exceeded: z.boolean()
  })
});

export type BoardColumn = z.infer<typeof boardColumnSchema>;

export const boardTaskAssigneeSchema = z.object({
  id: idSchema,
  name: z.string(),
  avatarUrl: z.string().url().nullable()
});

export const boardTaskLabelSchema = z.object({
  id: idSchema,
  name: z.string(),
  colorKey: labelColorSchema
});

export const boardTaskCardSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema,
  boardId: idSchema,
  columnId: idSchema,
  title: z.string(),
  descriptionPreview: z.string().nullable(),
  priority: taskPrioritySchema,
  position: z.number().int(),
  isBlocked: z.boolean(),
  blockedReason: z.string().nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
  assignees: z.array(boardTaskAssigneeSchema),
  labels: z.array(boardTaskLabelSchema),
  checklist: z.object({
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative()
  }),
  commentsCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime()
});

export type BoardTaskCard = z.infer<typeof boardTaskCardSchema>;

export const workspaceSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string()
});

export const projectSummarySchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string(),
  slug: z.string()
});

export const projectPrimaryBoardSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema,
  name: z.string(),
  slug: z.string(),
  version: z.number().int(),
  taskCount: z.number().int().nonnegative(),
  activeTaskCount: z.number().int().nonnegative()
});

export type ProjectPrimaryBoard = z.infer<typeof projectPrimaryBoardSchema>;

export const workspaceProjectSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  primaryBoard: projectPrimaryBoardSchema.nullable()
});

export type WorkspaceProject = z.infer<typeof workspaceProjectSchema>;

export const projectTemplateKeyValues = [
  "blank",
  "ai-agency-delivery",
  "web-app-delivery",
  "qa-hardening",
  "discovery-sprint"
] as const;

export const projectTemplateKeySchema = z.enum(projectTemplateKeyValues);
export type ProjectTemplateKey = z.infer<typeof projectTemplateKeySchema>;

export const projectTemplateSummarySchema = z.object({
  key: projectTemplateKeySchema,
  name: z.string(),
  description: z.string(),
  taskCount: z.number().int().nonnegative(),
  labelNames: z.array(z.string()),
  recommended: z.boolean()
});

export type ProjectTemplateSummary = z.infer<typeof projectTemplateSummarySchema>;

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  boardName: z.string().trim().min(1).max(120).optional(),
  templateKey: projectTemplateKeySchema.optional().default("blank")
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const updateProjectRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: projectStatusSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one project field must be provided."
  });

export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const updateBoardColumnRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    wipLimit: z.number().int().min(1).max(99).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one column field must be provided."
  });

export type UpdateBoardColumnRequest = z.infer<typeof updateBoardColumnRequestSchema>;

export const boardSummarySchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema,
  name: z.string(),
  slug: z.string(),
  version: z.number().int()
});

export const boardSnapshotSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  projectId: idSchema,
  name: z.string(),
  version: z.number().int(),
  workspace: workspaceSummarySchema,
  project: projectSummarySchema,
  board: boardSummarySchema,
  columns: z.array(boardColumnSchema),
  tasksByColumn: z.record(idSchema, z.array(boardTaskCardSchema)),
  availableMembers: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      email: z.string().email(),
      avatarUrl: z.string().url().nullable()
    })
  ),
  availableLabels: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      colorKey: labelColorSchema
    })
  )
});

export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>;

export const checklistItemSchema = z.object({
  id: idSchema,
  title: z.string(),
  isDone: z.boolean(),
  position: z.number().int(),
  completedAt: z.string().datetime().nullable()
});

export const taskCommentSchema = z.object({
  id: idSchema,
  body: z.string(),
  author: boardTaskAssigneeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const taskActivityEventSchema = z.object({
  id: idSchema,
  type: activityEventTypeSchema,
  message: z.string(),
  metadata: z.record(z.unknown()),
  actor: boardTaskAssigneeSchema.nullable(),
  createdAt: z.string().datetime()
});

export const taskDetailSchema = boardTaskCardSchema.extend({
  description: z.string().nullable(),
  createdBy: boardTaskAssigneeSchema.nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  checklistItems: z.array(checklistItemSchema),
  comments: z.array(taskCommentSchema),
  activity: z.array(taskActivityEventSchema)
});

export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const createTaskRequestSchema = z.object({
  boardId: idSchema,
  columnId: idSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  priority: taskPrioritySchema.optional().default("medium"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  assigneeIds: z.array(idSchema).optional().default([]),
  labelIds: z.array(idSchema).optional().default([])
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export const updateTaskRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    priority: taskPrioritySchema.optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().trim().max(1000).nullable().optional(),
    assigneeIds: z.array(idSchema).optional(),
    labelIds: z.array(idSchema).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one task field must be provided."
  });

export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

export const moveTaskRequestSchema = z.object({
  targetColumnId: idSchema,
  targetIndex: z.number().int().min(0),
  boardVersion: z.number().int().positive().optional()
});

export type MoveTaskRequest = z.infer<typeof moveTaskRequestSchema>;

export const createChecklistItemRequestSchema = z.object({
  title: z.string().trim().min(1).max(240)
});

export type CreateChecklistItemRequest = z.infer<typeof createChecklistItemRequestSchema>;

export const updateChecklistItemRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    isDone: z.boolean().optional(),
    position: z.number().int().min(0).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one checklist item field must be provided."
  });

export type UpdateChecklistItemRequest = z.infer<typeof updateChecklistItemRequestSchema>;

export const createCommentRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;

export const updateCommentRequestSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

export type UpdateCommentRequest = z.infer<typeof updateCommentRequestSchema>;

export const aiTaskImprovementSchema = z.object({
  improvedTitle: z.string().trim().min(3).max(120),
  improvedDescription: z.string().trim().min(20).max(5000),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
  suggestedChecklistItems: z.array(z.string().trim().min(1).max(240)).max(8),
  riskNotes: z.array(z.string().trim().min(1).max(500)).max(5),
  recommendedPriority: taskPrioritySchema
});

export type AiTaskImprovement = z.infer<typeof aiTaskImprovementSchema>;

export const aiSuggestionSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  taskId: idSchema,
  model: z.string(),
  status: aiSuggestionStatusSchema,
  originalPayload: z.record(z.unknown()),
  suggestedPayload: aiTaskImprovementSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  appliedAt: z.string().datetime().nullable()
});

export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export const applyAiSuggestionRequestSchema = z
  .object({
    improvedTitle: z.string().trim().min(3).max(120).optional(),
    improvedDescription: z.string().trim().min(20).max(5000).optional(),
    acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(8).optional(),
    suggestedChecklistItems: z.array(z.string().trim().min(1).max(240)).max(8).optional(),
    riskNotes: z.array(z.string().trim().min(1).max(500)).max(5).optional(),
    recommendedPriority: taskPrioritySchema.optional(),
    applyTitle: z.boolean().optional().default(true),
    applyDescription: z.boolean().optional().default(true),
    applyPriority: z.boolean().optional().default(true),
    applyAcceptanceCriteria: z.boolean().optional().default(true),
    applyChecklistItems: z.boolean().optional().default(true)
  })
  .optional()
  .default({});

export type ApplyAiSuggestionRequest = z.infer<typeof applyAiSuggestionRequestSchema>;

export type ImproveTaskWithAiResponseData = {
  suggestion: AiSuggestion;
};

export type AiSuggestionsResponseData = {
  suggestions: AiSuggestion[];
};

export type ApplyAiSuggestionResponseData = {
  suggestion: AiSuggestion;
  task: TaskDetail;
  board: BoardSnapshot;
};

export type RejectAiSuggestionResponseData = {
  suggestion: AiSuggestion;
};

export const aiNextActionsRequestSchema = z
  .object({
    focus: z.string().trim().max(500).optional(),
    maxSuggestions: z.number().int().min(1).max(5).optional().default(3)
  })
  .optional()
  .default({});

export type AiNextActionsRequest = z.infer<typeof aiNextActionsRequestSchema>;

export const aiNextActionSuggestionSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(3000),
  priority: taskPrioritySchema,
  targetColumnSystemKey: columnSystemKeySchema,
  acceptanceCriteria: z.array(z.string().trim().min(1).max(500)).max(6),
  checklistItems: z.array(z.string().trim().min(1).max(240)).max(6),
  riskNotes: z.array(z.string().trim().min(1).max(500)).max(4)
});

export type AiNextActionSuggestion = z.infer<typeof aiNextActionSuggestionSchema>;

export type AiNextActionsResponseData = {
  boardId: string;
  model: string;
  suggestions: AiNextActionSuggestion[];
};

export const dashboardQuerySchema = z.object({
  projectId: idSchema.optional()
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const dashboardMetricCardSchema = z.object({
  key: z.enum([
    "totalActiveTasks",
    "completedTasks",
    "overdueTasks",
    "blockedTasks",
    "completionRate"
  ]),
  value: z.number().nonnegative(),
  displayValue: z.string(),
  helper: z.string().optional()
});

export type DashboardMetricCard = z.infer<typeof dashboardMetricCardSchema>;

export const dashboardWipLimitWarningSchema = z.object({
  boardId: idSchema,
  boardName: z.string(),
  projectId: idSchema,
  projectName: z.string(),
  columnId: idSchema,
  columnName: z.string(),
  systemKey: columnSystemKeySchema,
  behavior: columnBehaviorSchema,
  count: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  overBy: z.number().int().nonnegative()
});

export type DashboardWipLimitWarning = z.infer<typeof dashboardWipLimitWarningSchema>;

export const dashboardPriorityBreakdownSchema = z.object({
  priority: taskPrioritySchema,
  count: z.number().int().nonnegative()
});

export type DashboardPriorityBreakdown = z.infer<typeof dashboardPriorityBreakdownSchema>;

export const dashboardColumnBreakdownSchema = z.object({
  boardId: idSchema,
  boardName: z.string(),
  projectId: idSchema,
  projectName: z.string(),
  columnId: idSchema,
  columnName: z.string(),
  systemKey: columnSystemKeySchema,
  behavior: columnBehaviorSchema,
  position: z.number().int(),
  count: z.number().int().nonnegative(),
  activeCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative()
});

export type DashboardColumnBreakdown = z.infer<typeof dashboardColumnBreakdownSchema>;

export const dashboardDueSoonTaskSchema = z.object({
  id: idSchema,
  title: z.string(),
  projectId: idSchema,
  projectName: z.string(),
  boardId: idSchema,
  boardName: z.string(),
  columnId: idSchema,
  columnName: z.string(),
  priority: taskPrioritySchema,
  dueDate: z.string(),
  isBlocked: z.boolean()
});

export type DashboardDueSoonTask = z.infer<typeof dashboardDueSoonTaskSchema>;

export const dashboardRecentActivitySchema = z.object({
  id: idSchema,
  taskId: idSchema,
  taskTitle: z.string(),
  type: activityEventTypeSchema,
  message: z.string(),
  actor: boardTaskAssigneeSchema.nullable(),
  createdAt: z.string().datetime()
});

export type DashboardRecentActivity = z.infer<typeof dashboardRecentActivitySchema>;

export const dashboardMetricsSchema = z.object({
  workspaceId: idSchema,
  projectId: idSchema.nullable(),
  generatedAt: z.string().datetime(),
  totalRelevantTasks: z.number().int().nonnegative(),
  totalActiveTasks: z.number().int().nonnegative(),
  completedTasks: z.number().int().nonnegative(),
  overdueTasks: z.number().int().nonnegative(),
  blockedTasks: z.number().int().nonnegative(),
  completionRate: z.object({
    value: z.number().min(0).max(100),
    displayPercent: z.string(),
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  }),
  metricCards: z.array(dashboardMetricCardSchema),
  wipLimitWarnings: z.array(dashboardWipLimitWarningSchema),
  tasksByPriority: z.array(dashboardPriorityBreakdownSchema),
  tasksByColumn: z.array(dashboardColumnBreakdownSchema),
  dueSoonTasks: z.array(dashboardDueSoonTaskSchema),
  recentActivity: z.array(dashboardRecentActivitySchema)
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;

export const weeklyReportQuerySchema = z.object({
  projectId: idSchema.optional(),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;

export const weeklyReportResponseSchema = z.object({
  workspaceId: idSchema,
  projectId: idSchema.nullable(),
  generatedAt: z.string().datetime(),
  weekStart: z.string(),
  weekEnd: z.string(),
  newTasksCount: z.number().int().nonnegative(),
  completedTasksCount: z.number().int().nonnegative(),
  overdueTasksCount: z.number().int().nonnegative(),
  blockedTasksCount: z.number().int().nonnegative(),
  aiSuggestionsCount: z.number().int().nonnegative(),
  wipLimitWarnings: z.array(dashboardWipLimitWarningSchema),
  dueSoonTasks: z.array(dashboardDueSoonTaskSchema),
  recentActivity: z.array(dashboardRecentActivitySchema),
  summaryMarkdown: z.string()
});

export type WeeklyReportResponse = z.infer<typeof weeklyReportResponseSchema>;

export type ProjectsResponseData = {
  projects: WorkspaceProject[];
};

export type ProjectTemplatesResponseData = {
  templates: ProjectTemplateSummary[];
};

export type CreateProjectResponseData = {
  project: WorkspaceProject;
};

export type CreateTaskResponseData = {
  task: TaskDetail;
  board: BoardSnapshot;
};

export type UpdateTaskResponseData = {
  task: TaskDetail;
  board?: BoardSnapshot;
};

export type DeleteTaskResponseData = {
  ok: true;
  board: BoardSnapshot;
};

export type MoveTaskResponseData = {
  board: BoardSnapshot;
};

export type UpdateProjectResponseData = {
  project: WorkspaceProject;
};

export type UpdateBoardColumnResponseData = {
  column: BoardColumn;
  board: BoardSnapshot;
};

export type ChecklistResponseData = {
  task: TaskDetail;
  board: BoardSnapshot;
};

export type DeleteChecklistItemResponseData = {
  task: TaskDetail;
  board: BoardSnapshot;
};

export type CommentResponseData = {
  task: TaskDetail;
  board: BoardSnapshot;
};

export type DeleteCommentResponseData = {
  task: TaskDetail;
  board: BoardSnapshot;
};
