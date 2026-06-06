# Database

## Database

PostgreSQL with Drizzle ORM.

Use UUID primary keys and timestamp columns.

Recommended timestamp names:

```txt
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Use application or DB triggers to keep `updated_at` fresh.

## Schema overview

```txt
users
sessions
workspaces
workspace_members
projects
boards
columns
tasks
task_assignees
labels
task_labels
task_comments
task_checklist_items
task_activity_events
ai_suggestions
```

## Stable Kanban semantics

Do not infer status from a column display name.

Columns must contain stable semantics:

```ts
type ColumnSystemKey =
  | "backlog"
  | "ready"
  | "in_progress"
  | "review"
  | "blocked"
  | "done"
  | "custom";

type ColumnBehavior = "none" | "starts_work" | "active" | "blocks_work" | "completes_work";
```

Rules:

- `system_key` is stable and not translated.
- `name` is display text and can be translated/renamed.
- `behavior = completes_work` defines done/completed metrics.
- `behavior = blocks_work` defines blocked-column metrics.
- Moving into a completes-work column sets `tasks.completed_at` if null.
- Moving out of a completes-work column clears `completed_at`.
- Moving into a starts-work/active/review column sets `started_at` if null.

## Tables

### users

```ts
users = {
  id: uuid primary key,
  name: text not null,
  email: text not null unique,
  password_hash: text,
  avatar_url: text,
  locale: text, // en | pl | cs | null
  theme: text, // light | dark | system | null
  is_demo: boolean not null default false,
  created_at: timestamptz not null,
  updated_at: timestamptz not null
}
```

`password_hash` can be null for demo users if demo accounts are session-only.

### sessions

```ts
sessions = {
  id: uuid primary key,
  user_id: uuid not null references users(id) on delete cascade,
  token_hash: text not null unique,
  expires_at: timestamptz not null,
  created_at: timestamptz not null,
  last_used_at: timestamptz
}
```

Session token stored in cookie must be random and only hash is stored in DB.

### workspaces

```ts
workspaces = {
  id: uuid primary key,
  name: text not null,
  slug: text not null unique,
  created_by: uuid references users(id),
  is_demo: boolean not null default false,
  created_at: timestamptz not null,
  updated_at: timestamptz not null
}
```

### workspace_members

```ts
workspace_members = {
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  user_id: uuid not null references users(id) on delete cascade,
  role: text not null, // owner | member
  created_at: timestamptz not null,
  primary key (workspace_id, user_id)
}
```

### projects

```ts
type ProjectStatus = 'active' | 'archived';

projects = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  name: text not null,
  description: text,
  status: ProjectStatus not null default 'active',
  created_by: uuid references users(id),
  created_at: timestamptz not null,
  updated_at: timestamptz not null,
  archived_at: timestamptz
}
```

### boards

```ts
boards = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  project_id: uuid not null references projects(id) on delete cascade,
  name: text not null,
  description: text,
  version: integer not null default 1,
  created_at: timestamptz not null,
  updated_at: timestamptz not null
}
```

`version` increments on task movement/column changes and helps avoid stale UI assumptions.

### columns

```ts
columns = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  board_id: uuid not null references boards(id) on delete cascade,
  name: text not null,
  system_key: ColumnSystemKey not null,
  behavior: ColumnBehavior not null,
  position: integer not null,
  wip_limit: integer,
  color_key: text not null default 'slate',
  is_archived: boolean not null default false,
  created_at: timestamptz not null,
  updated_at: timestamptz not null
}
```

Constraints:

- `(board_id, position)` unique if practical.
- One default `done` column per board in seed.
- WIP limit null means no limit.

### tasks

```ts
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

tasks = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  project_id: uuid not null references projects(id) on delete cascade,
  board_id: uuid not null references boards(id) on delete cascade,
  column_id: uuid not null references columns(id),
  title: text not null,
  description: text,
  priority: TaskPriority not null default 'medium',
  position: integer not null,
  is_blocked: boolean not null default false,
  blocked_reason: text,
  due_date: date,
  created_by: uuid references users(id),
  started_at: timestamptz,
  completed_at: timestamptz,
  archived_at: timestamptz,
  created_at: timestamptz not null,
  updated_at: timestamptz not null
}
```

Rules:

- Task belongs redundantly to workspace/project/board for faster checks and queries.
- API must validate consistency with board/project/workspace.
- `position` is per column.
- For MVP, use integer positions and compact/recompute affected columns during move.

### task_assignees

```ts
task_assignees = {
  task_id: uuid not null references tasks(id) on delete cascade,
  user_id: uuid not null references users(id) on delete cascade,
  created_at: timestamptz not null,
  primary key (task_id, user_id)
}
```

Rule: assignee must be a member of the task workspace.

### labels

```ts
labels = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  name: text not null,
  color_key: text not null,
  created_at: timestamptz not null,
  updated_at: timestamptz not null
}
```

`color_key` must be constrained to semantic values, not arbitrary CSS injection.

### task_labels

```ts
task_labels = {
  task_id: uuid not null references tasks(id) on delete cascade,
  label_id: uuid not null references labels(id) on delete cascade,
  primary key (task_id, label_id)
}
```

Rule: label and task must belong to the same workspace.

### task_comments

```ts
task_comments = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  task_id: uuid not null references tasks(id) on delete cascade,
  author_id: uuid references users(id),
  body: text not null,
  created_at: timestamptz not null,
  updated_at: timestamptz not null,
  deleted_at: timestamptz
}
```

### task_checklist_items

```ts
task_checklist_items = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  task_id: uuid not null references tasks(id) on delete cascade,
  title: text not null,
  is_done: boolean not null default false,
  position: integer not null,
  created_at: timestamptz not null,
  updated_at: timestamptz not null,
  completed_at: timestamptz
}
```

### task_activity_events

```ts
type ActivityEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.moved'
  | 'task.completed'
  | 'task.reopened'
  | 'task.blocked'
  | 'task.unblocked'
  | 'comment.created'
  | 'checklist.created'
  | 'checklist.completed'
  | 'ai.suggestion_created'
  | 'ai.suggestion_applied'
  | 'ai.suggestion_rejected';

