# STATUS.md

## Current Phase

AgentBoard Deploy Operator Mode: production runtime fix in progress.

Deploy operator date: June 7, 2026

Deploy operator status: RUNTIME_FIX_IN_PROGRESS. Local validation previously passed
(`pnpm predeploy:check` and `docker build -t agentboard-local .`). Dockerfile was
hardened in commit `7988487` so deps/build stages force development dependency
installation even if Coolify exposes `NODE_ENV=production` during build, while runtime
remains production-oriented. Coolify runtime logs later confirmed the current production
blocker: `DATABASE_URL` was assembled with a raw Postgres password containing
URL-reserved characters, so `scripts/wait-for-db.mjs` throws `ERR_INVALID_URL` before
the API starts and `https://scalesoftware.matgac.pl/api/health` returns `HTTP 503 no
available server`. The repo-side fix requires explicit `DATABASE_URL`, URL-encodes the
password in the Coolify helper, and redacts invalid URL startup errors. Next required
action is validation, push, Coolify env update, redeploy, and live smoke. A later
Coolify host inspection showed the app became healthy but Traefik still returned `503`
because the app container was not attached to the external `coolify` proxy network; the
Compose app service now joins both `default` and `coolify`. See
`DEPLOY_OPERATOR_REPORT.md`.

Latest deployment fix validation:

| Command                                     | Result | Notes                                                             |
| ------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `DATABASE_URL` reserved-character check     | PASS   | Encoded `/`, `#`, `?`, `%`, `@`, and `:` password samples parsed. |
| invalid `scripts/wait-for-db.mjs` URL smoke | PASS   | Failed with a redacted actionable error, not the raw URL.         |
| `docker compose config` network check       | PASS   | `app` joins `default` and `coolify`; `postgres` stays private.    |
| `pnpm typecheck`                            | PASS   | Workspace TypeScript checks passed.                               |
| `pnpm lint`                                 | PASS   | ESLint passed with zero warnings.                                 |
| `pnpm build`                                | PASS   | Workspace production build passed.                                |
| `pnpm format:check`                         | PASS   | Prettier check passed.                                            |
| `docker build -t agentboard-local .`        | PASS   | Local Docker image build completed.                               |

Implementation date: June 6, 2026

Local product audit date: June 6, 2026

Delivery state check date: June 6, 2026

Coolify environment setup helper date: June 7, 2026

Coolify environment setup helper patch date: June 7, 2026

Coolify environment setup helper patch status: BLOCKED_ON_LOCAL_ENV. Patched the helper
for Coolify v4.1.1 env payload validation after `POST /api/v1/applications/{uuid}/envs`
returned HTTP 422 with the original create payload. The patched helper targets
non-preview env vars only, uses `is_buildtime`/`is_runtime` flags, updates existing
non-preview vars through `PATCH /api/v1/applications/{uuid}/envs`, and prints sanitized
response-body diagnostics on create/update failures. `pnpm typecheck`, `pnpm lint`,
`pnpm build`, and `pnpm format:check` passed after patching. `pnpm coolify:env:dry-run`,
`pnpm coolify:env:push`, and `pnpm coolify:env:verify` stopped safely before API calls
because this shell could not see `COOLIFY_URL`, `COOLIFY_TOKEN`, `COOLIFY_APP_UUID`,
`AGENTBOARD_POSTGRES_PASSWORD`, or `AGENTBOARD_SESSION_SECRET`. Deployment remains
parked.

Coolify environment setup helper status: BLOCKED_ON_LOCAL_ENV. Added a local
secret-safe Coolify API helper and documentation for application environment variable
setup. The helper validates required local shell variables, supports dry-run/push/verify,
and is designed to print variable names and counts only. Validation passed, but
`pnpm coolify:env:dry-run` stopped safely because this shell could not see
`COOLIFY_URL`, `COOLIFY_TOKEN`, `COOLIFY_APP_UUID`, `AGENTBOARD_POSTGRES_PASSWORD`, or
`AGENTBOARD_SESSION_SECRET`. No Coolify push, verify, deployment, SSH, or live smoke was
performed. Deployment remains parked; do not claim production is deployed until the
manual Coolify checks and live smoke pass. See `COOLIFY_ENV_SETUP.md`.

Local runtime smoke date: June 6, 2026

Coolify deploy verification date: June 6, 2026

Nightly product delivery mode start date: June 6, 2026

Nightly product delivery mode status: STARTED. Deployment remains parked. Live server
changes are not allowed in this mode: do not deploy to production, SSH into the server,
edit Coolify/Traefik/Cloudflare/OVH settings, or mutate production services. Overnight
work is limited to local product quality, DB/API correctness, UX/UI polish, QA,
documentation, and deployment readiness documentation. See `NIGHTLY_PLAN.md`.

