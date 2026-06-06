# AgentBoard Phase 3-4 Audit

Audit date: June 6, 2026

Repair check date: June 6, 2026

## Summary

Phase 3 passes. The frontend app shell has a Vite React entrypoint, TanStack Router,
TanStack Query, typed API client, real auth screens, protected app shell, theme provider,
and i18n for English, Polish, and Czech.

Phase 4 passes as a code audit. The board vertical slice uses DB-backed API routes for
board snapshots, task create/update/delete, task detail, and persisted movement. The web
board route uses TanStack Query, dnd-kit, optimistic rollback, a task detail sheet, a
mobile "Move to..." fallback, and WIP warnings. No fake board data was found in the
frontend shell or board route.

Runtime PostgreSQL smoke tests were not run because `DATABASE_URL` is not set in this
environment. This is a verification gap, not a source-code blocker.

Repair check result: no repair needed. The audit decision is
`START_DEPLOYMENT_BASELINE`, so product code was intentionally left unchanged.

## Phase status table

| Phase                          | Status | Evidence                                                                                                                                                                                                                                                                                     | Missing/Risk                                                                                                                                                              | Decision                                                         |
| ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Phase 3 - Frontend app shell   | PASS   | `apps/web/src/main.tsx`, `apps/web/src/app/router.tsx`, `apps/web/src/app/providers.tsx`, `apps/web/src/lib/api-client.ts`, `apps/web/src/features/auth/*`, `apps/web/src/components/layout/*`, `apps/web/src/app/theme.tsx`, `apps/web/src/i18n/*`                                          | No live browser smoke was run during this audit; source and build checks pass.                                                                                            | Keep Phase 3 closed.                                             |
| Phase 4 - Board vertical slice | PASS   | `apps/api/src/modules/boards/snapshot.ts`, `apps/api/src/modules/boards/routes.ts`, `apps/api/src/modules/tasks/routes.ts`, `apps/api/src/modules/tasks/detail.ts`, `apps/api/src/modules/workspaces/ownership.ts`, `packages/shared/src/api/contracts.ts`, `apps/web/src/features/boards/*` | No DB-backed smoke tests were run because `DATABASE_URL` is unset. Higher-concurrency move locking is not explicitly implemented beyond transaction-scoped recomputation. | Proceed to deployment baseline before broader product expansion. |

## Command results

| Command                                                                   | Result | Notes                                                               |
| ------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------- |
| `pnpm typecheck`                                                          |   PASS | Workspace TypeScript checks passed.                                 |
| `pnpm lint`                                                               |   PASS | ESLint passed with zero warnings.                                   |
| `pnpm build`                                                              |   PASS | Workspace build passed.                                             |
| `pnpm format:check`                                                       |   PASS | Prettier check passed.                                              |
| `pnpm --filter @agentboard/api typecheck`                                 |   PASS | API package typecheck passed.                                       |
| `pnpm --filter @agentboard/api build`                                     |   PASS | API package build passed.                                           |
| `pnpm --filter @agentboard/web typecheck`                                 |   PASS | Web package typecheck passed.                                       |
| `pnpm --filter @agentboard/web build`                                     |   PASS | Web package build passed.                                           |
| `pnpm --filter @agentboard/shared typecheck`                              |   PASS | Shared package typecheck passed.                                    |
| `pnpm --filter @agentboard/shared build`                                  |   PASS | Shared package build passed.                                        |
| `pnpm --filter @agentboard/db typecheck`                                  |   PASS | DB package typecheck passed.                                        |
| `pnpm --filter @agentboard/db build`                                      |   PASS | DB package build passed.                                            |
| EN/PL/CS translation key parity check                                     |   PASS | `pl` and `cs` have no missing or extra keys compared with `en`.     |
| `DATABASE_URL` environment check                                          |   INFO | `DATABASE_URL_NOT_SET`.                                             |
| `pnpm exec prettier --write docs/04-reviews/phase-3-4-audit.md STATUS.md` |   PASS | Formatted audit/status docs after a post-edit format check failure. |

Repair-check validation on June 6, 2026 reran the required static command suite:

