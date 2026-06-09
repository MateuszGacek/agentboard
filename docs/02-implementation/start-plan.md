# Kanban Implementation Start Plan

## 1. Current Repository State

The repository currently contains the Kanban documentation pack and the beginning of the implementation foundation.

Present before implementation:

- `AGENTS.md`
- `docs/05-agent-prompts/codex-start-prompt.md`
- `README.md`
- `STATUS.md`
- `LICENSE`
- `.gitignore`
- `docs/00-overview/project-brief.md` through `docs/00-overview/external-references.md`

Phase 0 adds the monorepo foundation only. No production application features, database schema, API routes, UI flows, AI integration, or deployment files are implemented yet.

## 2. Missing Files Or Setup Gaps

Known gaps after Phase 0 foundation:

- Dependencies still need to be installed with `pnpm install`.
- No PostgreSQL schema, migrations, or seed data exist yet.
- No Hono API routes beyond package placeholders exist yet.
- No Vite UI flow exists yet.
- No Dockerfile or `docker-compose.yml` exists yet.
- This folder may still need Git repository initialization before public GitHub work.
- No screenshots or live deployment exist yet.

## 3. Recommended Implementation Order

Implementation must proceed in this order:

1. Phase 0 — Repository foundation
2. Phase 1 — Database foundation
3. Phase 2 — API foundation
4. Phase 3 — Frontend shell
5. Phase 4 — Board vertical slice

Only after Phase 4 is stable should work continue to comments, checklist, labels, assignees, filters/search, dashboard, AI Improve, responsive polish, Docker/Coolify deployment, and final README demo polish.

## 4. Exact First Vertical Slice

The first true product vertical slice is Phase 4:

- seeded board loads from PostgreSQL,
- board snapshot API returns columns and tasks,
- tasks can be created, edited, deleted, moved, and reordered,
- task detail opens in a sheet,
- desktop drag/drop persists ordering,
- mobile users can move tasks without dragging,
- WIP warnings are calculated from persisted data.

Phase 0 is not this vertical slice. Phase 0 only makes the repository ready to build that slice.

## 5. Commands That Should Be Created Later

The root workspace should expose these commands:

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format`
- `pnpm db:migrate`
- `pnpm db:seed`
- `pnpm start`

Phase 0 creates the command names. Later phases make the database, API, frontend, and production commands operational.

## 6. Risks Before Coding

- The product scope is intentionally broad; implementation must stay phase-based.
- Dashboard and AI Improve are valuable but must not start before board persistence works.
- Workspace ownership validation is security-critical and must be designed into API mutations from the start.
- Board ordering and cross-column moves need transactions and fresh board snapshots.
- Demo sessions must be isolated per reviewer, not shared global mutable state.
- Every visible UI string must use i18n keys for English, Polish, and Czech.
- OpenAI keys must remain backend-only.

## 7. Decisions Already Locked

- React + Vite + TypeScript frontend.
- TanStack Router for routing.
- TanStack Query for server state.
- Tailwind CSS and shadcn/ui for UI.
- dnd-kit for desktop drag/drop.
- Hono API on Node.
- PostgreSQL with Drizzle.
- Zod for shared validation and contracts.
- OpenAI API backend-only.
- Docker Compose and Coolify deployment target.
- One production domain: `/api/*` for API and `/*` for SPA fallback.

## 8. Decisions That Should Not Be Changed

- Do not introduce Next.js.
- Do not store MVP board state only in frontend memory.
- Do not expose `OPENAI_API_KEY` to the frontend.
- Do not infer completion from translated or renamed column names.
- Do not skip mobile task movement fallback.
- Do not start dashboard or AI before the board vertical slice works.
- Do not broaden v1 with realtime, billing, public API, uploads, or complex permissions.

## 9. Files That Should Be Created In Phase 0

Phase 0 should create or update:

- `docs/02-implementation/start-plan.md`
- `STATUS.md`
- `.env.example`
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- ESLint and Prettier config files
- `apps/web/`
- `apps/api/`
- `packages/shared/`
- `packages/db/`

`packages/ui/` can be added later when reusable UI components are actually needed.

## 10. Definition Of Done

### Phase 0

Phase 0 is done when:

- pnpm workspace exists,
- root scripts are present,
- TypeScript base config exists,
- ESLint and Prettier configs exist,
- app and package folder shells exist,
- `.env.example` exists without secrets,
- `STATUS.md` accurately reflects current setup,
- checks are run if dependencies are installed, or blockers are documented.

### Phase 1

Phase 1 is done when:

- PostgreSQL/Drizzle setup exists,
- schema matches `docs/01-architecture/database.md`,
- required indexes exist,
- migrations run cleanly,
- seed is idempotent,
- demo data includes workspace, project, board, columns, tasks, labels, members, comments/checklists/activity where required,
- seed demonstrates WIP warning, blocked, overdue, done, and vague AI-improvable tasks.