DB/API hardening status: PASS. Added index-only DB migration, tightened workspace and
nested-resource validation in board snapshot, task detail, task move, and AI
apply/reject paths, verified seed idempotency against local Postgres, and passed minimal
local API smoke. Deployment remains parked. See `DB_API_HARDENING_REPORT.md`.

Product UX/UI polish status: PASS. Polished existing frontend surfaces only: home first
impression, app shell, dashboard cards/states, board columns/cards, task detail sheet
spacing, dialog/sheet accessibility labels, responsive spacing, and EN/PL/CS i18n. No
deployment, SSH, AI model calls, architecture rewrite, or fake product data were added.
See `UX_UI_POLISH_REPORT.md`.

Product feature completion status: PASS. Added URL-backed board search/filters,
dismissible localStorage board hints, safe board shortcuts, and a useful settings screen
for theme, language, workspace/demo context, and deployment guardrails. No DB/API schema
changes, backend endpoints, fake frontend data, deployment, SSH, or live server changes
were added. See `FEATURE_COMPLETION_REPORT.md`.

Accessibility responsive i18n QA status: PASS. Verified EN/PL/CS key parity, added
accessible overlay descriptions, improved mobile nav dialog semantics and Escape
handling, tightened narrow-width wrapping on auth/home/app shell/board surfaces, and
passed local route smoke. Automated viewport screenshots remain pending because Browser
screenshot tooling and Playwright were unavailable in this session. See
`A11Y_RESPONSIVE_I18N_REPORT.md`.

QA automation status: PASS. Added lightweight repeatable scripts for translation parity,
internal markdown links, local API/DB smoke, and static predeploy checks. Local smoke
passed against explicit localhost API/DB with `OPENAI_API_KEY` unset and verified the
graceful AI unavailable path. See `QA_AUTOMATION_REPORT.md`.

Coolify deployment blocker local repair status: PASS. Repository-side deployment config
was hardened without deploying: API binding is explicit on `0.0.0.0`, Compose
healthcheck follows `PORT`, missing production `SESSION_SECRET` now fails in app
validation instead of Compose interpolation, entrypoint is executable, deployment docs
include concrete Cloudflare/Coolify/Traefik troubleshooting, Docker build passes, and
non-DB Docker smoke passes. Live server changes remain parked. See
`COOLIFY_DEPLOYMENT_BLOCKER_REPORT.md`.

Final overnight summary and deploy readiness status: PASS. Morning handoff created with
overnight changes, validation results, local smoke result, deployment blocker status,
manual Coolify checklist, UX review checklist, remaining blockers, and the next exact
action. Production is still not verified live; do not claim deployment is complete until
the Coolify checklist and live smoke pass. See `MORNING_HANDOFF.md`.

Current product status: the local foundation, API, frontend shell, DB-backed board
vertical slice, task detail polish, DB-backed dashboard, backend-only AI Improve flow,
recruiter-facing README, and Docker/Coolify baseline are implemented as code, pass
static validation, and now pass local DB-backed runtime smoke. Production deployment
verification is blocked because the live domain currently serves Traefik's default
self-signed certificate and returns `503 no available server`.

Task detail polish status: PASS as code. The task detail sheet now renders deeper
API-backed task data and supports narrow DB-backed checklist/comment mutations plus
existing task property, label, assignee, and status mutations.

Task detail audit result: PASS. See `TASK_DETAIL_AUDIT.md`.

Dashboard status: PASS as code. The dashboard API and `/app/dashboard` UI are
DB-backed, workspace-scoped, authenticated, responsive, and covered by shared Zod
contracts and EN/PL/CS translations.

AI feature status: PASS as code. The task detail sheet includes Improve with AI, calls
backend-only OpenAI integration, stores suggestions, supports apply/reject, and has an
`AI_UNAVAILABLE` path when AI is disabled or `OPENAI_API_KEY` is missing. Local runtime
smoke verified the unavailable state with `OPENAI_API_KEY` unset.

Delivery plan: see `DELIVERY_PLAN.md`.

Local runtime smoke: PASS. See `LOCAL_RUNTIME_SMOKE.md`.

Latest command results from the delivery state check:

| Command                                      | Result | Notes                                                 |
| -------------------------------------------- | ------ | ----------------------------------------------------- |
| `pnpm typecheck`                             | PASS   | Workspace TypeScript checks passed.                   |
| `pnpm lint`                                  | PASS   | ESLint passed with zero warnings.                     |
| `pnpm build`                                 | PASS   | Workspace build passed; Vite production build passed. |
| `pnpm format:check`                          | PASS   | Prettier check passed.                                |
| `pnpm --filter @agentboard/web typecheck`    | PASS   | Web package typecheck passed.                         |
| `pnpm --filter @agentboard/web build`        | PASS   | Web package build passed.                             |
| `pnpm --filter @agentboard/api typecheck`    | PASS   | API package typecheck passed.                         |
| `pnpm --filter @agentboard/api build`        | PASS   | API package build passed.                             |
| `pnpm --filter @agentboard/shared typecheck` | PASS   | Shared package typecheck passed.                      |
| `pnpm --filter @agentboard/shared build`     | PASS   | Shared package build passed.                          |
| `pnpm --filter @agentboard/db typecheck`     | PASS   | DB package typecheck passed.                          |
| `pnpm --filter @agentboard/db build`         | PASS   | DB package build passed.                              |
| `docker build -t agentboard-local .`         | PASS   | Non-destructive local Docker image build completed.   |

