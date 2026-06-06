# API Contracts

## API base

```txt
/api
```

Production:

```txt
https://scalesoftware.matgac.pl/api
```

## Response format

### Success

```ts
type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};
```

### Error

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
};
```

Common codes:

```txt
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
CONFLICT
RATE_LIMITED
AI_UNAVAILABLE
INTERNAL_ERROR
```

## Shared domain types

```ts
type ID = string;

type Locale = "en" | "pl" | "cs";
type ThemeMode = "light" | "dark" | "system";
type WorkspaceRole = "owner" | "member";
type ProjectStatus = "active" | "archived";

type ColumnSystemKey =
  | "backlog"
  | "ready"
  | "in_progress"
  | "review"
  | "blocked"
  | "done"
  | "custom";

type ColumnBehavior = "none" | "starts_work" | "active" | "blocks_work" | "completes_work";

type TaskPriority = "low" | "medium" | "high" | "urgent";
type LabelColor = "slate" | "blue" | "violet" | "amber" | "green" | "red";
```

## Auth/session contracts

### User/session shape

```ts
type CurrentUser = {
  id: ID;
  name: string;
  email: string;
  avatarUrl: string | null;
  locale: Locale | null;
  theme: ThemeMode | null;
  isDemo: boolean;
};

type CurrentWorkspace = {
  id: ID;
  name: string;
  slug: string;
  role: WorkspaceRole;
  isDemo: boolean;
};

type SessionResponse = {
  user: CurrentUser;
  workspaces: CurrentWorkspace[];
  activeWorkspaceId: ID | null;
};
```

### POST /api/auth/register

Request:

```ts
type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};
```

Rules:

- name: 1–80 chars,
- email: valid email,
- password: 8–128 chars,
- creates first workspace.

Response:

```ts
type RegisterResponse = ApiSuccess<SessionResponse>;
```

### POST /api/auth/login

Request:

```ts
type LoginRequest = {
  email: string;
  password: string;
};
```

Response:

```ts
type LoginResponse = ApiSuccess<SessionResponse>;
```

### POST /api/auth/demo

Request:

```ts
type DemoLoginRequest = {
  template?: "ai-agency-default";
};
```

Response:

```ts
type DemoLoginResponse = ApiSuccess<
  SessionResponse & {
    demo: {
      workspaceId: ID;
      projectId: ID;
      boardId: ID;
      expiresAt: string;
    };
  }
>;
```

Behavior:

- creates isolated demo user/workspace,
- seeds demo project/board,
- sets session cookie,
- returns IDs for redirect.

### POST /api/auth/logout

Response:

```ts
type LogoutResponse = ApiSuccess<{ ok: true }>;
```

### GET /api/auth/me

Response:

```ts
type MeResponse = ApiSuccess<SessionResponse>;
```

If not authenticated: `401 UNAUTHORIZED`.

## Workspace/project contracts

### GET /api/workspaces

Response:

```ts
type WorkspaceListItem = {
  id: ID;
  name: string;
  slug: string;
  role: WorkspaceRole;
  isDemo: boolean;
};

type WorkspacesResponse = ApiSuccess<WorkspaceListItem[]>;
```

### GET /api/workspaces/:workspaceId/projects

Response:

```ts
type ProjectListItem = {
  id: ID;
  workspaceId: ID;
  name: string;
  description: string | null;
  status: ProjectStatus;
  boardId: ID | null;
  updatedAt: string;
};

