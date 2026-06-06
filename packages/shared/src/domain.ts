export const localeValues = ["en", "pl", "cs"] as const;
export type Locale = (typeof localeValues)[number];

export const themeModeValues = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof themeModeValues)[number];

export const workspaceRoleValues = ["owner", "member"] as const;
export type WorkspaceRole = (typeof workspaceRoleValues)[number];

export const projectStatusValues = ["active", "archived"] as const;
export type ProjectStatus = (typeof projectStatusValues)[number];

export const columnSystemKeyValues = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "blocked",
  "done",
  "custom"
] as const;
export type ColumnSystemKey = (typeof columnSystemKeyValues)[number];

export const columnBehaviorValues = [
  "none",
  "starts_work",
  "active",
  "blocks_work",
  "completes_work"
] as const;
export type ColumnBehavior = (typeof columnBehaviorValues)[number];

export const taskPriorityValues = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof taskPriorityValues)[number];

export const labelColorValues = ["slate", "blue", "violet", "amber", "green", "red"] as const;
export type LabelColor = (typeof labelColorValues)[number];

export const activityEventTypeValues = [
  "task.created",
  "task.updated",
  "task.moved",
  "task.completed",
  "task.reopened",
  "task.blocked",
  "task.unblocked",
  "comment.created",
  "checklist.created",
  "checklist.completed",
  "ai.suggestion_created",
  "ai.suggestion_applied",
  "ai.suggestion_rejected"
] as const;
export type ActivityEventType = (typeof activityEventTypeValues)[number];

export const aiSuggestionStatusValues = [
  "pending",
  "accepted",
  "rejected",
  "partially_applied",
  "failed"
] as const;
export type AiSuggestionStatus = (typeof aiSuggestionStatusValues)[number];
