# Kanban Local Product Readiness Audit

## Summary

Local product readiness audit completed on June 6, 2026.

The repository has a working TypeScript monorepo foundation, guarded PostgreSQL
database package, Hono API, Vite React shell, and DB-backed board vertical slice as
code. Static validation passes. No migrations, seed, or DB-backed smoke tests were
run because this audit did not confirm an explicitly safe local PostgreSQL
`DATABASE_URL`.

The deployment baseline exists but is parked. The next safest product step is task
detail polish, not dashboard, AI, or deployment.

## Current phase status

| Area                           | Status  | Evidence                                                                                                                                                                                                                               | Missing / Risk                                                                                                                                                      | Decision                                                                              |
| ------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Phase 0 - Repo foundation      | PASS    | `pnpm-workspace.yaml`, root scripts, package structure, TypeScript, ESLint, Prettier, and lockfile exist. Root and package checks pass.                                                                                                | None blocking.                                                                                                                                                      | Keep foundation unchanged.                                                            |
| Phase 1 - Database             | PASS    | Drizzle schema, migration, guarded `getRequiredDatabaseUrl`, indexes/FKs, and idempotent seed upserts exist in `packages/db`.                                                                                                          | DB runtime smoke was not run without a confirmed safe local `DATABASE_URL`. AI schema tables exist as planned foundation only.                                      | Do not run DB commands until safe local DB is explicit.                               |
| Phase 2 - API                  | PASS    | Hono app exposes `/api/health` without DB; DB-backed `/auth`, `/boards`, and `/tasks` return 503 when DB is not configured. Auth, demo login, sessions, ownership checks, board snapshot, structured errors, and task mutations exist. | No automated API smoke tests. Move request accepts `boardVersion` but does not enforce conflict semantics yet.                                                      | Continue product work; do not broaden API scope except where task detail requires it. |
| Phase 3 - Frontend shell       | PASS    | Vite React, TanStack Router, TanStack Query, API client, auth screens, protected routes, app shell, theme, and EN/PL/CS i18n exist in `apps/web`.                                                                                      | Shell routes for workspaces/projects/settings remain placeholders by design.                                                                                        | Keep shell stable.                                                                    |
| Phase 4 - Board vertical slice | PASS    | Board loads from `/api/boards/:boardId`; columns/tasks are DB-backed; create/edit/delete/detail/move/reorder flows call task APIs; WIP warnings and mobile "Move to" fallback exist.                                                   | Task detail is shallow: API returns checklist, comments, and activity, but UI only shows counts/created date and edits core fields. No local DB smoke test was run. | Start task detail polish before dashboard or AI.                                      |
| Task detail depth              | PARTIAL | Detail sheet edits title, description, priority, due date, blocked state, move target, and delete/archive.                                                                                                                             | Checklist/comment/activity surfaces are not rendered deeply or editable. Assignees/labels are visible on cards but not editable in the sheet.                       | `START_TASK_DETAIL_POLISH`.                                                           |
| Deployment baseline            | PASS    | `Dockerfile`, `docker-compose.yml`, `docker/entrypoint.sh`, single-domain `/api/*` plus SPA serving model, and `/api/health` healthcheck exist.                                                                                        | Production URL has not been verified. Compose/env include future AI env keys even though AI product work is not implemented.                                        | Park deployment until local product is recruiter-ready.                               |

## Command results

Commands run on June 6, 2026:

| Command                                  | Result | Notes                                               |
| ---------------------------------------- | ------ | --------------------------------------------------- |
| `pnpm typecheck`                         | PASS   | Workspace TypeScript checks passed.                 |
| `pnpm lint`                              | PASS   | ESLint passed with zero warnings.                   |
| `pnpm build`                             | PASS   | Workspace build passed; web Vite build completed.   |
| `pnpm format:check`                      | PASS   | Initial pre-edit format check passed.               |
| `pnpm --filter @kanban/web typecheck`    | PASS   | Web package typecheck passed.                       |
| `pnpm --filter @kanban/web build`        | PASS   | Web package build passed.                           |
| `pnpm --filter @kanban/api typecheck`    | PASS   | API package typecheck passed.                       |
| `pnpm --filter @kanban/api build`        | PASS   | API package build passed.                           |
| `pnpm --filter @kanban/shared typecheck` | PASS   | Shared package typecheck passed.                    |
| `pnpm --filter @kanban/shared build`     | PASS   | Shared package build passed.                        |
| `pnpm --filter @kanban/db typecheck`     | PASS   | DB package typecheck passed.                        |
| `pnpm --filter @kanban/db build`         | PASS   | DB package build passed.                            |
| `pnpm format:check`                      | FAIL   | First post-edit run found markdown wrapping drift.  |
| `pnpm format`                            | PASS   | Formatted `LOCAL_PRODUCT_AUDIT.md` and `STATUS.md`. |
| `pnpm typecheck`                         | PASS   | Final post-edit workspace TypeScript checks passed. |
| `pnpm lint`                              | PASS   | Final post-edit ESLint check passed.                |
| `pnpm build`                             | PASS   | Final post-edit workspace build passed.             |
| `pnpm format:check`                      | PASS   | Final post-edit format check passed.                |

