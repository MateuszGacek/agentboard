# 06 — API Contracts

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
}>;
```

### PATCH /api/checklist-items/:itemId

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
  totalActiveTasks: number;
  completedThisWeek: number;
  overdueTasks: number;
  blockedTasks: number;
  completionRate: number; // 0-100
  wipIssues: Array<{
    boardId: ID;
    boardName: string;
    columnId: ID;
    columnName: string;
    systemKey: ColumnSystemKey;
    count: number;
    limit: number;
  }>;
  tasksByStatus: Array<{
    systemKey: ColumnSystemKey;
    label: string;
    count: number;
  }>;
  tasksByPriority: Array<{
    priority: TaskPriority;
    count: number;
  }>;
  recentlyCompleted: Array<{
    id: ID;
    title: string;
    completedAt: string;
  }>;
};

type DashboardResponse = ApiSuccess<DashboardMetrics>;
```

Definitions:

- Active = not archived and not in completes-work column.
- Completed this week = `completed_at >= startOfWeek`.
- Overdue = due date < today and not completed.
- Completion rate = completed / all non-archived tasks in selected scope.

## AI contracts

### POST /api/tasks/:taskId/ai/improve

Request:

```ts
type ImproveTaskRequest = {
  focus?: "clarity" | "acceptance_criteria" | "subtasks" | "risk" | "all";
};
```

Response:

```ts
type AiSuggestionPayload = {
  improvedTitle: string;
  improvedDescription: string;
  acceptanceCriteria: string[];
  suggestedSubtasks: string[];
  riskNotes: string[];
  recommendedPriority: TaskPriority;
  confidence: number; // 0-1
};

type AiSuggestionResponse = ApiSuccess<{
  suggestionId: ID;
  taskId: ID;
  model: string;
  status: "pending";
  original: {
    title: string;
    description: string | null;
    priority: TaskPriority;
  };
  suggested: AiSuggestionPayload;
  createdAt: string;
}>;
```

Errors:

- `AI_UNAVAILABLE` if missing API key or provider failure,
- `VALIDATION_ERROR` if task is too short/invalid,
- `RATE_LIMITED` if rate limit implemented.

### POST /api/tasks/:taskId/ai/suggestions/:suggestionId/apply

Request:

```ts
type ApplyAiSuggestionRequest = {
  applyTitle?: boolean;
  applyDescription?: boolean;
  applyPriority?: boolean;
  addAcceptanceCriteriaToDescription?: boolean;
  addSubtasksToChecklist?: boolean;
  edited?: {
    title?: string;
    description?: string;
    acceptanceCriteria?: string[];
    suggestedSubtasks?: string[];
    priority?: TaskPriority;
  };
};
```

Response:

```ts
type ApplyAiSuggestionResponse = ApiSuccess<{
  task: TaskDetail;
  board: BoardSnapshot;
  suggestion: {
    id: ID;
    status: "accepted" | "partially_applied";
    appliedAt: string;
  };
}>;
```

### POST /api/tasks/:taskId/ai/suggestions/:suggestionId/reject

Response:

```ts
type RejectAiSuggestionResponse = ApiSuccess<{
  suggestion: {
    id: ID;
    status: "rejected";
  };
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