Latest command results after local runtime smoke documentation updates:

| Command             | Result | Notes                                                 |
| ------------------- | ------ | ----------------------------------------------------- |
| `pnpm typecheck`    | PASS   | Workspace TypeScript checks passed.                   |
| `pnpm lint`         | PASS   | ESLint passed with zero warnings.                     |
| `pnpm build`        | PASS   | Workspace build passed; Vite production build passed. |
| `pnpm format`       | PASS   | Formatted updated markdown files.                     |
| `pnpm format:check` | PASS   | Prettier check passed after formatting.               |

Runtime command results:

| Command                                    | Result          | Notes                                                                                   |
| ------------------------------------------ | --------------- | --------------------------------------------------------------------------------------- |
| `docker compose up -d postgres`            | FAIL_THEN_FIXED | Initial run needed local env interpolation for `SESSION_SECRET`.                        |
| Postgres with temporary host-port override | PASS            | Published only `127.0.0.1:5432` for local pnpm commands.                                |
| `pnpm db:migrate`                          | PASS            | Ran against verified local `DATABASE_URL`.                                              |
| `pnpm db:seed`                             | PASS            | Demo seed completed.                                                                    |
| `pnpm db:seed` second pass                 | PASS            | Re-ran without command failure.                                                         |
| API + web dev servers                      | PASS            | API on `3000`, Vite on `5173`.                                                          |
| Local browser smoke                        | PASS            | Demo, board, task detail, WIP, dashboard, AI unavailable, and responsive widths passed. |

Current decision: `COOLIFY_DEPLOY_BLOCKED`.

Latest command results after DB/API hardening:

| Command                                      | Result | Notes                                                                          |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `pnpm db:generate`                           | PASS   | Generated index-only migration `0001_skinny_war_machine.sql`.                  |
| `pnpm typecheck`                             | PASS   | Workspace TypeScript checks passed.                                            |
| `pnpm lint`                                  | PASS   | ESLint passed with zero warnings.                                              |
| `pnpm build`                                 | PASS   | Workspace build passed; Vite production build passed.                          |
| `pnpm format`                                | PASS   | Formatted updated code/docs/Drizzle metadata.                                  |
| `pnpm format:check`                          | PASS   | Prettier check passed.                                                         |
| `pnpm --filter @agentboard/db typecheck`     | PASS   | DB package typecheck passed.                                                   |
| `pnpm --filter @agentboard/db build`         | PASS   | DB package build passed.                                                       |
| `pnpm --filter @agentboard/shared typecheck` | PASS   | Shared package typecheck passed.                                               |
| `pnpm --filter @agentboard/shared build`     | PASS   | Shared package build passed.                                                   |
| `pnpm --filter @agentboard/api typecheck`    | PASS   | API package typecheck passed.                                                  |
| `pnpm --filter @agentboard/api build`        | PASS   | API package build passed.                                                      |
| `pnpm db:migrate`                            | PASS   | Ran against explicit local `.env.local` database.                              |
| `pnpm db:seed`                               | PASS   | Demo seed completed.                                                           |
| `pnpm db:seed` second pass                   | PASS   | Demo seed completed again.                                                     |
| Seed idempotency count check                 | PASS   | Shared demo seed retained 1 workspace, 1 project, 1 board, 13 tasks, 5 labels. |
| Minimal local API smoke                      | PASS   | Health, demo auth, board snapshot, and dashboard passed.                       |

Dashboard audit was intentionally skipped by prior instruction to move faster. Do not
rewrite dashboard. Local DB-backed runtime smoke passes, but live Coolify verification
is blocked by proxy/certificate/service availability outside the repository code.

Latest command results after Product UX/UI polish:

| Command                                   | Result | Notes                                                      |
| ----------------------------------------- | ------ | ---------------------------------------------------------- |
| `pnpm typecheck`                          | PASS   | Workspace TypeScript checks passed.                        |
| `pnpm lint`                               | PASS   | ESLint passed with zero warnings.                          |
| `pnpm build`                              | PASS   | Workspace build passed; Vite production build passed.      |
| `pnpm format`                             | PASS   | Formatted changed frontend/docs files.                     |
| `pnpm format:check`                       | PASS   | Prettier check passed.                                     |
| `pnpm --filter @agentboard/web typecheck` | PASS   | Web package typecheck passed.                              |
| `pnpm --filter @agentboard/web build`     | PASS   | Web package production build passed.                       |
| Local frontend HTTP smoke                 | PASS   | Vite served `http://localhost:5173/` with `200 text/html`. |
| Local API health smoke                    | PASS   | `GET /api/health` returned `ok: true`.                     |