| Command                                      | Result | Notes                            |
| -------------------------------------------- | -----: | -------------------------------- |
| `pnpm typecheck`                             |   PASS | Workspace TypeScript checks pass |
| `pnpm lint`                                  |   PASS | ESLint passes with zero warnings |
| `pnpm build`                                 |   PASS | Workspace build passes           |
| `pnpm format:check`                          |   PASS | Prettier check passes            |
| `pnpm --filter @agentboard/api typecheck`    |   PASS | API package typechecks           |
| `pnpm --filter @agentboard/api build`        |   PASS | API package builds               |
| `pnpm --filter @agentboard/web typecheck`    |   PASS | Web package typechecks           |
| `pnpm --filter @agentboard/web build`        |   PASS | Web package builds               |
| `pnpm --filter @agentboard/shared typecheck` |   PASS | Shared package typechecks        |
| `pnpm --filter @agentboard/shared build`     |   PASS | Shared package builds            |
| `pnpm --filter @agentboard/db typecheck`     |   PASS | DB package typechecks            |
| `pnpm --filter @agentboard/db build`         |   PASS | DB package builds                |

Post-edit note: `pnpm format:check` failed once after creating the audit/status markdown
files, reporting only `docs/04-reviews/phase-3-4-audit.md` and `STATUS.md`. Those docs were formatted
with Prettier, and the final `pnpm format:check` passed.

## Smoke test results

`DATABASE_URL` is not set, so the following were intentionally not run:

- migrations,
- seed,
- auth/demo smoke test,
- board snapshot smoke test,
- task create/edit/delete/move smoke tests.

Repair-check smoke result: unchanged. `DATABASE_URL_NOT_SET`, so migrations, seed, and
DB-backed smoke tests were not run.

## Critical blockers

None.

Repair blockers: none.

## Scope violations

None found.

Audit checks did not find dashboard UI, AI API routes, Docker/deployment work, realtime,
file uploads, billing, or fake frontend board data started early. AI-related schema and
seed records exist from the planned database foundation, but no Phase 4 frontend or API AI
feature was started.

## Quality improvements

- Run a DB-backed smoke pass once a safe local `DATABASE_URL` is configured.
- Align task-create route documentation with the implemented/latest endpoint
  `POST /api/tasks`, or add a compatibility alias for `POST /api/boards/:boardId/tasks`.
- Consider explicit row locking or board-version conflict handling for high-concurrency
  task movement after the deployment baseline.
- Add delete/archive activity semantics if a future activity feed needs to show deletion
  history.
- Supersede the stale `docs/04-reviews/phase-0-3-audit.md` with this audit in future status summaries.

## Decision

START_DEPLOYMENT_BASELINE

## Exact next prompt

```txt
Continue the AgentBoard project from the current repository state.

Start the deployment baseline only.

Do not start dashboard, AI, realtime, billing, file uploads, or new product features.
Do not broaden task detail polish unless required for deployment correctness.

First read:
- AGENTS.md
- docs/02-implementation/start-plan.md
- STATUS.md
- docs/04-reviews/phase-3-4-audit.md
- docs/01-architecture/architecture.md
- docs/01-architecture/database.md
- docs/01-architecture/api-contracts.md
- docs/02-implementation/implementation-plan.md
- docs/02-implementation/acceptance-criteria.md
- docs/04-reviews/recruiter-readiness.md

Goal:
Prepare the app for a production-like single-domain deployment baseline:
- `/api/*` served by the Hono API
- `/*` served as the Vite SPA fallback by the API container in production
- safe `/api/health`
- production env validation
- Dockerfile and minimal compose/Coolify-ready configuration if not already present
- idempotent startup plan for waiting on Postgres, running migrations safely, optionally seeding demo data, then starting the server
- `.env.example` and README/STATUS updates for local and deployment usage

Constraints:
- No secrets.
- No fake data beyond the existing guarded seed/demo flow.
- Do not run migrations or seed unless `DATABASE_URL` is explicitly configured and points to a safe local PostgreSQL database.
- Normal typecheck/lint/build must pass without a live DB.

Validation:
Run:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
- `pnpm --filter @agentboard/api typecheck`
- `pnpm --filter @agentboard/api build`
- `pnpm --filter @agentboard/web typecheck`
- `pnpm --filter @agentboard/web build`
- `pnpm --filter @agentboard/shared typecheck`
- `pnpm --filter @agentboard/shared build`
- `pnpm --filter @agentboard/db typecheck`
- `pnpm --filter @agentboard/db build`

If `DATABASE_URL` is configured and safe, run migrations, seed, and smoke-test auth/demo,
board snapshot, and task create/edit/delete/move.

Update `STATUS.md` with deployment baseline status, files changed, commands run,
smoke-test results, remaining gaps, and the exact next recommended task.
```