type ProjectsResponse = ApiSuccess<ProjectListItem[]>;
```

### POST /api/workspaces/:workspaceId/projects

Request:

```ts
type CreateProjectRequest = {
  name: string;
  description?: string;
  createDefaultBoard?: boolean;
};
```

Response:

```ts
type CreateProjectResponse = ApiSuccess<ProjectListItem>;
```

### PATCH /api/projects/:projectId

Request:

```ts
type UpdateProjectRequest = {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
};
```

Response:

```ts
type UpdateProjectResponse = ApiSuccess<ProjectListItem>;
```

## Board snapshot contract

### GET /api/boards/:boardId

Query params:

```ts
type BoardFilters = {
  q?: string;
  priority?: TaskPriority[];
  assigneeId?: ID[];
  labelId?: ID[];
  columnSystemKey?: ColumnSystemKey[];
  blocked?: boolean;
  due?: "overdue" | "today" | "week" | "none";
};
```

Response:

```ts
type BoardColumn = {
  id: ID;
  boardId: ID;
  name: string;
  systemKey: ColumnSystemKey;
  behavior: ColumnBehavior;
  position: number;
  wipLimit: number | null;
  colorKey: string;
  taskCount: number;
  wip: {
    limit: number | null;
    count: number;
    exceeded: boolean;
  };
};

type BoardTaskCard = {
  id: ID;
  workspaceId: ID;
  projectId: ID;
  boardId: ID;
  columnId: ID;
  title: string;
  descriptionPreview: string | null;
  priority: TaskPriority;
  position: number;
  isBlocked: boolean;
  blockedReason: string | null;
  dueDate: string | null;
  completedAt: string | null;
  assignees: Array<{
    id: ID;
    name: string;
    avatarUrl: string | null;
  }>;
  labels: Array<{
    id: ID;
    name: string;
    colorKey: LabelColor;
  }>;
  checklist: {
    total: number;
    completed: number;
  };
  commentsCount: number;
  updatedAt: string;
};

type BoardSnapshot = {
  id: ID;
  workspaceId: ID;
  projectId: ID;
  name: string;
  version: number;
  columns: BoardColumn[];
  tasksByColumn: Record<ID, BoardTaskCard[]>;
  availableMembers: Array<{
    id: ID;
    name: string;
    email: string;
    avatarUrl: string | null;
  }>;
  availableLabels: Array<{
    id: ID;
    name: string;
    colorKey: LabelColor;
  }>;
};

type BoardResponse = ApiSuccess<BoardSnapshot>;
```

## Task contracts

### GET /api/tasks/:taskId

Response:

```ts
type ChecklistItem = {
  id: ID;
  title: string;
  isDone: boolean;
  position: number;
  completedAt: string | null;
};

