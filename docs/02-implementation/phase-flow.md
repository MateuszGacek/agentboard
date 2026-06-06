# Phase Flow

This file summarizes the implementation order. `STATUS.md` remains the source of truth
for the active phase and next action.

## Order

| Phase                 | Focus                                   | Rule                                                                                 |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| 0                     | Repository foundation                   | Establish workspace, scripts, config, env example, and package layout.               |
| 1                     | Database and seed                       | Implement PostgreSQL schema, migrations, indexes, and idempotent demo seed.          |
| 2                     | API and auth                            | Implement Hono API foundation, sessions, auth, workspace access, and board snapshot. |
| 3                     | Frontend app shell                      | Implement routing, providers, auth screens, theme, i18n, and protected shell.        |
| 4                     | Board vertical slice                    | Implement DB-backed tasks, movement, detail sheet, mobile fallback, and WIP warning. |
| Deployment baseline   | Production serving                      | Prepare one-domain API plus SPA serving, Docker, healthcheck, and startup flow.      |
| Future product phases | Dashboard, AI, and richer task metadata | Start only after the board vertical slice and deployment prerequisites are stable.   |

## Guardrails

- Do not start dashboard or AI before the board vertical slice is verified.
- Do not start deployment unless the latest status/audit says deployment is the next
  allowed action.
- Do not treat historical prompts as current instructions when `STATUS.md` says
  something newer.
