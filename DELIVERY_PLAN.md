# Kanban Delivery Plan

## Summary

Kanban is static-complete for the intended local recruiter slice: auth/demo login,
app shell, DB-backed board, task detail, dashboard, AI Improve integration path, i18n,
theme, responsive UI structure, and Docker/Coolify baseline are implemented as code.

The confusing part is delivery state wording: the product is not runtime-verified in
this shell because `DATABASE_URL` and `OPENAI_API_KEY` are unset. Deployment should
stay parked until a local DB-backed smoke test verifies the full product flow.

## Current state table

| Area                            | Status      | Evidence                                                                                                                                                                 | Runtime verified? | Risk                                                                                                          |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Repo foundation                 | DONE_STATIC | pnpm workspace, package scripts, TypeScript, ESLint, Prettier, lockfile, app/package folders. `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm format:check` pass. | No                | Low. Static foundation is stable.                                                                             |
| Database schema/migrations/seed | DONE_STATIC | Drizzle schema, migration, guarded `DATABASE_URL`, idempotent seed, indexes/FKs, sessions, board/task/detail/dashboard/AI tables.                                        | No                | Medium. Migrate/seed not run because no safe local DB URL is configured.                                      |
| API/auth/session                | DONE_STATIC | Hono app, `/api/health`, auth/register/login/logout/me/demo, httpOnly sessions, hashed tokens, workspace membership checks.                                              | No                | Medium. Auth flow needs DB-backed smoke.                                                                      |
| Frontend shell                  | DONE_STATIC | Vite React, TanStack Router/Query, protected shell, nav, auth pages, language/theme switches, placeholders for management routes.                                        | No                | Low. Product entry is present, but app shell was not browser-smoked here.                                     |
| Board vertical slice            | DONE_STATIC | `GET /api/boards/:boardId`, task create/update/delete/move, drag/drop, optimistic board updates, WIP warning, mobile status selector.                                    | No                | Medium. Needs real DB smoke for persistence and movement.                                                     |
| Task detail                     | DONE_STATIC | Task sheet renders API task detail, labels, assignees, checklist add/toggle, comments, activity, metadata, AI panel, delete/archive, loading/error/empty states.         | No                | Low to medium. Checklist delete/reorder and comment edit/delete are future refinements, not current blockers. |
| Dashboard                       | DONE_STATIC | `GET /api/workspaces/:workspaceId/dashboard` and `/app/dashboard` use DB-backed metrics with WIP, priority/status, due-soon, activity, empty/error states.               | No                | Medium. Metrics need smoke against seeded DB.                                                                 |
| AI Improve feature              | DONE_STATIC | Backend-only OpenAI Responses API call, structured validation, persisted suggestions, apply/reject endpoints, task-detail comparison UI, `AI_UNAVAILABLE` handling.      | No                | Medium. No real OpenAI smoke; unavailable state requires runtime check without key.                           |
| i18n EN/PL/CS                   | DONE_STATIC | Locale files exist and visible product areas use translation keys. Prior key coverage audit passed.                                                                      | No                | Low. Needs visual/mobile spot check for long strings.                                                         |
| Theme light/dark/system         | DONE_STATIC | Theme provider, localStorage preference, system mode, shell/auth controls.                                                                                               | No                | Low. Needs browser spot check.                                                                                |
| Responsive/mobile flow          | DONE_STATIC | Mobile shell drawer, responsive dashboard, full-height task sheet, mobile move fallback, responsive board layout classes.                                                | No                | Medium. Needs browser smoke at 360/768/1024/1440 widths.                                                      |
| Docker/Coolify baseline         | DONE_STATIC | `Dockerfile`, `docker-compose.yml`, `docker/entrypoint.sh`, healthcheck, production SPA serving, deployment docs. `docker build -t kanban-local .` passes.               | No                | Medium. Compose runtime and Coolify live smoke not run.                                                       |
| README/GitHub readiness         | DONE_STATIC | README is recruiter-facing; STATUS/final audit/docs describe scope and pending runtime gaps; no `.env` tracked; no real secret found in reviewed files.                  | No                | Low. README should get final status polish after local smoke.                                                 |
| Runtime smoke readiness         | BLOCKED     | Smoke plan is clear, but shell has `DATABASE_URL=UNSET` and `OPENAI_API_KEY=UNSET`.                                                                                      | No                | High until a safe local Postgres/database URL is configured.                                                  |

## What is done

- Monorepo foundation and static validation.
- PostgreSQL schema, migration, guarded DB client, and seeded demo data path.
- Auth/session API and demo login route.
- Protected frontend shell with EN/PL/CS i18n and light/dark/system theme controls.
- DB-backed board snapshot, task create/edit/archive, persisted movement/reorder, WIP warning, and mobile move fallback.
- Rich task detail sheet with API-backed checklist, comments, activity, metadata, labels, assignees, and AI Improve panel.
- DB-backed dashboard API and UI.
- Backend-only AI Improve implementation with graceful `AI_UNAVAILABLE` path when disabled or unconfigured.
- Docker/Coolify baseline and recruiter-facing README/status/audit docs.