Not run:

| Command           | Result  | Notes                                                         |
| ----------------- | ------- | ------------------------------------------------------------- |
| `pnpm db:migrate` | NOT_RUN | No explicitly confirmed safe local PostgreSQL `DATABASE_URL`. |
| `pnpm db:seed`    | NOT_RUN | No explicitly confirmed safe local PostgreSQL `DATABASE_URL`. |

## Product blockers

No foundation blocker prevents continuing local product work.

The following product gap blocks recruiter-ready local completion:

- Severity: Medium
- Area: Task detail depth
- Problem: Task detail is functionally present but shallow.
- Why it matters: The product positions task detail as the core UX surface, and the
  API already exposes checklist, comments, and activity that the UI mostly hides.
- Recommended fix: Polish task detail only: render checklist, comments, activity,
  labels, assignees, metadata, and useful empty states from real API data. Add
  mutation support only if it is narrowly required by the existing contracts.
- Exact files:
  - `apps/web/src/features/boards/board-page.tsx`
  - `apps/web/src/features/boards/board-queries.ts`
  - `apps/api/src/modules/tasks/detail.ts`
  - `apps/api/src/modules/tasks/routes.ts`
  - `packages/shared/src/api/contracts.ts`
  - `apps/web/src/i18n/locales/en/common.json`
  - `apps/web/src/i18n/locales/pl/common.json`
  - `apps/web/src/i18n/locales/cs/common.json`

## Deployment status

Deployment baseline is present and parked until the local product is complete and
stable. Do not deploy, do not continue Coolify/OVH/Cloudflare work, and do not make
deployment the next step.

Current deployment evidence:

- `Dockerfile` builds the monorepo and runs the API container.
- `docker-compose.yml` defines the app and PostgreSQL services.
- `docker/entrypoint.sh` waits for DB, runs migrations, optionally seeds, then starts.
- `/api/health` works without DB because it is registered before DB-backed routes.
- Production SPA serving exists in `apps/api/src/app.ts` for `NODE_ENV=production`.
- Documentation references the deployment target as unverified, not live.

## Scope violations

- No dashboard UI/API implementation was found.
- No AI API route or frontend AI workflow was found.
- AI-related schema, seed content, shared enum values, and environment placeholders
  exist as planned future foundation. These should remain dormant until the AI phase.
- Deployment baseline exists earlier than the renewed local-product-first plan, but it
  is now parked and should not be extended.
- No fake frontend Kanban data was found in the board implementation.
- No committed real secrets or real API keys were found.

## Decision

`START_TASK_DETAIL_POLISH`

Rationale: core checks pass and the board vertical slice is implemented as real
DB-backed code. The board can continue locally, but the task detail surface is still
too shallow for the next recruiter-ready product step. Dashboard, AI, final polish,
and deployment must wait.

## Exact next prompt

```txt
Continue the Kanban project from the current repository state.

Read AGENTS.md, STATUS.md, LOCAL_PRODUCT_AUDIT.md, docs/index.md, docs/02-implementation/implementation-plan.md, docs/02-implementation/acceptance-criteria.md, docs/01-architecture/api-contracts.md, and docs/01-architecture/frontend-ui-system.md.

Decision from the local product audit: START_TASK_DETAIL_POLISH.

Implement only task detail polish for the existing DB-backed board vertical slice.

Scope:
- Keep deployment parked.
- Do not deploy.
- Do not start dashboard.
- Do not start AI.
- Do not add fake frontend-only task data.
- Preserve workspace boundaries on every mutation.
- Keep OPENAI_API_KEY backend-only and unused.

Task detail goals:
- Improve the existing task detail sheet in apps/web/src/features/boards/board-page.tsx.
- Render richer real API task detail data already returned by GET /api/tasks/:taskId:
  checklist items, comments, activity, labels, assignees, created/started/completed metadata, blocked state, due date, and priority.
- Add polished empty/loading/error states.
- Add i18n strings for EN/PL/CS.
- Only add or adjust API/shared contracts if narrowly required for task detail polish.
- Do not implement dashboard metrics, AI improve, search/filter, realtime, billing, or deployment changes.

Validation:
- Run pnpm typecheck
- Run pnpm lint
- Run pnpm build
- Run pnpm format:check
- Run relevant package checks if files changed

Update STATUS.md with the task detail polish result, command results, remaining gaps, and the exact next recommended action.
```

## Update STATUS.md

`STATUS.md` was updated with:

- local product audit date,
- current product status,
- deployment parked note,
- command results,
- decision,
- reference to `LOCAL_PRODUCT_AUDIT.md`,
- exact next recommended action.
