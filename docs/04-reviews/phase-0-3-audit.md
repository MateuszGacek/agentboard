# Kanban Phase 0-3 Audit

Audit date: June 6, 2026

## Current repository state

The repository contains a buildable pnpm TypeScript monorepo with React/Vite app shell placeholder, Hono API foundation, PostgreSQL/Drizzle database package, generated migration, idempotent seed script, and shared Zod/API/domain contracts.

Phase 0, Phase 1, and Phase 2 are implemented as code and pass after the Phase 2 repair. The previous Phase 2 blockers were fixed:

- password hashing now uses bcrypt instead of Node `crypto.scrypt`,
- the normal API startup path can serve `GET /api/health` without `DATABASE_URL`, while DB-backed routes return structured `503 SERVICE_UNAVAILABLE` when DB configuration is missing.

Phase 3 frontend shell has not started: `apps/web/src/main.tsx` still renders `null`, and there is no router, Query provider, i18n setup, theme provider, app shell, sidebar, topbar, or auth UI.

No Kanban board screen, dashboard, AI feature, Docker/deployment implementation, or fake product UI was found.

## Phase status table

| Phase                           | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                   | Missing / Risk                                                                                                                                                                                                                                                 | Decision                       |
| ------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Phase 0 - Repository foundation | PASS        | `pnpm-workspace.yaml` includes `apps/*` and `packages/*`; root `package.json` has required scripts; `pnpm-lock.yaml`, `tsconfig.base.json`, ESLint, Prettier, `.gitignore`, `.env.example`, `apps/web`, `apps/api`, `packages/shared`, and `packages/db` exist.                                                                                                                                            | No blocker. `packages/ui` does not exist yet, which is acceptable because it is optional until reusable UI is needed.                                                                                                                                          | Keep                           |
| Phase 1 - Database foundation   | PASS        | Drizzle config, PostgreSQL schema, DB client, migration setup, generated migration, guarded migrate script, and idempotent seed script exist. Required tables, stable `system_key`/`behavior`, indexes, foreign keys, ownership-validating relationships, and exported select/insert types exist. `DATABASE_URL` is required for migrate/seed with no silent fallback.                                     | Live migration/seed execution was not run because `DATABASE_URL` is unset. This is a runtime validation gap, not a code blocker.                                                                                                                               | Keep                           |
| Phase 2 - API foundation        | PASS        | Hono app exists under `/api`; `/api/health`, auth/session routes, auth middleware, ownership helpers, shared contracts, standard envelopes, not-found handler, global error handler, split base/DB environment validation, bcrypt password hashing, structured DB-missing route fallback, and DB-backed board snapshot route exist. API checks pass. DB-less health and DB-missing route smoke tests pass. | Live PostgreSQL API smoke testing remains pending because no safe local `DATABASE_URL` was explicitly configured.                                                                                                                                              | Keep                           |
| Phase 3 - Frontend shell        | NOT_STARTED | Vite React app exists and builds; `apps/web/src/main.tsx` renders `null`; dependencies for frontend shell are present in `apps/web/package.json`.                                                                                                                                                                                                                                                          | Router, Query provider, Tailwind config, shadcn/Radix component setup, theme provider, i18n provider, language switcher, shell layout, sidebar/topbar, mobile nav, and state primitives are not implemented. This is expected because Phase 3 has not started. | Start Phase 3 only after audit |

## Command results

| Command                                  | Result | Notes                                                                        |
| ---------------------------------------- | -----: | ---------------------------------------------------------------------------- |
| `pnpm typecheck`                         |   PASS | Workspace TypeScript checks pass                                             |
| `pnpm lint`                              |   PASS | ESLint passes with zero warnings                                             |
| `pnpm build`                             |   PASS | Workspace build passes; web dist is generated build output                   |
| `pnpm format:check`                      |   PASS | All matched files use Prettier style after documentation update              |
| `pnpm --filter @kanban/api typecheck`    |   PASS | API package typechecks                                                       |
| `pnpm --filter @kanban/api build`        |   PASS | API package build script passes                                              |
| `pnpm --filter @kanban/shared typecheck` |   PASS | Shared package typechecks                                                    |
| `pnpm --filter @kanban/shared build`     |   PASS | Shared package build script passes                                           |
| `pnpm --filter @kanban/db typecheck`     |   PASS | DB package typechecks without live database                                  |
| `pnpm --filter @kanban/db build`         |   PASS | DB package build script passes                                               |
| `pnpm --filter @kanban/web typecheck`    |   PASS | Web package typechecks                                                       |
| `pnpm --filter @kanban/web build`        |   PASS | Web package build script passes                                              |
| DB-less `GET /api/health` smoke          |   PASS | Normal API startup without `DATABASE_URL` returned expected `200` payload    |
| DB-less `GET /api/auth/me` smoke         |   PASS | DB-backed route returned structured `503 SERVICE_UNAVAILABLE` error envelope |