Browser automation note: Browser plugin navigation/screenshot tools were not exposed in
this session, and Playwright was not installed in the available `node_repl` runtime, so
visual browser automation was not completed.

Previous recommended action in nightly mode: Product feature completion pass.

Latest command results after Product feature completion pass:

| Command                                      | Result | Notes                                                   |
| -------------------------------------------- | ------ | ------------------------------------------------------- |
| `pnpm --filter @agentboard/web typecheck`    | PASS   | Focused web check passed after ref type fix.            |
| `pnpm typecheck`                             | PASS   | Workspace TypeScript checks passed.                     |
| `pnpm lint`                                  | PASS   | ESLint passed with zero warnings.                       |
| `pnpm build`                                 | PASS   | Workspace build passed; Vite production build passed.   |
| `pnpm format`                                | PASS   | Formatted updated frontend and documentation files.     |
| `pnpm format:check`                          | PASS   | Prettier check passed.                                  |
| `pnpm --filter @agentboard/web typecheck`    | PASS   | Web package typecheck passed.                           |
| `pnpm --filter @agentboard/web build`        | PASS   | Web package production build passed.                    |
| `pnpm --filter @agentboard/api typecheck`    | PASS   | API package typecheck passed.                           |
| `pnpm --filter @agentboard/api build`        | PASS   | API package build passed.                               |
| `pnpm --filter @agentboard/shared typecheck` | PASS   | Shared package typecheck passed.                        |
| `pnpm --filter @agentboard/shared build`     | PASS   | Shared package build passed.                            |
| `pnpm --filter @agentboard/db typecheck`     | PASS   | DB package typecheck passed.                            |
| `pnpm --filter @agentboard/db build`         | PASS   | DB package build passed.                                |
| Focused local runtime smoke                  | PASS   | Health, demo auth, board snapshot/filter logic, task    |
|                                              |        | create, task move, dashboard, and web board route pass. |

Previous recommended action in nightly mode: Accessibility responsive i18n QA pass.

Latest command results after Accessibility responsive i18n QA pass:

| Command                                   | Result | Notes                                                 |
| ----------------------------------------- | ------ | ----------------------------------------------------- |
| i18n key parity script                    | PASS   | EN/PL/CS share 287 keys.                              |
| React visible literal scan                | PASS   | No obvious visible hardcoded English component text.  |
| `pnpm --filter @agentboard/web typecheck` | PASS   | Focused web check passed after accessibility changes. |
| Local API health smoke                    | PASS   | `GET /api/health` returned `ok: true`.                |
| Local SPA route smoke                     | PASS   | Key routes served `200 text/html` with root element.  |

Previous recommended action in nightly mode: Automated QA and local smoke scripts.

Latest command results after Automated QA and smoke scripts:

| Command                | Result | Notes                                                |
| ---------------------- | ------ | ---------------------------------------------------- |
| `pnpm check:i18n`      | PASS   | EN/PL/CS share 287 keys.                             |
| `pnpm check:links`     | PASS   | 39 markdown files scanned.                           |
| `pnpm smoke:local`     | PASS   | Local API/DB smoke passed with AI unavailable state. |
| `pnpm typecheck`       | PASS   | Workspace TypeScript checks passed.                  |
| `pnpm lint`            | PASS   | ESLint passed with zero warnings.                    |
| `pnpm build`           | PASS   | Workspace build passed.                              |
| `pnpm format:check`    | PASS   | Prettier check passed.                               |
| `pnpm predeploy:check` | PASS   | Static deploy-readiness command passed.              |

Previous recommended action in nightly mode: Coolify deployment blocker local repair.

Latest command results after Coolify deployment blocker local repair:

| Command                                  | Result | Notes                                               |
| ---------------------------------------- | ------ | --------------------------------------------------- |
| `pnpm typecheck`                         | PASS   | Workspace TypeScript checks passed.                 |
| `pnpm lint`                              | PASS   | ESLint passed with zero warnings.                   |
| `pnpm build`                             | PASS   | Workspace build passed.                             |
| `pnpm format:check`                      | PASS   | Prettier check passed before report/status updates. |
| `docker build -t agentboard-local .`     | PASS   | Production image built locally.                     |
| Non-DB Docker smoke: `/api/health`       | PASS   | Returned `200` JSON from production image.          |
| Non-DB Docker smoke: `/login`            | PASS   | Returned SPA HTML from production image.            |
| Non-DB Docker smoke: DB-backed API route | PASS   | Returned structured `503 SERVICE_UNAVAILABLE` JSON. |

Exact next recommended action in nightly mode: Final overnight summary and deploy
readiness.

Latest command results after final overnight summary and deploy readiness:

