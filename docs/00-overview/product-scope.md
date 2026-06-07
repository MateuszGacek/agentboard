# Product Scope

## Product

**AgentBoard** — AI Kanban for software teams shipping with agents.

## MVP objective

Deliver a working, responsive, deployed Kanban SaaS that demonstrates full product ownership.

The MVP must feel like a real product, even if some advanced functionality is intentionally postponed.

## User roles

### MVP roles

| Role      | Description                       | Permissions                            |
| --------- | --------------------------------- | -------------------------------------- |
| Owner     | Creator of workspace              | Full access in own workspace           |
| Member    | Workspace collaborator            | Read/write board data                  |
| Demo user | Temporary public reviewer session | Full access to isolated demo workspace |

### Postponed roles

- Admin/member granular permissions.
- Read-only viewer.
- Guest/client reviewer.

## Information architecture

```txt
Workspace
  Project
    Board
      Column
        Task
```

### Workspace

A workspace represents an agency/team.

MVP:

- user can have at least one workspace,
- demo session creates an isolated demo workspace,
- workspace switcher can be simple if only one workspace exists.

### Project

A project represents client/product delivery.

MVP:

- create/list/update/archive/restore project,
- newly-created projects receive one default board,
- project cards open the primary board,
- default seeded project: `AI Client Automation`.

### Board

A board represents the workflow for a project.

MVP:

- one default board per project,
- default columns,
- WIP limits,
- task movement.

### Column

A column represents a workflow stage.

Default columns:

| Display name | Stable system key | Behavior         | Default WIP |
| ------------ | ----------------- | ---------------- | ----------: |
| Backlog      | `backlog`         | `none`           |        null |
| Ready        | `ready`           | `none`           |           8 |
| In Progress  | `in_progress`     | `starts_work`    |           3 |
| Review       | `review`          | `active`         |           4 |
| Blocked      | `blocked`         | `blocks_work`    |        null |
| Done         | `done`            | `completes_work` |        null |

Important:

- Column display names can be translated or renamed.
- Metrics must use `system_key` / `behavior`, not display name.
- For MVP, column create/delete/reorder can be postponed to v1.1 if board/task vertical slice needs stability first.
- WIP limit editing is MVP.

### Task

A task is the core work item.

MVP fields:

- title,
- description,
- column,
- position,
- priority,
- assignees,
- labels,
- due date,
- blocked flag/reason,
- checklist,
- comments,
- activity events,
- created/updated/completed timestamps.

## Functional requirements

### Authentication

Must support:

- register,
- login,
- logout,
- current session endpoint,
- one-click demo session.

Demo session requirement:

- clicking **Open demo workspace** creates or resets an isolated demo workspace for that session,
- no shared global mutable demo board for all reviewers,
- demo data should be seeded consistently.

### App shell

Must include:

- sidebar navigation,
- topbar with workspace/project context,
- theme switch: light/dark/system,
- language switch: EN/PL/CS,
- user menu/logout,
- command menu shell if time allows.

Command menu is v1.1 if time is limited.

### Projects

Must support:

- listing real DB-backed projects in the active workspace,
- creating a project with a default board,
- choosing a static project template during creation,
- seeding non-blank templates with persisted starter tasks, labels, checklist items, and
  activity,
- editing, archiving, and restoring projects,
- opening the project board,
- empty state that leads normal registered users into the first project/board/task flow.

### Dashboard

Dashboard should be useful but not overbuilt.

MVP metrics:

- total active tasks,
- completed this week,
- overdue active tasks,
- blocked tasks,
- WIP limit issues,
- completion rate,
- tasks by workflow status,
- tasks by priority.

The dashboard also includes a deterministic weekly report panel with copy-ready markdown
for client/status updates. It is generated from database state and does not call AI.

Definitions:

- Active task: task in a non-done column and not archived.
- Completed task: task in a column with `behavior = completes_work`.
- Overdue task: due date is before today, task is not completed.
- WIP issue: a column has a non-null WIP limit and active task count exceeds that limit.

### Board

Must support:

- board snapshot loading,
- horizontal desktop Kanban layout,
- mobile column tabs/list layout,
- quick saved views and browser-local custom saved views based on URL filters,
- create task,
- edit task,
- delete task with confirmation,
- move task between columns,
- reorder task within column,
- WIP limit warning,
- priority/label/assignee/due-date display,
- loading/error/empty states.

Movement rules:

- desktop: drag/drop using dnd-kit,
- mobile: “Move to...” menu/action sheet,
- movement is persisted transactionally,
- API returns fresh board snapshot or affected ordered task lists,
- `completed_at` is set/cleared based on target column behavior.

### Task detail

Task detail is the product centerpiece.

Desktop:

- right-side sheet/drawer.

Mobile:

- full-height sheet/dialog.

Sections:

1. Title and description.
2. Core metadata: priority, assignee, due date, labels, blocked state.
3. Checklist.
4. Comments.
5. Activity log.
6. AI Improve.

Board-level AI next actions are available as a review-first helper. Suggestions are
transient and only become persisted work when the user creates a task from a suggestion.

The task detail sheet should avoid overcrowding by using collapsible sections if needed.

### Search and filters

MVP filters:

- query text,
- priority,
- assignee,
- label,
- blocked,
- due date state,
- column/status.

Preferred behavior:

- filters stored in URL search params,
- TanStack Router validates search params,
- clear “Reset filters” action.

### AI Improve

MVP AI feature:

- button in task detail: **Improve with AI**,
- backend sends task context to OpenAI,
- response uses structured JSON,
- UI shows side-by-side original vs improved,
- user can accept all, apply selected parts, edit before apply, reject.

AI output should include:

- improved title,
- improved description,
- acceptance criteria,
- suggested subtasks,
- risk notes,
- priority recommendation,
- confidence score.

### i18n

Required UI languages:

- English: `en`,
- Polish: `pl`,
- Czech: `cs`.

Scope:

- all UI text must be translated,
- seeded demo task content can remain English,
- dates/numbers should use selected/browser locale.

Default language resolution:

1. stored user preference/localStorage,
2. browser language,
3. fallback `en`.

### Theme

Required modes:

- light,
- dark,
- system.

Theme preference order:

1. user localStorage preference,
2. system preference,
3. fallback light.

## Non-functional requirements

### Performance

- App should feel instant on demo data.
- Board interactions should avoid unnecessary full-page reloads.
- Use skeletons and optimistic UI only where rollback is handled.
- Keep bundle reasonable; avoid dependency bloat.

### Accessibility

- Keyboard focus visible.
- Dialogs/sheets close with Escape.
- Form fields have labels.
- Buttons have clear accessible names.
- Drag/drop must have a non-drag fallback.

### Security baseline

- httpOnly session cookies.
- secure cookies in production.
- sameSite lax.
- password hashing.
- workspace membership validation on every API request.
- no secrets in Git.
- OpenAI API used backend-only.

## MVP vs v1.1

### MVP must-have

- auth/demo,
- workspace/project/board data model,
- board vertical slice,
- task detail sheet,
- WIP limits,
- dashboard,
- AI Improve,
- translations,
- theme,
- responsive UX,
- Docker/Coolify deployment.

### v1.1 if time remains

- command menu full functionality,
- column CRUD/reorder,
- multiple project templates,
- AI suggestion history screen,
- dashboard drill-down links,
- advanced search syntax,
- rich text descriptions.

### v2

- realtime collaboration,
- file uploads,
- email invites,
- role-based access control,
- public API,
- billing.