Commands intentionally not run:

- `pnpm --filter @kanban/db db:migrate` - not run because `DATABASE_URL` was not explicitly configured and verified as a safe local PostgreSQL database.
- `pnpm --filter @kanban/db db:seed` - not run because `DATABASE_URL` was not explicitly configured and verified as a safe local PostgreSQL database.
- Live PostgreSQL API smoke tests - not run because runtime DB configuration was not explicitly verified as safe.

## Repaired blockers

### Blocker 1

Severity: High

Phase: Phase 2

Area: Auth / password hashing

Previous problem:

`apps/api/src/modules/auth/security.ts` hashed passwords with Node `crypto.scrypt`, while `docs/01-architecture/architecture.md` requires Argon2id or bcrypt.

Repair result:

Fixed. Password hashing now uses `bcrypt` with a cost factor of 12. Password verification uses `bcrypt.compare`. Plaintext passwords are not stored, existing register/login route behavior is preserved, and session token creation/hashing is unchanged.

Exact file(s):

- `apps/api/src/modules/auth/security.ts`
- `apps/api/package.json`
- `pnpm-lock.yaml`
- `STATUS.md`

### Blocker 2

Severity: High

Phase: Phase 2

Area: API startup / health endpoint

Previous problem:

`apps/api/src/index.ts` called `loadEnv()`, and `loadEnv()` required `DATABASE_URL`. The server then created a database client before serving any route, so `GET /api/health` could not be served by the normal API entrypoint unless `DATABASE_URL` was configured.

Repair result:

Fixed. `apps/api/src/env.ts` now separates base API environment validation from DB environment validation. `apps/api/src/index.ts` loads base API configuration, creates a DB client only when `DATABASE_URL` is present, and otherwise starts the API without DB-backed routes. `GET /api/health` works without `DATABASE_URL`. DB-backed routes return a structured `503 SERVICE_UNAVAILABLE` error envelope when DB configuration is missing. Migrate/seed safeguards remain unchanged in `packages/db/src/client.ts`.

Exact file(s):

- `apps/api/src/env.ts`
- `apps/api/src/index.ts`
- `STATUS.md`

## Scope violations

None found.

Notes:

- `apps/web/dist` exists as generated build output from validation, not as product UI.
- The API has a Phase 2 board snapshot read endpoint because it was explicitly requested for the next frontend phase.
- No Phase 3 frontend shell, Phase 4 Kanban board screen, dashboard, AI feature, Docker/deployment implementation, or fake UI was found.

## Quality improvements

- Runtime API behavior should be smoke-tested against a safe local PostgreSQL database after migrations/seed are explicitly run.
- `docs/04-reviews/phase-audit.md` is stale and still describes the repository before Phase 2. Keep `docs/04-reviews/phase-0-3-audit.md` as the current audit reference or update the old file in a later documentation cleanup.
- `packages/ui` is absent. This is acceptable now, but Phase 3 should decide whether shared UI components belong in `apps/web` first or a new `packages/ui`.
- `apps/web/dist` is generated output. It is ignored by ESLint but not currently ignored by `.gitignore`; decide later whether it should stay untracked before public GitHub review.

## Move-forward decision

START_PHASE_3

Why:

Phase 0 passes and Phase 1 passes as code. Phase 2 now passes after repairing password hashing and DB-less health startup behavior. Phase 3 is not started, which is expected and is now the correct next implementation phase. Do not start Phase 4 or product features before the Phase 3 frontend shell is complete.

## Exact next prompt

```txt
Continue the Kanban project from the current repository state.

Start Phase 3 — Frontend app shell only.

Do not start Phase 4. Do not implement board screens, task CRUD, task movement, dashboard, AI, Docker, deployment, or product polish.

First read:
- AGENTS.md
- STATUS.md
- docs/04-reviews/phase-0-3-audit.md
- docs/01-architecture/architecture.md
- docs/01-architecture/api-contracts.md
- docs/02-implementation/implementation-plan.md
- docs/02-implementation/acceptance-criteria.md

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
