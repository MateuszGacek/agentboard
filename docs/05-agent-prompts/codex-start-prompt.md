# Codex Start Prompt

Paste this prompt into Codex after placing this documentation pack at the repository root.

---

You are building **AgentBoard**, a full-stack recruitment project and public GitHub portfolio application.

Before writing code, read these files in order:

1. `AGENTS.md`
2. `STATUS.md`
3. `README.md`
4. `docs/00-overview/project-brief.md`
5. `docs/00-overview/product-scope.md`
6. `docs/00-overview/business-ux-flow.md`
7. `docs/01-architecture/architecture.md`
8. `docs/01-architecture/frontend-ui-system.md`
9. `docs/01-architecture/database.md`
10. `docs/01-architecture/api-contracts.md`
11. `docs/01-architecture/ai-feature.md`
12. `docs/01-architecture/i18n.md`
13. `docs/03-deployment/coolify-deployment.md`
14. `docs/02-implementation/implementation-plan.md`
15. `docs/02-implementation/acceptance-criteria.md`
16. `docs/04-reviews/docs-review-and-fixes.md`
17. `docs/04-reviews/recruiter-readiness.md`

## Product target

Build a polished, fast, responsive AI Kanban SaaS for AI development agencies.

This is not a generic Trello clone. It must demonstrate product thinking, UI quality, reusable component architecture, backend/API/database design, OpenAI integration, production deployment readiness, and public GitHub presentation.

## Required stack

- pnpm monorepo
- React + Vite + TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- shadcn/ui + Radix primitives
- dnd-kit
- react-hook-form + Zod
- Motion for subtle UI animations
- i18next with browser language detection
- Hono API on Node
- PostgreSQL
- Drizzle ORM
- OpenAI API through backend only
- Docker Compose ready for Coolify

## Most important implementation rules

- Do not create a fake-only UI. Core Kanban data must persist in PostgreSQL.
- Keep API routes under `/api/*`.
- Serve the SPA under `/*` on the same production domain.
- Never expose `OPENAI_API_KEY` to frontend code.
- Use env-configurable `OPENAI_MODEL`, defaulting to `gpt-5-nano`.
- Do not infer task completion from column names. Use stable column `system_key` / `behavior` semantics.
- Validate workspace ownership for every mutation.
- Add EN/PL/CS translation keys for all visible UI text.
- Build mobile task movement fallback; do not rely only on drag/drop.
- Update `STATUS.md` after each implementation phase.

## Start with a vertical slice

Do not attempt the full product in one pass.

Implement Phase 0 through Phase 4 first:

### Phase 0 — repository foundation

Create:

- pnpm workspace,
- package scripts,
- TypeScript config,
- lint/format setup,
- Vite React app in `apps/web`,
- Hono API in `apps/api`,
- shared package in `packages/shared`,
- database package in `packages/db`,
- initial `.env.example`,
- root `.gitignore`.

Required commands:

```bash
pnpm install
pnpm typecheck
pnpm build
```

### Phase 1 — database and seed

Implement:

- Drizzle config,
- schema from `docs/01-architecture/database.md`,
- indexes,
- migration scripts,
- idempotent seed script,
- demo workspace/project/board/columns/tasks.

### Phase 2 — API foundation and auth

Implement:

- `GET /api/health`,
- request ID middleware,
- error envelope,
- auth register/login/logout/me/demo,
- httpOnly session cookie,
- workspace membership guards.

### Phase 3 — app shell

Implement:

- router,
- login/demo entry,
- app layout,
- sidebar/topbar,
- theme switch light/dark/system,
- language switch EN/PL/CS,
- loading/empty/error states,
- responsive shell.

### Phase 4 — board vertical slice

Implement:

- load board snapshot,
- render default columns/tasks,
- create task modal,
- edit task sheet,
- delete task confirmation,
- move/reorder task with dnd-kit on desktop,
- mobile “Move to...” fallback,
- persisted ordering,
- WIP warning,
- update board cache using TanStack Query.

After Phase 4, run:

```bash
pnpm typecheck
pnpm build
```

Update `STATUS.md` with:

- completed phases,
- commands run,
- known gaps,
- next recommended phase.

## Then continue in this order

1. comments, checklist, labels, assignee, due date, blocked state, priority,
2. search and filters with URL params,
3. dashboard metrics,
4. AI Improve backend + comparison UI,
5. responsive/accessibility polish,
6. Dockerfile + docker-compose + Coolify notes,
7. recruiter-ready README screenshots/placeholders,
8. final acceptance criteria pass.

## Definition of done for each phase

A phase is done only when:

- the relevant UI flow works,
- data persists,
- errors are handled,
- types pass,
- build passes unless a blocker is documented,
- `STATUS.md` is updated.

## Final response format

When you finish your current work session, respond with:

1. implemented files/features,
2. commands run and results,
3. known gaps,
4. exact next prompt to continue.

Do not claim the full product is done unless all acceptance criteria pass.