| Command                              | Result | Notes                                                |
| ------------------------------------ | ------ | ---------------------------------------------------- |
| `pnpm typecheck`                     | PASS   | Workspace TypeScript checks passed.                  |
| `pnpm lint`                          | PASS   | ESLint passed with zero warnings.                    |
| `pnpm build`                         | PASS   | Workspace build and Vite production build passed.    |
| `pnpm format:check`                  | PASS   | Prettier check passed.                               |
| `pnpm predeploy:check`               | PASS   | Static predeploy checks and i18n parity passed.      |
| `docker build -t agentboard-local .` | PASS   | Production image built locally.                      |
| `pnpm smoke:local`                   | PASS   | Local API/DB smoke passed with AI unavailable state. |

Exact next recommended action: push the final documentation commit, then run the manual
Coolify deployment checklist in `MORNING_HANDOFF.md`. Do not mark production live until
`/api/health`, `/login`, demo login, board, dashboard, and AI unavailable/working state
are verified on the public domain.

## Completed Phases

| Phase                          | Status | Summary                                                                                                                                               |
| ------------------------------ | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 - Repo foundation      |   PASS | Workspace, scripts, configs, lockfile, env example, and package folders exist.                                                                        |
| Phase 1 - Database/seed        |   PASS | Drizzle schema, migrations, guarded DB commands, seed, indexes, FKs, and types exist.                                                                 |
| Phase 2 - API/auth             |   PASS | Hono API/auth/board snapshot foundation exists and DB-less health startup works.                                                                      |
| Phase 3 - App shell            |   PASS | Vite React shell, TanStack Router, TanStack Query, API client, auth UI, protected shell, theme, and i18n are implemented.                             |
| Phase 4 - Board vertical slice |   PASS | DB-backed board snapshot, task CRUD, task detail sheet, persisted movement, mobile fallback, and WIP warning are implemented as code.                 |
| Task detail polish             |   PASS | Task detail renders richer API-backed task data with editable core fields, labels, assignees, checklist add/toggle, comments, activity, and metadata. |
| Task detail polish audit       |   PASS | Audit found no critical task detail blockers; required validation commands pass.                                                                      |
| Dashboard metrics              |   PASS | Authenticated workspace dashboard endpoint and responsive dashboard UI use DB-backed metrics only.                                                    |
| AI Improve                     |   PASS | Backend-only OpenAI task improvement, persisted suggestions, task detail comparison UI, apply/reject flow, and graceful unavailable states exist.     |
| Recruiter polish               |   PASS | README, STATUS, docs index, and final recruiter audit honestly describe implemented and pending product scope.                                        |
| Deployment baseline            |   PASS | Single-container API plus SPA serving, Dockerfile, Compose, startup script, healthcheck, env example, and deployment notes exist.                     |

Phase 3 and Phase 4 remain stable under the local product audit in
`LOCAL_PRODUCT_AUDIT.md`. The board works as a real API-backed vertical slice, and task
detail is now the richest local task management surface. Deployment baseline work did
not add dashboard, AI, or new product UI scope and must remain parked.

## What Works

- Root `AGENTS.md` provides concise current agent rules.
- Root `README.md` is recruiter-facing and links to current status/docs.
- Root `STATUS.md` remains the implementation source of truth.
- Product, architecture, implementation, deployment, review, and prompt docs are grouped
  under `docs/`.
- `docs/index.md` is the main documentation hub.
- Existing useful audit and planning history is preserved in the docs tree.
- Docker/Coolify baseline files exist.
- `docs/03-deployment/ovh-cloudflare-coolify-prep.md` documents the
  `https://scalesoftware.matgac.pl` deployment preparation path, including Cloudflare as
  the currently authoritative DNS provider.
- Static validation passes for format, lint, typecheck, and build checks.
- Local product readiness audit is documented in `LOCAL_PRODUCT_AUDIT.md`.
- Task detail polish audit is documented in `TASK_DETAIL_AUDIT.md`.
- Task detail sheet renders title, description, priority, due date, blocked state,
  column/status, labels, assignees, checklist items, comments, activity, created
  metadata, started metadata, and completed metadata from API-backed task detail data.
- Task detail supports editing title, description, priority, due date, blocked state,
  status/column, labels, assignees, checklist item creation/toggle, comments, and
  delete/archive using DB-backed endpoints.
- Task detail includes loading, error/retry, empty checklist, empty comments, empty
  activity, saving, and mobile-friendly layout states.
- `GET /api/workspaces/:workspaceId/dashboard` requires authentication, validates
  workspace membership, supports optional project scope, returns the standard success
  envelope, and returns structured `SERVICE_UNAVAILABLE` when DB-backed routes are not
  configured.
- `/app/dashboard` renders real DB-backed summary metric cards, WIP warnings, priority
  breakdown, status/column breakdown, due-soon risk list, and recent activity with
  loading, empty, error, and DB-unavailable states.
