# Kanban Task Detail Polish Audit

## Summary

Task Detail Polish audit completed on June 6, 2026.

The task detail sheet is recruiter-ready as code. It loads task detail through the real
task API, renders the expected task fields and supporting sections, uses shared
contracts and DB-backed mutations, preserves workspace membership checks, and passes the
required static validation suite.

No migrations, seed, or DB-backed smoke tests were run because this audit did not
confirm an explicitly safe local PostgreSQL `DATABASE_URL`.

## Status

PASS

## Command results

| Command                                  | Result  | Notes                                      |
| ---------------------------------------- | ------- | ------------------------------------------ |
| `pnpm typecheck`                         | PASS    | Workspace TypeScript checks passed.        |
| `pnpm lint`                              | PASS    | ESLint passed with zero warnings.          |
| `pnpm build`                             | PASS    | Workspace build passed; Vite build passed. |
| `pnpm format:check`                      | PASS    | Prettier check passed.                     |
| `pnpm --filter @kanban/web typecheck`    | PASS    | Web package typecheck passed.              |
| `pnpm --filter @kanban/web build`        | PASS    | Web package build passed.                  |
| `pnpm --filter @kanban/api typecheck`    | PASS    | API package typecheck passed.              |
| `pnpm --filter @kanban/api build`        | PASS    | API package build passed.                  |
| `pnpm --filter @kanban/shared typecheck` | PASS    | Shared package typecheck passed.           |
| `pnpm --filter @kanban/shared build`     | PASS    | Shared package build passed.               |
| `pnpm --filter @kanban/db typecheck`     | PASS    | DB package typecheck passed.               |
| `pnpm --filter @kanban/db build`         | PASS    | DB package build passed.                   |
| `pnpm format`                            | PASS    | Formatted audit/status markdown updates.   |
| `pnpm format:check`                      | PASS    | Final Prettier check passed after docs.    |
| `pnpm db:migrate`                        | NOT_RUN | No explicitly confirmed safe local DB URL. |
| `pnpm db:seed`                           | NOT_RUN | No explicitly confirmed safe local DB URL. |

## UI audit

- PASS: Task detail loads through `useTaskDetail`, which calls `GET /api/tasks/:taskId`.
- PASS: No fake frontend-only task data is used in the board or task detail flow.
- PASS: Title, description, priority, due date, blocked state, and blocked reason are
  visible and editable in the detail sheet.
- PASS: Column/status is visible and changeable through the existing move endpoint.
- PASS: Labels are visible and assignable/unassignable from board-provided
  `availableLabels`.
- PASS: Assignees are visible and assignable/unassignable from board-provided
  `availableMembers`.
- PASS: Checklist items are visible, can be added, and can be toggled.
- PASS: Comments are visible and can be added.
- PASS: Activity log is visible from API-backed activity events.
- PASS: Created-by, created-at, started-at, and completed-at metadata are visible.
- PASS: Empty checklist, empty comments, empty activity, empty labels, and empty
  assignees states exist.
- PASS: Loading and error/retry states exist for task detail.
- PASS: Saving state is represented across task update, move, checklist, and comment
  mutations.
- PASS: Board rendering, drag/drop movement, mobile move fallback, task creation, and
  task detail opening remain API-backed.

## API/backend audit

- PASS: `GET /api/tasks/:taskId` loads task detail from DB state and reuses
  `getBoardSnapshot`, which validates workspace membership.
- PASS: `PATCH /api/tasks/:taskId` remains DB-backed and validates workspace membership,
  assignee workspace membership, and label workspace ownership.
- PASS: `POST /api/tasks/:taskId/checklist-items` is DB-backed, requires auth, validates
  task existence, validates workspace membership, updates board version, returns fresh
  task detail plus board snapshot, and writes a `checklist.created` activity event.
- PASS: `PATCH /api/tasks/checklist-items/:itemId` is DB-backed, requires auth, validates
  item existence, validates the parent task is active and in the same workspace, validates
  workspace membership, updates board version, returns fresh task detail plus board
  snapshot, and writes `checklist.completed` when completing an item.
- PASS: `POST /api/tasks/:taskId/comments` is DB-backed, requires auth, validates task
  existence, validates workspace membership, updates board version, returns fresh task
  detail plus board snapshot, and writes a `comment.created` activity event.
- PASS: Shared Zod contracts exist for task updates, checklist item creation/update, and
  comment creation.
- PASS: New API responses keep the standard success envelope via `success(...)`.
- PASS: No dashboard API, AI API, or deployment work was started during task detail
  polish.

## i18n audit

- PASS: Task detail visible UI strings use translation keys.
- PASS: English, Polish, and Czech locale files have matching key coverage.
- PASS: New keys cover task detail sections, checklist, comments, activity, assignees,
  labels, empty states, loading/retry states, save states, blocked labels, metadata
  labels, and activity event labels.
- NOTE: Dynamic user, task, label, board, project, and column names are DB content and are
  correctly rendered as data, not translation keys.

## Mobile/responsive audit

- PASS: Task detail sheet is full-width and full-height on mobile, with internal
  scrolling.
- PASS: Detail content uses stacked layout by default and moves to two-column groups only
  at `sm` breakpoints.
- PASS: Checklist add form stacks on mobile and becomes horizontal at `sm`.
- PASS: Board still uses grid columns on mobile and desktop horizontal scrolling only at
  larger viewports.
- PASS: Mobile status movement is available through the native select fallback instead
  of drag/drop.

## Critical blockers

None.

## Quality improvements

- DB-backed runtime smoke should be run once a safe local or staging `DATABASE_URL` is
  explicitly confirmed.
- Checklist delete/reorder and comment edit/delete remain reasonable future refinements,
  but they are not blockers for this task detail polish audit.
- Activity event copy is currently type-based and compact; richer metadata-aware
  summaries could improve polish later.

## Decision

`START_DASHBOARD`

## Exact next prompt

```txt
Continue the Kanban project from the current repository state.

Read AGENTS.md, STATUS.md, TASK_DETAIL_AUDIT.md, LOCAL_PRODUCT_AUDIT.md, docs/index.md, docs/02-implementation/implementation-plan.md, docs/02-implementation/acceptance-criteria.md, docs/01-architecture/api-contracts.md, and docs/01-architecture/frontend-ui-system.md.

Decision from the task detail polish audit: START_DASHBOARD.

Start the dashboard phase only.

Scope:
- Do not deploy.
- Do not start AI.
- Do not add fake frontend-only dashboard data.
- Keep OPENAI_API_KEY backend-only and unused.
- Preserve workspace boundaries on every dashboard query.
- Use DB-backed metrics only.

Dashboard goals:
- Implement the dashboard API and UI from the existing acceptance criteria and API contracts.
- Show DB-calculated total active tasks, completed this week, overdue tasks, blocked tasks, completion rate, WIP issues, tasks by status, tasks by priority, and recently completed tasks.
- Add loading, error, empty, and responsive states.
- Add EN/PL/CS translation keys for all visible dashboard UI text.
- Do not implement AI Improve, search/filter expansion, realtime, file uploads, billing, or deployment changes.

Validation:
- Run pnpm typecheck
- Run pnpm lint
- Run pnpm build
- Run pnpm format:check
- Run relevant package checks if files changed

Update STATUS.md with the dashboard implementation result, command results, remaining gaps, and the exact next recommended action.
```
