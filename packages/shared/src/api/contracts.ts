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
