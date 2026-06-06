# STATUS.md

## Current stage

Phase 2 — API foundation now passes after repair.

The repository has a buildable pnpm TypeScript monorepo, PostgreSQL/Drizzle database foundation, shared contracts, and a Hono API foundation. The two Phase 2 blockers from the latest audit were repaired:

- password hashing now uses bcrypt instead of Node `crypto.scrypt`,
- the normal API startup path can serve `GET /api/health` without `DATABASE_URL`, while DB-backed routes return structured `503 SERVICE_UNAVAILABLE` when DB configuration is missing.

Phase 3 frontend shell has not started.

Runtime API smoke testing against a live PostgreSQL database is still pending because `DATABASE_URL` was not explicitly configured and verified as a safe local PostgreSQL database. Migrations and seed were not run during this repair.

## Latest audit

Audit date: June 6, 2026

Audit file: `PHASE_0_3_AUDIT.md`

Detected phase: Phase 2 — API foundation complete after repair; Phase 3 frontend shell not started.

Move-forward decision: `START_PHASE_3`

Exact next recommended action:

Start Phase 3 frontend app shell only:

- TanStack Router setup,
- API client,
- TanStack Query provider,
- i18next setup for EN/PL/CS,
- theme provider with light/dark/system,
- app layout shell,
- sidebar/topbar/mobile navigation,
- language switch,
- theme switch,
- login/register/demo screens,
- protected route handling,
- basic responsive shell.

Do not start Phase 4 board vertical slice, task CRUD, task movement, dashboard, AI, Docker, deployment, or product polish yet.

## Phase status summary

| Phase                          |      Status | Summary                                                                                    |
| ------------------------------ | ----------: | ------------------------------------------------------------------------------------------ |
| Phase 0 — Repo foundation      |        PASS | Workspace, scripts, configs, lockfile, env example, and package folders exist              |
| Phase 1 — Database/seed        |        PASS | Drizzle schema, migrations, guarded runtime DB commands, seed, indexes, FKs, types exist   |
| Phase 2 — API/auth             |        PASS | Hono/API/auth/board snapshot exist; bcrypt hashing and DB-less health startup are repaired |
| Phase 3 — App shell            | NOT_STARTED | Vite app exists and renders `null`; router, Query, i18n, theme, and shell are not started  |
| Phase 4 — Board vertical slice | NOT_STARTED | Do not start until Phase 3 frontend shell is complete                                      |

## Command results

| Command                                      | Result | Notes                                                                        |
| -------------------------------------------- | -----: | ---------------------------------------------------------------------------- |
| `pnpm typecheck`                             |   PASS | Workspace TypeScript checks pass                                             |
| `pnpm lint`                                  |   PASS | ESLint passes with zero warnings                                             |
| `pnpm build`                                 |   PASS | Workspace build passes                                                       |
| `pnpm format:check`                          |   PASS | All matched files use Prettier style after documentation update              |
| `pnpm --filter @agentboard/api typecheck`    |   PASS | API package typechecks                                                       |
| `pnpm --filter @agentboard/api build`        |   PASS | API package build script passes                                              |
| `pnpm --filter @agentboard/shared typecheck` |   PASS | Shared package typechecks                                                    |
| `pnpm --filter @agentboard/shared build`     |   PASS | Shared package build script passes                                           |
| `pnpm --filter @agentboard/db typecheck`     |   PASS | DB package typechecks without live database                                  |
| `pnpm --filter @agentboard/db build`         |   PASS | DB package build script passes                                               |
| `pnpm --filter @agentboard/web typecheck`    |   PASS | Web package typechecks                                                       |
| `pnpm --filter @agentboard/web build`        |   PASS | Web package build script passes                                              |
| DB-less `GET /api/health` smoke              |   PASS | Normal API startup without `DATABASE_URL` returned expected `200` payload    |
| DB-less `GET /api/auth/me` smoke             |   PASS | DB-backed route returned structured `503 SERVICE_UNAVAILABLE` error envelope |

Commands intentionally not run:

- `pnpm --filter @agentboard/db db:migrate` — not run because `DATABASE_URL` was not explicitly configured and verified as safe.
- `pnpm --filter @agentboard/db db:seed` — not run because `DATABASE_URL` was not explicitly configured and verified as safe.
- Live PostgreSQL API smoke tests — not run because runtime DB configuration was not explicitly verified as safe.

## Repaired Phase 2 blockers

### Password hashing algorithm

`apps/api/src/modules/auth/security.ts` now hashes and verifies passwords with `bcrypt` using a cost factor of 12. Existing register/login route behavior is preserved. Plaintext passwords are not stored. Session token creation and hashing remain unchanged.

