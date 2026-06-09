# Kanban Phase Audit

## Current detected phase

Detected phase: Phase 1 — Database foundation implemented as code and safety-repaired; Phase 2 has not started.

Why:

- `STATUS.md` marks Phase 0 complete and Phase 1 complete as code.
- `packages/db` contains Drizzle config, schema, migrations, client, and seed script.
- Runtime database command safety has been repaired so migration and seed commands require explicit `DATABASE_URL`.
- `apps/api/src/index.ts` is still an empty placeholder, so Phase 2 API foundation is not implemented.
- `apps/web/src/main.tsx` renders `null`, so Phase 3 frontend shell and Phase 4 board vertical slice have not started.

## Completed phase status

### Phase 0 — Repository foundation

Status: Pass

Evidence from files:

- `pnpm-workspace.yaml` exists and includes `apps/*` and `packages/*`.
- Root `package.json` contains `dev`, `build`, `typecheck`, `lint`, `format`, and `format:check`.
- `tsconfig.base.json`, `eslint.config.js`, and `prettier.config.cjs` exist.
- Package structure exists for `apps/web`, `apps/api`, `packages/shared`, and `packages/db`.
- `pnpm-lock.yaml`, `.env.example`, and `STATUS.md` exist.
- `apps/web/src/main.tsx` renders `null`; no fake UI or premature product screen exists.
- `apps/api/src/index.ts` is a placeholder; no premature API features exist.

Missing items:

- None for Phase 0.

Risk level: Low

### Phase 1 — Database foundation

Status: Pass

Evidence from files:

- Drizzle config exists at `packages/db/drizzle.config.ts`.
- Drizzle config no longer has a fallback database URL; credentials are included only when `DATABASE_URL` is explicitly set.
- PostgreSQL schema exists at `packages/db/src/schema.ts`.
- Initial generated migration exists at `packages/db/migrations/0000_wet_serpent_society.sql`.
- Database client exists at `packages/db/src/client.ts`.
- `getRequiredDatabaseUrl()` throws a developer-friendly error when runtime database commands are run without `DATABASE_URL`.
- Seed script exists at `packages/db/src/seed.ts`.
- `pnpm --filter @kanban/db db:migrate` uses the package migration runner and therefore requires explicit `DATABASE_URL`.
- `pnpm --filter @kanban/db db:seed` uses the guarded database client and therefore requires explicit `DATABASE_URL`.
- `pnpm --filter @kanban/db db:generate` remains usable without a live database connection.
- Shared enum/domain values exist at `packages/shared/src/domain.ts`.
- Stable column semantics exist through `board_columns.system_key` and `board_columns.behavior`.
- Required tables exist in schema and migration:
  `users`, `sessions`, `workspaces`, `workspace_members`, `projects`, `boards`, `board_columns`, `tasks`, `task_assignees`, `labels`, `task_labels`, `task_comments`, `task_checklist_items`, `task_activity_events`, `ai_suggestions`.
- Required indexes are present for sessions, workspace membership, projects, boards, columns, tasks, labels, comments, checklist items, activity events, and AI suggestions.
- Foreign keys exist and support workspace/project/board ownership validation.
- Select/insert types are exported from `packages/db/src/schema.ts`.
- `pnpm typecheck` and `pnpm --filter @kanban/db typecheck` pass without a live database.

Missing items:

- Migration was not applied to a live PostgreSQL database because `DATABASE_URL` is unset.
- Seed was not executed against a live PostgreSQL database because `DATABASE_URL` is unset.
- Runtime migration and seed were not run in this environment because `DATABASE_URL` is unset.

Risk level: Low

## Command results

| Command                                |  Result | Notes                                                      |
| -------------------------------------- | ------: | ---------------------------------------------------------- |
| `pnpm typecheck`                       |    Pass | All current workspace package TypeScript checks pass       |
| `pnpm lint`                            |    Pass | ESLint passes                                              |
| `pnpm build`                           |    Pass | Workspace build passes; web build produces `apps/web/dist` |
| `pnpm format:check`                    |    Pass | All matched files use Prettier style                       |
| `pnpm --filter @kanban/db typecheck`   |    Pass | DB package typechecks without live database                |
| `pnpm --filter @kanban/db build`       |    Pass | DB package build script passes                             |
| `pnpm --filter @kanban/db db:generate` |    Pass | Works without `DATABASE_URL`; no schema changes            |
| `pnpm --filter @kanban/db db:migrate`  | Not run | `DATABASE_URL` is unset; command is now explicitly guarded |
| `pnpm --filter @kanban/db db:seed`     | Not run | `DATABASE_URL` is unset; command is now explicitly guarded |

## Critical issues

### Issue 1

Severity: High

Area: Database configuration / migration safety

Original problem:

`packages/db/drizzle.config.ts` provides a fallback local Postgres URL when `DATABASE_URL` is not set.

Why it matters:

The project status says migration and seed require `DATABASE_URL`, and the audit instructions say migrations should only run when `DATABASE_URL` is configured and safe. With the current fallback, `pnpm db:migrate` could attempt to modify a default local database even when the operator did not explicitly configure a database target.

Repair result:

Fixed.

- Removed fallback URL usage from `packages/db/drizzle.config.ts`.
- Added `getRequiredDatabaseUrl()` with a clear setup error.
- Changed `pnpm --filter @kanban/db db:migrate` to run `tsx src/migrate.ts`, which uses the guarded database client.
- Confirmed `pnpm --filter @kanban/db db:generate` still works without `DATABASE_URL`.

Exact file(s):

- `packages/db/drizzle.config.ts`
- `packages/db/package.json`
- `packages/db/src/client.ts`
- `STATUS.md`
- `docs/04-reviews/phase-audit.md`

## Scope violations

None found.

Notes:

- `apps/web/dist` exists only as generated build output from validation, not as a product feature.
- No Phase 2 API routes, Phase 3 shell, Phase 4 board UI, dashboard, AI, Docker, or deployment work has started.

## Quality improvements

- Consider adding a local development note or script guard that explains how to set `DATABASE_URL` before running `pnpm db:migrate` and `pnpm db:seed`.
- Consider making the DB package build script explicitly non-emitting, or define a real output directory later when packages are consumed as built artifacts.
- Consider running migrations and seed against a disposable local PostgreSQL database before Phase 2 auth work begins.

## Decision

MOVE_TO_PHASE_2

Why:

Phase 0 passes and Phase 1 database foundation is complete as code. The database command safety issue has been repaired, and Phase 2 can start without ambiguous runtime database target selection. Live migration/seed execution still requires an explicitly configured safe local PostgreSQL `DATABASE_URL`.

## Exact next prompt

```txt
Continue the Kanban project from the current repository state.

Start Phase 2 API foundation only.

Do not implement frontend UI, board screens, dashboard, AI, Docker, deployment, or product polish.

Scope:
- Implement the Hono API foundation in `apps/api`.
- Add `/api/health`.
- Add consistent success/error response envelopes with request IDs.
- Add basic middleware for request IDs, structured errors, CORS suitable for local development, and secure defaults.
- Add the auth/session foundation needed for future demo login, but keep it minimal and DB-backed.
- Use shared Zod schemas from `packages/shared` where practical.
- Validate that normal checks pass without requiring a live database.

Do not run database migrations or seed unless `DATABASE_URL` is explicitly configured and points to a safe local PostgreSQL database.

After changes, update `STATUS.md` and run:
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check

Return files changed, commands run, pass/fail results, and what remains before Phase 3.
```