## What is still missing

- DB-backed local runtime smoke with migrate/seed/app startup.
- AI unavailable runtime smoke without `OPENAI_API_KEY`.
- Optional real AI smoke with a backend-only `OPENAI_API_KEY`.
- Browser responsive smoke at 360px, 768px, 1024px, and 1440px.
- Final README/STATUS polish after runtime results.
- Public Coolify deployment and live smoke at `https://kanban.matgac.pl`.

Future refinements that are documented but not blockers for the current slice:
checklist delete/reorder, comment edit/delete, search/filter, realtime, file uploads,
billing, invites, and full workspace/project/settings management UI.

## Runtime smoke gap

Runtime smoke was not run because this shell has no safe `DATABASE_URL` configured.
No migrations or seed commands were run.

Needed for local DB-backed smoke:

1. Local PostgreSQL 16+.
2. A safe local URL such as:

   ```txt
   DATABASE_URL=postgres://kanban:kanban@localhost:5432/kanban
   SESSION_SECRET=change-me-in-local-env
   APP_URL=http://localhost:5173
   ```

3. Run:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```

4. Smoke checklist:
   - `GET /api/health` succeeds.
   - Open app locally.
   - Start demo session or register/login.
   - Reach app shell.
   - Open seeded board.
   - Create task.
   - Edit task title/description/priority/due date/blocked state.
   - Open task detail.
   - Add/toggle checklist item.
   - Add comment.
   - Confirm activity updates.
   - Move task across columns and refresh to confirm persistence.
   - Confirm WIP warning appears with seeded/created data.
   - Use mobile fallback status selector.
   - Open dashboard and verify metrics load.
   - Click Improve with AI without key and verify clear unavailable state.

Docker Compose can be used for local smoke because `docker-compose.yml` defines app and
Postgres services and the entrypoint runs migrations/optional seed. That should be a
separate explicit smoke step, not part of this planning audit.

## Deployment status

Coolify is available manually on the VPS, and the deployment baseline exists. The target
future production URL remains:

```txt
https://kanban.matgac.pl
```

Deployment should happen only after local DB-backed smoke passes and docs are updated
with the runtime result. Do not deploy from the current state.

## Recommended fastest path

1. Run local DB-backed smoke with safe local Postgres and seeded demo data.
2. Verify AI unavailable state without `OPENAI_API_KEY`, then optionally verify real AI with a backend-only key.
3. Browser-check the full local flow at desktop and mobile widths.
4. Update README/STATUS with runtime smoke results.
5. Deploy to Coolify with Docker Compose.
6. Run live smoke at `https://kanban.matgac.pl`.

## Decision

`START_LOCAL_RUNTIME_SMOKE`

The builds/checks pass and the core product flow appears complete as code. The gating
gap is that DB-backed runtime smoke was not done.

## Exact next prompt

```txt
Continue the Kanban project from the current repository state.

Decision from DELIVERY_PLAN.md: START_LOCAL_RUNTIME_SMOKE.

Run only a local DB-backed runtime smoke. Do not implement new features. Do not deploy. Do not change Docker/Coolify setup unless documenting smoke results.

First read AGENTS.md, STATUS.md, DELIVERY_PLAN.md, README.md, docs/index.md, docs/02-implementation/acceptance-criteria.md, docs/01-architecture/api-contracts.md, docs/01-architecture/database.md, and docs/01-architecture/ai-feature.md.

Before running migrations or seed, verify DATABASE_URL is explicitly configured and points to a safe local database. If DATABASE_URL is missing or not clearly local/safe, stop and document the exact setup commands needed.

If safe local DB is available:
- Run pnpm db:migrate
- Run pnpm db:seed
- Start the API and web app locally
- Browser-smoke the full product flow:
  1. Open app.
  2. Register/login or use demo login.
  3. Reach app shell.
  4. Open board.
  5. Create task.
  6. Edit task.
  7. Open task detail.
  8. Add/toggle checklist, add comment, inspect activity/metadata.
  9. Move task across columns.
  10. Confirm WIP warning.
  11. Use mobile fallback move action.
  12. Open dashboard.
  13. Use AI Improve or verify clear unavailable state if OPENAI_API_KEY is unset.

Run static checks again after any documentation updates:
- pnpm typecheck
- pnpm lint
- pnpm build
- pnpm format:check

Update STATUS.md with runtime smoke results, exact command results, remaining blockers, and the next decision.
```

## Update STATUS.md

`STATUS.md` was updated with:

- current delivery state,
- static command results,
- Docker build result,
- runtime smoke gap,
- decision,
- reference to `DELIVERY_PLAN.md`,
- exact next recommended action.
