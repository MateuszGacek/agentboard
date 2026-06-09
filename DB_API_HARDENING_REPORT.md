# DB/API Hardening Report

Date: June 6, 2026

Mode: `DB_API_HARDENING`

## Summary

DB/API hardening was completed as a narrow local-only pass. No deployment, SSH, live
server changes, fake data, or architecture rewrite was performed.

## Changes Made

- Tightened board snapshot loading so the board/project join requires matching
  workspace ownership.
- Tightened board snapshot column and task queries to require the board workspace and
  project scope.
- Tightened task movement source-column lookup so both source and target columns must
  belong to the task board/workspace and be unarchived.
- Tightened task detail child queries for checklist, comments, and activity to include
  the task workspace.
- Tightened AI suggestion apply so the task board must still match the task project and
  suggestion workspace before mutation.
- Tightened AI suggestion reject so the related task must still exist, belong to the
  suggestion workspace, and be unarchived before writing activity.
- Updated database documentation to include the added relation/activity/AI indexes.

## Schema/Migration Changes

Generated migration:

- `packages/db/migrations/0001_skinny_war_machine.sql`

Schema changes are index-only. No tables, columns, enums, foreign keys, or seed payloads
were structurally changed.

## Indexes Added

- `idx_task_assignees_task` on `task_assignees(task_id)`.
- `idx_task_labels_task` on `task_labels(task_id)`.
- `idx_comments_workspace_task_created` on
  `task_comments(workspace_id, task_id, created_at)`.
- `idx_checklist_workspace_task_position` on
  `task_checklist_items(workspace_id, task_id, position)`.
- `idx_activity_workspace_created` on
  `task_activity_events(workspace_id, created_at desc)`.
- `idx_activity_workspace_task_created` on
  `task_activity_events(workspace_id, task_id, created_at desc)`.
- `idx_ai_suggestions_workspace_task_created` on
  `ai_suggestions(workspace_id, task_id, created_at desc)`.
- `idx_ai_suggestions_workspace_status` on `ai_suggestions(workspace_id, status)`.

## Ownership Validation Findings

- Board snapshot routes already require authentication and workspace membership through
  `getBoardSnapshot`; joins and child queries are now stricter about workspace/project
  consistency.
- Task create/update/delete/move routes already validate authentication, workspace
  membership, target columns, assignees, and labels; task move now also validates the
  source column against board/workspace/archived state.
- Checklist and comment mutations already validate the parent task and workspace
  membership; task detail reads now include workspace predicates for child rows.
- Dashboard already validates workspace membership and optional project scope before
  querying metrics.
- AI generation already validates task, workspace membership, and task column ownership.
- AI apply/reject now additionally validates the nested task/board relationship before
  mutating suggestion state or activity.

## Seed Changes

No seed data changes were needed.

The existing seed already demonstrates realistic AI agency work, due dates, WIP warning
conditions, blocked work, labels, comments, checklist items, activity, and an AI
suggestion sample while remaining idempotent.

## API Consistency Changes

- Standard success/error envelope behavior remains unchanged.
- Route-level validation remains Zod-backed through shared contracts or UUID schemas.
- `/api/health` remains intentionally outside the success envelope as a health endpoint
  and matches the documented `HealthResponse` contract.

## Smoke Results

### Static Validation

| Command                                  | Result | Notes                                                         |
| ---------------------------------------- | ------ | ------------------------------------------------------------- |
| `pnpm typecheck`                         | PASS   | Workspace TypeScript checks passed.                           |
| `pnpm lint`                              | PASS   | ESLint passed with zero warnings.                             |
| `pnpm build`                             | PASS   | Workspace build passed; Vite production build passed.         |
| `pnpm format:check`                      | PASS   | Prettier check passed after formatting changed files.         |
| `pnpm --filter @kanban/db typecheck`     | PASS   | DB package typecheck passed.                                  |
| `pnpm --filter @kanban/db build`         | PASS   | DB package build passed.                                      |
| `pnpm --filter @kanban/shared typecheck` | PASS   | Shared package typecheck passed.                              |
| `pnpm --filter @kanban/shared build`     | PASS   | Shared package build passed.                                  |
| `pnpm --filter @kanban/api typecheck`    | PASS   | API package typecheck passed.                                 |
| `pnpm --filter @kanban/api build`        | PASS   | API package build passed.                                     |
| `pnpm db:generate`                       | PASS   | Generated index-only migration `0001_skinny_war_machine.sql`. |

### Local Runtime Checks

`.env.local` was checked and confirmed to contain an explicitly local `DATABASE_URL`.
The shell-level `DATABASE_URL` was unset, so runtime DB commands were run only after
loading `.env.local`.

| Command/check                       | Result | Notes                                                                          |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Local Postgres container health     | PASS   | `kanban-postgres-1` was healthy on `127.0.0.1:5432`.                           |
| `pnpm db:migrate`                   | PASS   | Applied the new index migration against the local database.                    |
| `pnpm db:seed`                      | PASS   | Demo seed completed.                                                           |
| `pnpm db:seed` second pass          | PASS   | Demo seed completed again.                                                     |
| Seed idempotency count check        | PASS   | Shared demo seed retained 1 workspace, 1 project, 1 board, 13 tasks, 5 labels. |
| Local API startup                   | PASS   | API listened on `http://localhost:3000/api`.                                   |
| `GET /api/health`                   | PASS   | Returned `ok: true`.                                                           |
| `POST /api/auth/demo`               | PASS   | Created an isolated demo session and returned demo IDs.                        |
| `GET /api/boards/:boardId`          | PASS   | Returned a board snapshot for the isolated demo board.                         |
| `GET /api/workspaces/:id/dashboard` | PASS   | Returned dashboard metrics for the isolated demo workspace.                    |

The isolated demo smoke returned 5 board columns, 5 board tasks, 5 dashboard metric
cards, and 0 WIP warnings. The shared seed idempotency check retained the richer
13-task WIP-risk demo data.

Two count-check attempts failed before the final passing check because of shell quoting
and package-context issues in the verification command. They did not mutate data and
were corrected safely.

## Remaining Risks

- Checklist deletion/reordering and comment edit/delete remain future task-detail
  refinements, not blockers for the current slice.
- Real AI provider smoke still requires a backend-only `OPENAI_API_KEY`; the verified
  local path remains graceful AI unavailable when the key is unset.
- Production deployment remains blocked by external Coolify/Traefik routing and
  certificate state.
