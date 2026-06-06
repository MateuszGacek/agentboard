# AGENTS.md — AgentBoard Implementation Rules

This repository contains the documentation and future implementation for **AgentBoard**, a recruitment-grade full-stack product: an AI-assisted Kanban platform for AI software agencies.

Codex and other coding agents must treat this file as the highest-priority project instruction after user/system instructions.

## Mission

Build a real, deployable, fast, polished product — not a static mockup and not a generic Trello clone.

The project must demonstrate:

- business/product thinking,
- strong frontend architecture,
- backend/API/database ownership,
- secure-enough production defaults,
- reusable UI system,
- responsive UX,
- AI integration used in a meaningful workflow,
- public GitHub/recruiter readiness.

## Non-negotiables

1. **TypeScript end-to-end.** Avoid `any` unless justified in a comment.
2. **Persist core data in PostgreSQL.** No fake-only board state for MVP features.
3. **API keys stay backend-only.** Never expose `OPENAI_API_KEY` in frontend code.
4. **All visible UI text must use i18n keys** for `en`, `pl`, and `cs`.
5. **Core flows must be mobile usable.** Desktop drag/drop alone is not enough.
6. **Use stable status semantics.** Do not infer completion from a translated or renamed column title.
7. **Protect workspace boundaries.** Every mutation must validate that all referenced IDs belong to the authenticated user's workspace.
8. **Prefer working vertical slices over broad unfinished features.**
9. **Update `STATUS.md` after each meaningful implementation chunk.**
10. **Do not commit secrets, real API keys, or private infrastructure details.**

## Product scope priority

### Must work before polish

- auth + demo session,
- seeded demo workspace,
- workspace/project/board loading,
- board snapshot API,
- tasks CRUD,
- task move/reorder persisted in DB,
- task detail sheet,
- WIP limit warning,
- theme switch: light/dark/system,
- language switch: EN/PL/CS,
- responsive mobile task movement fallback,
- Docker/Coolify readiness,
- recruiter-ready README.

### Important after vertical slice

- comments,
- checklist,
- labels,
- assignee,
- due date,
- priority,
- search/filter with URL params,
- dashboard metrics,
- AI Improve flow.

### v1.1 / postpone if time is limited

- rich text editor,
- realtime collaboration,
- file uploads,
- email invitations,
- complex role permissions,
- multiple board templates,
- advanced analytics,
- billing,
- public API.

## Architecture boundaries

Use the documented monorepo structure:

```txt
apps/web       React + Vite app
apps/api       Hono API and static SPA serving in production
packages/db    Drizzle schema, migrations, seed
packages/shared Zod schemas, API types, constants
packages/ui    reusable app UI components if useful
```

Frontend must not duplicate backend validation logic manually. Put shared input/output schemas in `packages/shared` where practical.

## Coding style

- Small modules, explicit names, predictable file structure.
- Prefer boring, readable code over clever abstractions.
- Keep components reusable but do not over-abstract too early.
- Co-locate feature-specific components under `features/*`.
- Keep shadcn primitives thin and compose product components on top.
- Use TanStack Query for server state. Avoid global client stores for server data.
- Use URL search params for board filters where useful.
- Use optimistic updates only when rollback/error handling is implemented.

## API rules

Use a consistent response envelope:

```ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
};
```

Every endpoint must return structured errors. Avoid leaking internal errors.

## Database rules

- Use UUID primary keys.
- Add `created_at` and `updated_at` where useful.
- Add foreign-key indexes for common joins.
- Use transactions for multi-table board mutations.
- Board movement must be atomic and return a fresh board snapshot or affected columns.
- Seed data must be idempotent.

## UI/UX rules

- Premium SaaS, Linear-like, developer-tool aesthetic.
- Use modals/sheets/dialogs intentionally to reduce page clutter.
- Task detail should be a sheet/drawer on desktop and full-height sheet/dialog on mobile.
- Mobile board must not require horizontal dragging to be usable.
- Show loading, empty, error, disabled, and success states.
- Avoid excessive animations; use subtle Motion transitions.
- Design for accessibility: keyboard focus, labels, contrast, escape-to-close, aria where needed.

## AI rules

The AI feature is **Improve with AI**, not a general chatbot.

Backend-only OpenAI call:

- reads existing task context,
- returns structured JSON,
- stores suggestion,
- lets user review original vs improved content,
- supports accept/reject/apply partial.

Default env model:

```txt
OPENAI_MODEL=gpt-5-nano
```

The model must be configurable through env.

## Deployment rules

Production target:

```txt
https://scalesoftware.matgac.pl
```

Use one domain:

```txt
/api/* -> Hono API
/*      -> Vite SPA fallback served by the API container
```

Docker startup must be idempotent:

1. wait for Postgres,
2. run migrations safely,
3. optionally seed demo data idempotently,
4. start server,
5. expose `/api/health`.

## Public GitHub rules

Before public review:

- `.env.example` exists,
- no secrets,
- README explains live demo and local setup,
- STATUS explains what works and known limitations,
- commands work or known gaps are documented,
- code is clean enough for recruiter review.