- Dashboard UI text is translated in English, Polish, and Czech.
- `POST /api/tasks/:taskId/ai/improve` requires auth, validates workspace membership,
  validates task/column ownership, sends task-relevant context only to OpenAI, validates
  structured JSON with Zod, stores original/suggested payloads in `ai_suggestions`, and
  creates `ai.suggestion_created` activity.
- `POST /api/ai-suggestions/:suggestionId/apply` requires auth, validates suggestion
  workspace access, applies improved title/description/priority/checklist items,
  updates the board version, marks the suggestion accepted or partially applied, and
  creates `ai.suggestion_applied` activity.
- `POST /api/ai-suggestions/:suggestionId/reject` requires auth, validates suggestion
  workspace access, marks the suggestion rejected, and creates
  `ai.suggestion_rejected` activity.
- Task detail includes an Improve with AI panel with loading, unavailable/error,
  original-vs-improved comparison, acceptance criteria, suggested checklist, risk notes,
  recommended priority, apply, and reject states.
- AI UI text is translated in English, Polish, and Czech.
- `README.md` is recruiter-facing and includes product summary, feature status, tech
  stack, architecture, setup, env vars, DB migrate/seed instructions, scripts,
  Docker/Coolify notes, known limitations, and review path.
- `FINAL_RECRUITER_AUDIT.md` documents readiness score, completed surfaces,
  runtime-pending items, GitHub safety, review path, deployment checklist, blockers, and
  decision.

## Incomplete

- Production deployment at `https://scalesoftware.matgac.pl` is blocked: the domain
  presents `TRAEFIK DEFAULT CERT` and `/api/health` returns `503 no available server`.
- Checklist deletion/reordering and comment edit/delete remain future task-detail
  refinements.
- Real AI endpoint smoke test still requires a backend-only `OPENAI_API_KEY`; the
  missing-key unavailable path passes locally.
- Search/filter, realtime, file uploads, and billing remain future product phases.
- Coolify/Traefik service routing and certificate setup are the next operational step.
- Public recruiter sharing remains pending until Coolify deployment and live smoke pass.

## Files Changed In Dashboard Implementation

