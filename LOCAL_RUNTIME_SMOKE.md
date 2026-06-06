# Local Runtime Smoke

## Summary

Date: June 6, 2026, 23:22 CEST

Result: PASS

AgentBoard passed a local DB-backed runtime smoke with Docker Compose PostgreSQL,
local API/web dev servers, seeded demo data, board/task mutations, task detail,
dashboard metrics, AI unavailable handling, and responsive checks.

## Environment

- Workspace: `/Users/mg/Documents/WebDev/vibeApp/scalesoftware`
- Branch: `main`
- Local database: PostgreSQL 16 via Docker Compose
- Host database URL:
  `postgres://agentboard:agentboard@localhost:5432/agentboard`
- API URL: `http://localhost:3000/api`
- Web URL: `http://localhost:5173`
- `OPENAI_API_KEY`: unset for this smoke
- AI expected behavior: graceful unavailable state

The first `docker compose up -d postgres` attempt failed because Compose interpolates
the whole file and `SESSION_SECRET` was unset for the app service. Smoke continued after
loading ignored `.env.local` values and recreating only Postgres with a temporary
outside-repo override that published `127.0.0.1:5432`.

## Command Results

| Command                                                                                                                           | Result          | Notes                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| `git commit -m "chore: document runtime smoke gate"`                                                                              | PASS            | Committed `STATUS.md` and `DELIVERY_PLAN.md`.                       |
| `docker compose up -d postgres`                                                                                                   | FAIL_THEN_FIXED | Initial run failed on missing `SESSION_SECRET` interpolation.       |
| `docker compose --env-file .env.local -f docker-compose.yml -f /tmp/agentboard-postgres-port.yml up -d --force-recreate postgres` | PASS            | Published Postgres on `127.0.0.1:5432` for host-side pnpm commands. |
| Postgres health wait                                                                                                              | PASS            | Container reported `healthy`.                                       |
| `pnpm db:migrate`                                                                                                                 | PASS            | Drizzle migration completed against verified local DB URL.          |
| `pnpm db:seed`                                                                                                                    | PASS            | Demo seed completed.                                                |
| `pnpm db:seed` second pass                                                                                                        | PASS            | Demo seed completed again without command failure.                  |
| `pnpm --filter @agentboard/api dev`                                                                                               | PASS            | API listened on `http://localhost:3000/api`.                        |
| `pnpm --filter @agentboard/web dev`                                                                                               | PASS            | Vite served `http://localhost:5173`.                                |
| `curl http://localhost:3000/api/health`                                                                                           | PASS            | Returned `{"ok":true,"service":"agentboard-api",...}`.              |
| `pnpm typecheck`                                                                                                                  | PASS            | Workspace TypeScript checks passed after documentation updates.     |
| `pnpm lint`                                                                                                                       | PASS            | ESLint passed with zero warnings after documentation updates.       |
| `pnpm build`                                                                                                                      | PASS            | Workspace build and Vite production build passed.                   |
| `pnpm format:check`                                                                                                               | PASS            | Passed after running `pnpm format` on updated markdown.             |

## Browser Smoke

| Scenario                        | Result | Notes                                                                                                                                  |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Open app and start demo session | PASS   | Demo login created isolated workspace and routed to seeded board.                                                                      |
| Board load                      | PASS   | Seeded board rendered with Backlog, Ready, In Progress, Review, and Done columns.                                                      |
| Create task                     | PASS   | Created `Runtime smoke task 2026-06-06`; board version advanced.                                                                       |
| Edit task                       | PASS   | Updated title, description, priority, due date, blocked state, and blocked reason.                                                     |
| Move task                       | PASS   | Status selector moved the task across columns and persisted after reload.                                                              |
| Checklist                       | PASS   | Added and toggled `Smoke checklist item`; activity updated.                                                                            |
| Comment                         | PASS   | Added `Smoke comment from local runtime test.`; activity updated.                                                                      |
| Persistence refresh             | PASS   | Reload preserved the smoke task, edits, move, and WIP warning.                                                                         |
| WIP warning                     | PASS   | Moving the smoke task to In Progress showed `WIP 3 / 2 Limit przekroczony`.                                                            |
| Dashboard                       | PASS   | Dashboard loaded DB-backed metrics, WIP warning, and recent smoke-task activity.                                                       |
| AI unavailable                  | PASS   | With no `OPENAI_API_KEY`, Improve with AI returned a visible unavailable alert with request ID `286cce21-5dd4-4407-bde7-fd294f3eac6c`. |
| Browser console                 | PASS   | No error or warning logs were reported by the browser tooling.                                                                         |

## Responsive Smoke

Board and dashboard were checked at `360`, `768`, `1024`, and `1440` widths.

| Width | Result | Notes                                                          |
| ----- | ------ | -------------------------------------------------------------- |
| 360   | PASS   | Board/dashboard core content rendered; no horizontal overflow. |
| 768   | PASS   | Board/dashboard core content rendered; no horizontal overflow. |
| 1024  | PASS   | Board/dashboard core content rendered; no horizontal overflow. |
| 1440  | PASS   | Board/dashboard core content rendered; no horizontal overflow. |

## Findings

- Local runtime smoke passes with `OPENAI_API_KEY` unset, verifying the intended
  graceful AI unavailable path.
- The date input required a click/select/type interaction in browser automation; after
  that interaction the due date persisted and rendered on the card/detail surfaces.
- No production Coolify verification has been completed from this repository state yet.

## Next Decision

`COOLIFY_DEPLOY_BLOCKED`

`main` was pushed to `origin` after local smoke passed. Live verification did not pass:

- `https://scalesoftware.matgac.pl/api/health` fails normal TLS verification because
  the server presents `TRAEFIK DEFAULT CERT`.
- `curl -k https://scalesoftware.matgac.pl/api/health` returns `HTTP 503` with
  `no available server`.
- A 12-attempt poll from 23:25 to 23:27 CEST stayed on `HTTP 503`.

Next required action is in Coolify/Traefik: confirm the app service is deployed and
healthy, the domain is assigned to the `app` service on port `3000`, and certificate
issuance/proxy routing are configured for `scalesoftware.matgac.pl`. After that, rerun
live smoke for `/api/health`, app root, demo login, board/task mutations, dashboard
metrics, and AI unavailable or backend-only AI behavior.
