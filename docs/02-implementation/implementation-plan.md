# Implementation Plan

## Strategy

Build the product in vertical slices. Each phase should leave the app in a more working state.

Do not start AI or dashboard polish before board persistence and task movement work.

## Phase 0 — Repository foundation

Goal: create buildable monorepo.

Tasks:

- initialize pnpm workspace,
- root TypeScript configs,
- lint/format setup,
- `apps/web` Vite React app,
- `apps/api` Hono app,
- `packages/shared`,
- `packages/db`,
- root scripts,
- `.env.example`,
- `.gitignore`.

Acceptance:

```bash
pnpm install
pnpm typecheck
pnpm build
```

Must pass or blockers documented in `STATUS.md`.

## Phase 1 — Database and seed

Goal: persistent data foundation.

Tasks:

- add Drizzle,
- create schema,
- add indexes,
- migration setup,
- DB client,
- idempotent seed,
- demo template data.

Seed must include:

- demo workspace,
- AI agency project,
- board,
- default columns with system keys,
- tasks showing WIP/blocked/overdue/done,
- labels,
- demo members,
- comments/checklists/activity.

Acceptance:

- migrations run,
- seed can run multiple times without duplication,
- data can be queried from DB.

## Phase 2 — API foundation and auth

Goal: secure API skeleton.

Tasks:

- Hono app structure,
- request ID middleware,
- structured errors,
- health endpoint,
- auth endpoints,
- session cookie,
- password hashing,
- demo login,
- auth middleware,
- workspace membership guards.

Acceptance:

- `/api/health` works,
- register/login/logout/me works,
- demo login creates isolated demo workspace,
- unauthorized requests return structured `401`,
- workspace boundary checks exist.

## Phase 3 — Frontend app shell

Goal: polished shell before product features.

Tasks:

- TanStack Router setup,
- API client,
- TanStack Query provider,
- i18next setup,
- theme provider,
- app layout,
- sidebar/topbar,
- language switch,
- theme switch,
- login/register/demo screens,
- protected route handling,
- basic responsive shell.

Acceptance:

- user can open app,
- start demo session,
- see app shell,
- switch language,
- switch theme,
- session persists on refresh.

## Phase 4 — Board vertical slice

Goal: core Kanban works.

Tasks:

- board snapshot endpoint,
- board route,
- columns/tasks rendering,
- task create dialog,
- task edit sheet basic fields,
- delete confirmation,
- task move endpoint,
- dnd-kit desktop movement,
- mobile “Move to...” fallback,
- WIP warning,
- persisted ordering,
- cache invalidation.

Acceptance:

- demo board loads,
- create task persists,
- edit task persists,
- delete task persists,
- move/reorder persists after refresh,
- WIP warning appears when exceeded,
- mobile movement fallback works.

Checkpoint:

```bash
pnpm typecheck
pnpm build
```

Update `STATUS.md`.

## Phase 5 — Task detail depth

Goal: make task sheet feel like real product.

Tasks:

- labels,
- assignees,
- due date,
- blocked state/reason,
- checklist CRUD/toggle,
- comments CRUD,
- activity log,
- improved task card metadata.

Acceptance:

- task detail supports core properties,
- checklist persists,
- comments persist,
- activity shows meaningful events.

## Phase 6 — Search and filters

Goal: board productivity.

Tasks:

- filter toolbar,
- URL search params,
- query validation,
- API filtering,
- no-results state,
- reset filters.

Filters:

- text,
- priority,
- assignee,
- label,
- blocked,
- due state,
- column/status.

Acceptance:

- filters update URL,
- refresh keeps filters,
- board shows filtered results,
- no-results state works.

## Phase 7 — Dashboard

Goal: delivery visibility.

Tasks:

- dashboard API,
- metrics cards,
- status/priority summaries,
- WIP issue list,
- recent completed list,
- responsive layout.

Acceptance:

- metrics calculated from DB,
- no fake numbers,
- overdue/blocked/WIP definitions match docs,
- dashboard loads quickly.

## Phase 8 — AI Improve

Goal: meaningful AI feature.

Tasks:

- OpenAI client,
- structured output schema,
- improve endpoint,
- suggestion persistence,
- comparison UI,
- apply partial/all endpoint,
- reject endpoint,
- loading/error states,
- activity events.

Acceptance:

- missing API key is handled gracefully,
- AI call is backend-only,
- suggestion is stored,
- user can review/apply/reject,
- task/checklist updates after apply.

## Phase 9 — Polish and deployment

Goal: public demo readiness.

Tasks:

- mobile/tablet pass,
- accessibility pass,
- skeleton/empty/error states pass,
- performance check,
- Dockerfile,
- docker-compose.yml,
- entrypoint scripts,
- Coolify deployment notes,
- README screenshots/placeholders,
- final `STATUS.md`.

Acceptance:

- Docker build works,
- `/api/health` works,
- production routing serves API and SPA,
- public README is accurate,
- known limitations documented.

## Risk-based shortcuts

If time is limited, preserve quality by postponing:

- column CRUD/reorder,
- command menu actions,
- multiple templates,
- AI history page,
- dashboard drill-down,
- rich text editor.

Do not postpone:

- persistence,
- board movement,
- task detail,
- i18n/theme,
- demo session,
- basic deployment readiness.

## Continuation prompts

After each phase, use prompts like:

```txt
Continue from STATUS.md. Finish Phase 4 board vertical slice only. Do not start AI yet. Run pnpm typecheck and pnpm build, then update STATUS.md.
```

```txt
Continue from STATUS.md. Implement Phase 8 AI Improve using the contracts in docs/01-architecture/ai-feature.md. Keep OpenAI backend-only and handle missing API key gracefully.
```