### Health endpoint without DB configuration

`apps/api/src/env.ts` now separates base API environment validation from database environment validation. `apps/api/src/index.ts` loads the base API env, creates a DB client only when `DATABASE_URL` is present, and otherwise starts the app without DB-backed routes.

`GET /api/health` works through the normal server entrypoint without `DATABASE_URL`.

DB-backed routes under `/api/auth/*` and `/api/boards/*` return the existing structured error envelope with `503 SERVICE_UNAVAILABLE` when DB configuration is missing.

Migrate and seed safety from Phase 1 remains unchanged in `packages/db/src/client.ts`: runtime migrate/seed commands still require explicit `DATABASE_URL`.

## Completed setup

- Phase 0 repository foundation is complete.
- Phase 1 database foundation is complete as code, including explicit `DATABASE_URL` guards for runtime migrate/seed commands.
- Phase 2 API foundation is complete as code after repair.
- Added shared Zod contracts for API envelopes, auth/session, board snapshot, task detail, health, and common domain enums.
- Added Hono app structure under `/api/*`.
- Added request ID middleware, structured errors, not-found handler, error handler, and local-development CORS.
- Added request logging with method, path, status, duration, and request ID.
- Added split API/base and DB environment validation.
- Added DB-backed auth/session endpoints.
- Added bcrypt password hashing.
- Added reusable workspace ownership guard helpers.
- Added authenticated DB-backed board snapshot endpoint.

## Routes implemented

| Method | Route                  | Status      | Notes                                                                   |
| ------ | ---------------------- | ----------- | ----------------------------------------------------------------------- |
| GET    | `/api/health`          | Implemented | Works without `DATABASE_URL`; does not query DB                         |
| POST   | `/api/auth/register`   | Implemented | Creates user, first workspace, owner membership, DB session, cookie     |
| POST   | `/api/auth/login`      | Implemented | Verifies bcrypt password hash, creates DB session, sets cookie          |
| POST   | `/api/auth/demo`       | Implemented | Creates isolated demo user/workspace/project/board data and demo cookie |
| POST   | `/api/auth/logout`     | Implemented | Deletes current DB session when present and clears cookie               |
| GET    | `/api/auth/me`         | Implemented | Requires valid DB session and returns current user/workspaces           |
| GET    | `/api/boards/:boardId` | Implemented | Requires auth, verifies workspace membership, returns DB board snapshot |

## Remaining gaps

- Phase 3 frontend app shell, auth screens, i18n provider, theme provider, and UI components are not implemented yet.
- Runtime API behavior has not been smoke-tested against a live local PostgreSQL database in this environment.
- Migrations have not been applied to a live PostgreSQL database in this environment.
- Seed has not been executed against a live PostgreSQL database in this environment.
- Task create/edit/delete routes are not implemented yet.
- Task move/reorder endpoint is not implemented yet.
- Task detail endpoint is not implemented yet.
- Dashboard, AI Improve, Docker, deployment, public screenshots, and README demo polish are not implemented yet.
- This folder may still need Git repository initialization before public GitHub work.

## Exact next prompt

```txt
Continue the AgentBoard project from the current repository state.

Start Phase 3 — Frontend app shell only.

Do not start Phase 4. Do not implement board screens, task CRUD, task movement, dashboard, AI, Docker, deployment, or product polish.

First read:
- AGENTS.md
- STATUS.md
- PHASE_0_3_AUDIT.md
- docs/03_ARCHITECTURE.md
- docs/06_API_CONTRACTS.md
- docs/10_IMPLEMENTATION_PLAN.md
- docs/11_ACCEPTANCE_CRITERIA.md

Goal:
Implement only the Phase 3 frontend app shell:
- TanStack Router setup
- API client
- TanStack Query provider
- i18next setup with EN, PL, and CS
- theme provider with light/dark/system
- app layout shell
- sidebar/topbar/mobile navigation
- language switch
- theme switch
- login/register/demo screens
- protected route handling
- basic responsive shell

Constraints:
- All visible UI text must use i18n keys for en, pl, and cs.
- Keep API keys backend-only.
- Do not fake board/product data in frontend.
- Do not implement task CRUD, board movement, dashboard, AI, Docker, or deployment.
- Do not run migrations or seed unless DATABASE_URL is explicitly configured and points to a safe local PostgreSQL database.

Run:
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check

Update STATUS.md with the Phase 3 result and the next move-forward decision.
```

## Implementation warning

Do not start board UI, task CRUD/move, dashboard, AI, Docker, deployment, or Phase 4 before Phase 3 is completed.