type TaskComment = {
  id: ID;
  body: string;
  author: {
    id: ID;
    name: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

type TaskActivityEvent = {
  id: ID;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  actor: {
    id: ID;
    name: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
};

type TaskDetail = BoardTaskCard & {
  description: string | null;
  createdBy: {
    id: ID;
    name: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
  startedAt: string | null;
  checklistItems: ChecklistItem[];
  comments: TaskComment[];
  activity: TaskActivityEvent[];
};

type TaskDetailResponse = ApiSuccess<TaskDetail>;
```

### POST /api/boards/:boardId/tasks

Request:

```ts
type CreateTaskRequest = {
  columnId: ID;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeIds?: ID[];
  labelIds?: ID[];
};
```

Response:

```ts
type CreateTaskResponse = ApiSuccess<{
  task: TaskDetail;
  board: BoardSnapshot;
}>;
```

### PATCH /api/tasks/:taskId

Request:

```ts
type UpdateTaskRequest = {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  isBlocked?: boolean;
  blockedReason?: string | null;
  assigneeIds?: ID[];
  labelIds?: ID[];
};
```

Response:

```ts
type UpdateTaskResponse = ApiSuccess<{
  task: TaskDetail;
  board?: BoardSnapshot;
}>;
```

### DELETE /api/tasks/:taskId

Behavior:

- soft delete/archive optional,
- MVP can hard delete task + relations,
- must insert activity before delete only if soft delete used.

Response:

```ts
type DeleteTaskResponse = ApiSuccess<{
  ok: true;
  board: BoardSnapshot;
}>;
```

### POST /api/tasks/:taskId/move

Request:

```ts
type MoveTaskRequest = {
  targetColumnId: ID;
  targetIndex: number;
  boardVersion?: number;
};
```

Rules:

- Supports same-column reorder.
- Supports cross-column move.
- Runs transactionally.
- Validates target column belongs to same board/workspace.
- Recomputes positions in affected columns.
- Updates `completedAt` based on target column behavior.
- Increments board version.
- Returns fresh board snapshot.

Conflict behavior:

- If `boardVersion` is provided and server version is newer, return `409 CONFLICT` with latest board snapshot in `details.latestBoard` if practical.
- If not implementing conflict handling in MVP, ignore `boardVersion`, use last-write-wins, and return latest board snapshot.

Response:

```ts
type MoveTaskResponse = ApiSuccess<{
  board: BoardSnapshot;
}>;
```

## Checklist contracts

### POST /api/tasks/:taskId/checklist-items

Request:

```ts
type CreateChecklistItemRequest = {
  title: string;
};
```

Response:

```ts
type ChecklistResponse = ApiSuccess<{
  task: TaskDetail;
  board: BoardSnapshot;
}>;
```

### PATCH /api/tasks/checklist-items/:itemId

Request:

```ts
type UpdateChecklistItemRequest = {
  title?: string;
  isDone?: boolean;
  position?: number;
};
```

Response:

```ts
type UpdateChecklistResponse = ApiSuccess<{
  task: TaskDetail;
  board: BoardSnapshot;
}>;
```

### DELETE /api/checklist-items/:itemId

Response:

```ts
type DeleteChecklistResponse = ApiSuccess<{
  task: TaskDetail;
}>;
```

## Comments contracts

### POST /api/tasks/:taskId/comments

Request:

```ts
type CreateCommentRequest = {
  body: string;
};
```

Response:

```ts
type CreateCommentResponse = ApiSuccess<{
  task: TaskDetail;
  board: BoardSnapshot;
}>;
```

### PATCH /api/comments/:commentId

Request:

```ts
type UpdateCommentRequest = {
  body: string;
};
```

Response:

```ts
type UpdateCommentResponse = ApiSuccess<{
  task: TaskDetail;
}>;
```

### DELETE /api/comments/:commentId

Response:

```ts
type DeleteCommentResponse = ApiSuccess<{
  task: TaskDetail;
}>;
```

## Dashboard contract

### GET /api/workspaces/:workspaceId/dashboard

Query:

```ts
type DashboardQuery = {
  projectId?: ID;
};
```

Response:

```ts
type DashboardMetrics = {
  workspaceId: ID;
  projectId: ID | null;
  generatedAt: string;
  totalRelevantTasks: number;
  totalActiveTasks: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  completionRate: {
    value: number; // 0-100
    displayPercent: string;
    completed: number;
    total: number;
  };
  metricCards: Array<{
    key: "totalActiveTasks" | "completedTasks" | "overdueTasks" | "blockedTasks" | "completionRate";
    value: number;
    displayValue: string;
    helper?: string;
  }>;
  wipLimitWarnings: Array<{
    boardId: ID;
    boardName: string;
    projectId: ID;
    projectName: string;
    columnId: ID;
    columnName: string;
    systemKey: ColumnSystemKey;
    behavior: ColumnBehavior;
    count: number;
    limit: number;
    overBy: number;
  }>;
  tasksByPriority: Array<{
    priority: TaskPriority;
    count: number;
  }>;
  tasksByColumn: Array<{
    boardId: ID;
    boardName: string;
    projectId: ID;
    projectName: string;
    columnId: ID;
    columnName: string;
    systemKey: ColumnSystemKey;
    behavior: ColumnBehavior;
    position: number;
    count: number;
    activeCount: number;
    completedCount: number;
  }>;
  dueSoonTasks: Array<{
    id: ID;
    title: string;
    projectId: ID;
    projectName: string;
    boardId: ID;
    boardName: string;
    columnId: ID;
    columnName: string;
    priority: TaskPriority;
    dueDate: string;
    isBlocked: boolean;
  }>;
  recentActivity: Array<{
    id: ID;
    taskId: ID;
    taskTitle: string;
    type: ActivityEventType;
    message: string;
    actor: {
      id: ID;
      name: string;
      avatarUrl: string | null;
    } | null;
    createdAt: string;
  }>;
};

type DashboardResponse = ApiSuccess<DashboardMetrics>;
```

Definitions:

- Relevant = not archived/deleted in the selected workspace/project scope.
- Active = relevant tasks not in a `completes_work` column.
- Completed = relevant tasks in a `completes_work` column; do not infer this from the
  column display name.
- Overdue = active tasks with due date before today.
- Blocked = active tasks where `is_blocked = true` or the current column behavior is
  `blocks_work`.
- Completion rate = completed / all relevant tasks in selected scope.
- WIP warnings use active task count and `board_columns.wip_limit`.
- Due soon = active tasks due from today through the next 7 days.

## AI contracts

### POST /api/tasks/:taskId/ai/improve

Request:

```ts
type ImproveTaskRequest = undefined;
```

Response:

```ts
type AiSuggestionPayload = {
  improvedTitle: string;
  improvedDescription: string;
  acceptanceCriteria: string[];
  suggestedChecklistItems: string[];
  riskNotes: string[];
  recommendedPriority: TaskPriority;
};

type AiSuggestion = {
  id: ID;
  workspaceId: ID;
  taskId: ID;
  model: string;
  status: "pending" | "accepted" | "rejected" | "partially_applied" | "failed";
  originalPayload: Record<string, unknown>;
  suggestedPayload: AiSuggestionPayload;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
};

type ImproveTaskResponse = ApiSuccess<{
  suggestion: AiSuggestion;
}>;
```

Errors:

- `AI_UNAVAILABLE` if missing API key or provider failure,
- `SERVICE_UNAVAILABLE` if DB-backed routes are unavailable,
- `VALIDATION_ERROR` if task is too short/invalid,
- `RATE_LIMITED` if OpenAI reports rate/quota pressure.

### POST /api/ai-suggestions/:suggestionId/apply

Request:

```ts
type ApplyAiSuggestionRequest = {
  improvedTitle?: string;
  improvedDescription?: string;
  acceptanceCriteria?: string[];
  suggestedChecklistItems?: string[];
  riskNotes?: string[];
  recommendedPriority?: TaskPriority;
  applyTitle?: boolean;
  applyDescription?: boolean;
  applyPriority?: boolean;
  applyAcceptanceCriteria?: boolean;
  applyChecklistItems?: boolean;
};
```

Response:

```ts
type ApplyAiSuggestionResponse = ApiSuccess<{
  suggestion: AiSuggestion;
  task: TaskDetail;
  board: BoardSnapshot;
}>;
```

### POST /api/ai-suggestions/:suggestionId/reject

Response:

```ts
type RejectAiSuggestionResponse = ApiSuccess<{
  suggestion: AiSuggestion;
}>;
```

## Health

### GET /api/health

Response:

```ts
type HealthResponse = ApiSuccess<{
  ok: true;
  service: "agentboard-api";
  version: string;
  timestamp: string;
  database: "ok" | "degraded";
}>;
```

Health must not require authentication.

## Ownership/security validation

Every route that receives IDs must validate ownership.

Examples:

### Task update

- load task,
- join workspace membership,
- reject if user is not a member,
- if label IDs are provided, ensure all labels belong to task workspace,
- if assignee IDs are provided, ensure all assignees are workspace members.

### Task move

- task and target column must belong to same workspace and board,
- user must be workspace member,
- target index must be within range.

### AI improve

- user must access task workspace,
- OpenAI key used only server-side,
- suggestion stored with workspace/task ID.

## Pagination

MVP can avoid pagination for board snapshot on seeded data.

If pagination is added later:

- comments/activity can paginate by cursor,
- board cards should remain full snapshot for demo simplicity.