task_activity_events = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  task_id: uuid not null references tasks(id) on delete cascade,
  actor_id: uuid references users(id),
  type: ActivityEventType not null,
  metadata: jsonb not null default '{}',
  created_at: timestamptz not null
}
```

MVP can log major actions only.

### ai_suggestions

```ts
type AiSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'partially_applied' | 'failed';

ai_suggestions = {
  id: uuid primary key,
  workspace_id: uuid not null references workspaces(id) on delete cascade,
  task_id: uuid not null references tasks(id) on delete cascade,
  created_by: uuid references users(id),
  model: text not null,
  status: AiSuggestionStatus not null default 'pending',
  original_payload: jsonb not null,
  suggested_payload: jsonb,
  error_message: text,
  created_at: timestamptz not null,
  updated_at: timestamptz not null,
  applied_at: timestamptz
}
```

## Indexes

Required indexes:

```sql
-- Sessions
create index idx_sessions_user_id on sessions(user_id);
create index idx_sessions_expires_at on sessions(expires_at);

-- Membership/access
create index idx_workspace_members_user_workspace on workspace_members(user_id, workspace_id);
create index idx_workspace_members_workspace on workspace_members(workspace_id);

-- Projects/boards
create index idx_projects_workspace_status on projects(workspace_id, status);
create index idx_boards_workspace_project on boards(workspace_id, project_id);

-- Columns
create index idx_columns_board_position on columns(board_id, position);
create index idx_columns_workspace_board on columns(workspace_id, board_id);
create index idx_columns_board_system_key on columns(board_id, system_key);

-- Tasks board loading and movement
create index idx_tasks_board_column_position on tasks(board_id, column_id, position);
create index idx_tasks_workspace_board on tasks(workspace_id, board_id);
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_due_date on tasks(workspace_id, due_date);
create index idx_tasks_completed_at on tasks(workspace_id, completed_at);
create index idx_tasks_priority on tasks(workspace_id, priority);
create index idx_tasks_blocked on tasks(workspace_id, is_blocked);

-- Relations
create index idx_task_assignees_user on task_assignees(user_id);
create index idx_task_labels_label on task_labels(label_id);
create index idx_labels_workspace on labels(workspace_id);
create index idx_comments_task_created on task_comments(task_id, created_at);
create index idx_checklist_task_position on task_checklist_items(task_id, position);
create index idx_activity_task_created on task_activity_events(task_id, created_at desc);
create index idx_ai_suggestions_task_created on ai_suggestions(task_id, created_at desc);
```

Optional search index:

```sql
-- Optional if implementing PostgreSQL full-text search in MVP
create index idx_tasks_search_tsv on tasks using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
);
```

If full-text search is postponed, use simple case-insensitive filtering on small demo data and document the limitation.

## Transaction rules

### Task move/reorder

`POST /api/tasks/:taskId/move` must run in a transaction.

Steps:

1. Load task with workspace/board/column.
2. Validate user membership.
3. Validate target column belongs to same board/workspace.
4. Lock affected tasks or perform safe ordered update.
5. Remove task from source column ordering.
6. Insert task into target column at target index.
7. Recompute positions for affected source/target columns.
8. Update `started_at`/`completed_at`/blocked semantics based on target column behavior.
9. Increment `boards.version`.
10. Insert activity event.
11. Return fresh board snapshot.

### AI apply

AI apply must run in a transaction:

1. Validate suggestion belongs to task/workspace.
2. Apply selected fields.
3. Create checklist items if selected.
4. Update suggestion status.
5. Insert activity event.
6. Return updated task detail.

## Seed data

Seed must be idempotent.

Default seed should create:

- demo template workspace/project/board,
- default columns,
- 10–16 realistic tasks,
- 3–5 labels,
- 2–4 demo members,
- comments/checklist/activity for selected tasks.

Seed data must demonstrate:

- WIP warning in In Progress,
- at least one blocked task,
- at least one overdue task,
- at least one vague task for AI Improve,
- completed tasks for dashboard.

## Demo account policy

`POST /api/auth/demo` should create an isolated demo user/workspace per session.

Recommended behavior:

- create user `demo_<random>@agentboard.local`,
- create one workspace/project/board from template,
- create session with shorter TTL,
- mark user/workspace `is_demo = true`,
- cleanup demo users/workspaces older than `DEMO_CLEANUP_DAYS` during startup or seed.

This avoids multiple recruiters editing the same public demo board.

## Ownership validation

Every query/mutation must validate workspace access. Do not rely only on direct IDs.

Example task update validation:

```txt
user -> workspace_members -> workspace
request.task_id -> tasks.workspace_id
assert workspace_members.workspace_id == tasks.workspace_id
if assignee_ids provided: assert each user is member of same workspace
if label_ids provided: assert each label.workspace_id == task.workspace_id
```

Cross-workspace writes should return `404` or `403`. Prefer `404` for resource existence privacy, but keep behavior consistent.