- `apps/api/src/app.ts`
- `apps/api/src/modules/workspaces/dashboard.ts`
- `apps/api/src/modules/workspaces/routes.ts`
- `apps/web/src/app/router.tsx`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/features/dashboard/dashboard-page.tsx`
- `apps/web/src/features/dashboard/dashboard-queries.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/i18n/locales/en/common.json`
- `apps/web/src/i18n/locales/pl/common.json`
- `apps/web/src/i18n/locales/cs/common.json`
- `packages/shared/src/api/contracts.ts`
- `docs/01-architecture/api-contracts.md`
- `STATUS.md`

## Dashboard Implementation Changes

Backend/API changes:

- Added `GET /api/workspaces/:workspaceId/dashboard`.
- Registered workspace routes under `/api/workspaces`.
- Added structured 503 fallback for `/api/workspaces/*` when DB configuration is
  missing.
- Dashboard queries require auth, validate workspace membership, validate optional
  project scope, and only read rows from the accessible workspace.

Metrics implemented:

- `totalActiveTasks`: non-archived tasks outside `completes_work` columns.
- `completedTasks`: non-archived tasks in `completes_work` columns.
- `overdueTasks`: active tasks with due date before today.
- `blockedTasks`: active tasks with `is_blocked = true` or column behavior
  `blocks_work`.
- `completionRate`: completed / all relevant non-archived tasks, with display percent.
- `wipLimitWarnings`: active column task count over `wip_limit`.
- `tasksByPriority`: active tasks grouped into low, medium, high, urgent.
- `tasksByColumn`: ordered board/column breakdown with active/completed counts.
- `dueSoonTasks`: active tasks due today through the next 7 days.
- `recentActivity`: latest task activity events in scope.

Frontend/UI changes:

- Added `/app/dashboard`.
- Added dashboard navigation entry.
- Added summary metric cards, WIP warnings, priority bars, status/column bars, due-soon
  risk list, and recent activity list.
- Added loading, no-workspace, empty-data, API error, and DB-unavailable states.
- Kept the UI compact and responsive using the existing Tailwind/shadcn-style system.

Shared/docs/i18n changes:

- Added shared Zod contracts for dashboard query, response, metric cards, WIP warnings,
  priority breakdown, column breakdown, due-soon tasks, and recent activity.
- Updated `docs/01-architecture/api-contracts.md` with the implemented dashboard
  response shape and metric definitions.
- Added dashboard translation keys in English, Polish, and Czech.

## Files Changed In Task Detail Polish

- `apps/web/src/features/boards/board-page.tsx`
- `apps/web/src/features/boards/board-queries.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/i18n/locales/en/common.json`
- `apps/web/src/i18n/locales/pl/common.json`
- `apps/web/src/i18n/locales/cs/common.json`
- `apps/api/src/modules/tasks/routes.ts`
- `packages/shared/src/api/contracts.ts`
- `docs/01-architecture/api-contracts.md`
- `STATUS.md`

## Task Detail Polish Changes

UI improvements:

- Expanded the existing task detail sheet into a sectioned productivity surface.
- Added editable top-level task fields, status selector, compact metadata pills, label
  toggles, assignee toggles, checklist section, comments section, activity section, and
  created/started/completed metadata section.
- Added polished loading, error/retry, empty checklist, empty comments, empty activity,
  saving, and mobile-friendly full-height drawer states.

API/backend changes:

- Added shared Zod contracts for checklist item creation, checklist item updates, and
  comment creation.
- Added `POST /api/tasks/:taskId/checklist-items`.
- Added `PATCH /api/tasks/checklist-items/:itemId`.
- Added `POST /api/tasks/:taskId/comments`.
- Each new mutation requires auth, validates workspace membership, verifies task/item
  ownership through DB state, updates board version, returns fresh task detail and board
  snapshot, and writes existing activity event types where supported.

i18n changes:

- Added English, Polish, and Czech keys for task detail sections, labels, assignees,
  checklist, comments, activity, empty states, loading/error/retry states, save states,
  blocked state labels, metadata labels, and activity event labels.

## Files Changed In AI Improve Implementation

- `apps/api/src/app.ts`
- `apps/api/src/env.ts`
- `apps/api/src/lib/errors.ts`
- `apps/api/src/modules/ai/routes.ts`
- `apps/api/src/modules/ai/service.ts`
- `apps/api/src/modules/tasks/routes.ts`
- `apps/web/src/features/boards/board-page.tsx`
- `apps/web/src/features/boards/board-queries.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/api-errors.ts`
- `apps/web/src/i18n/locales/en/common.json`
- `apps/web/src/i18n/locales/pl/common.json`
- `apps/web/src/i18n/locales/cs/common.json`
- `packages/shared/src/api/contracts.ts`
- `docs/01-architecture/ai-feature.md`
- `docs/01-architecture/api-contracts.md`
- `STATUS.md`

## AI Improve Implementation Changes

Backend/API changes:

- Added `POST /api/tasks/:taskId/ai/improve`.
- Added `POST /api/ai-suggestions/:suggestionId/apply`.
- Added `POST /api/ai-suggestions/:suggestionId/reject`.
- Added API env parsing for `AI_FEATURE_ENABLED`, `OPENAI_API_KEY`,
  `OPENAI_MODEL`, `OPENAI_TIMEOUT_MS`, and `OPENAI_MAX_OUTPUT_TOKENS`.
- Used OpenAI Responses API from backend code only with structured JSON Schema output.
- Validated AI output with shared Zod schema before storing or returning it.
- Persisted `originalPayload`, `suggestedPayload`, model name, and review status in
  the existing `ai_suggestions` table.
- Added `AI_UNAVAILABLE` and `RATE_LIMITED` error helpers.
- Created AI task activity events for suggestion created, applied, and rejected.

Frontend/UI changes:

- Added an Improve with AI panel inside the existing task detail sheet.
- Added loading, unavailable/error, pending review, applied, rejected, and partially
  applied states.
- Added original-vs-improved comparison for title, description, and priority.
- Added rendered acceptance criteria, suggested checklist items, risk notes, and
  recommended priority.
- Added apply and reject actions; applying refreshes task detail and board snapshot
  from backend response.
- Kept normal task editing available when AI is unavailable or fails.

Error/disabled behavior:

- Missing `OPENAI_API_KEY` returns `AI_UNAVAILABLE`; the task is not changed.
- `AI_FEATURE_ENABLED=false` returns `AI_UNAVAILABLE`; the task is not changed.
- OpenAI timeout, provider failure, empty output, invalid JSON, and invalid schema are
  converted to safe `AI_UNAVAILABLE` responses.
- OpenAI rate/quota responses return `RATE_LIMITED`.
- Without `DATABASE_URL`, DB-backed routes return structured `SERVICE_UNAVAILABLE`.

i18n/docs changes:

- Added English, Polish, and Czech AI panel translations.
- Added English, Polish, and Czech AI unavailable/rate-limited error translations.
- Updated `docs/01-architecture/ai-feature.md` and
  `docs/01-architecture/api-contracts.md` to match implemented endpoint names and
  payload shape.

## Files Changed In Final Recruiter Polish

- `README.md`
- `FINAL_RECRUITER_AUDIT.md`
- `docs/index.md`
- `STATUS.md`

## Final Recruiter Polish Changes

- Rewrote `README.md` as a recruiter-facing project overview with honest implemented,
  pending, and planned labels.
- Added setup, env var, migrate/seed, script, Docker/Coolify, known limitation, and
  recruiter review path sections.
- Created `FINAL_RECRUITER_AUDIT.md` with readiness summary, readiness score, completed
  surfaces, runtime-pending items, GitHub safety checklist, deployment checklist, final
  blockers, and decision.
- Updated `docs/index.md` to link the final recruiter audit.
- Checked GitHub safety surface for `.env`, real secrets, local absolute paths, false
  live-production claims, README quality, local Markdown links, and app translation keys.
- Confirmed no `.env` is tracked, `LICENSE` exists, `.env.example` is present, and
  `OPENAI_API_KEY` is not referenced by frontend code.

## Commands Last Run

Final recruiter polish validation completed on June 6, 2026.

| Command                                |  Result | Notes                                                                                                  |
| -------------------------------------- | ------: | ------------------------------------------------------------------------------------------------------ |
| `pnpm format`                          |    PASS | Formatted README, STATUS, docs index, and final audit.                                                 |
| `pnpm typecheck`                       |    PASS | Workspace TypeScript checks passed.                                                                    |
| `pnpm lint`                            |    PASS | ESLint passed with zero warnings.                                                                      |
| `pnpm build`                           |    PASS | Workspace build passed; Vite production build completed.                                               |
| `pnpm format:check`                    |    PASS | Prettier check passed.                                                                                 |
| `docker --version`                     |    PASS | Docker 27.3.1 is available in this environment.                                                        |
| `docker build -t agentboard-local .`   |    PASS | Docker image build completed successfully.                                                             |
| `printenv DATABASE_URL OPENAI_API_KEY` | NOT_SET | `DATABASE_URL` and `OPENAI_API_KEY` are not set in this shell.                                         |
| Translation key coverage script        |    PASS | EN/PL/CS app-source translation key coverage passed.                                                   |
| Markdown local link check              |    PASS | README, STATUS, final audit, and docs local links resolved.                                            |
| GitHub safety grep                     |    PASS | No real API keys or local absolute filesystem paths found; remaining hits are field names/doc wording. |
| DB-backed runtime smoke                | NOT_RUN | No explicitly confirmed safe local DB URL.                                                             |
| AI endpoint smoke test                 | NOT_RUN | No safe `DATABASE_URL` and backend-only `OPENAI_API_KEY` in this shell.                                |
| `pnpm db:migrate`                      | NOT_RUN | No explicitly confirmed safe local DB URL.                                                             |
| `pnpm db:seed`                         | NOT_RUN | No explicitly confirmed safe local DB URL.                                                             |

## Known Blockers

- No foundation blocker prevents continuing local product work.
- No critical task detail blocker remains after the focused audit.
- DB-backed smoke tests are blocked until `DATABASE_URL` points to a safe database.
- Dashboard runtime smoke tests are blocked until `DATABASE_URL` points to a safe
  database.
- Real AI endpoint smoke is blocked until both `DATABASE_URL` and backend-only
  `OPENAI_API_KEY` are configured in a safe local or staging environment.

## Latest Relevant Audit Docs

- `LOCAL_PRODUCT_AUDIT.md`
- `TASK_DETAIL_AUDIT.md`
- `docs/04-reviews/phase-3-4-audit.md`
- `docs/04-reviews/phase-0-3-audit.md`
- `docs/04-reviews/phase-audit.md`
- `docs/04-reviews/docs-review-and-fixes.md`

## Next Recommended Action

Fix Coolify routing and rerun live smoke:

```txt
Continue the AgentBoard project from the current repository state.

Decision from STATUS.md and LOCAL_RUNTIME_SMOKE.md: COOLIFY_DEPLOY_BLOCKED.

Local DB-backed runtime smoke passed on June 6, 2026. main was pushed to origin. Live verification is blocked because https://scalesoftware.matgac.pl presents TRAEFIK DEFAULT CERT and /api/health returns 503 no available server. Do not add new features. Do not rewrite dashboard. Keep OPENAI_API_KEY backend-only.

First read AGENTS.md, STATUS.md, LOCAL_RUNTIME_SMOKE.md, README.md, docs/index.md, docs/03-deployment/deployment-notes.md, docs/03-deployment/coolify-deployment.md, and docs/03-deployment/ovh-cloudflare-coolify-prep.md.

Fix the Coolify deployment path:
- Confirm Coolify pulled commit 6f01958 from main.
- Confirm the app service is built, running, and healthy.
- Assign scalesoftware.matgac.pl to the app service, not postgres.
- Confirm the app service target port is 3000.
- Ensure Traefik/Coolify issues a real certificate for scalesoftware.matgac.pl.
- Verify https://scalesoftware.matgac.pl/api/health returns the AgentBoard health JSON.
- Verify app root, demo login, board load, task create/edit/move, task detail checklist/comment, dashboard metrics, and AI unavailable or backend-only AI behavior.

Validation:
- Run pnpm typecheck
- Run pnpm lint
- Run pnpm build
- Run pnpm format:check

Update STATUS.md and LOCAL_RUNTIME_SMOKE.md with live deployment results before public recruiter sharing.
```
