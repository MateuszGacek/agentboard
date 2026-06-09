# Architecture

## Architecture goal

The architecture should be simple enough for fast implementation and strong enough to look professional in recruiter review.

Main priorities:

- TypeScript end-to-end,
- clear API/data boundaries,
- PostgreSQL persistence,
- fast Vite frontend,
- Hono backend,
- reusable UI patterns,
- Docker/Coolify deployment.

## Stack decision

### Frontend

| Area          | Choice                | Purpose                            |
| ------------- | --------------------- | ---------------------------------- |
| App           | React + Vite          | Fast SPA, no SEO requirement       |
| Routing       | TanStack Router       | Type-safe routes/search params     |
| Server state  | TanStack Query        | Cache, mutations, invalidation     |
| UI primitives | shadcn/ui + Radix     | Professional accessible components |
| Styling       | Tailwind CSS          | Fast design system iteration       |
| Drag/drop     | dnd-kit               | Kanban movement                    |
| Forms         | react-hook-form + Zod | Validated forms                    |
| Animation     | Motion                | Subtle microinteractions           |
| i18n          | i18next               | EN/PL/CS UI                        |

### Backend

| Area       | Choice                  | Purpose                       |
| ---------- | ----------------------- | ----------------------------- |
| API        | Hono on Node            | Lightweight typed API         |
| DB         | PostgreSQL              | Production-grade persistence  |
| ORM        | Drizzle                 | Typed schema/migrations       |
| Validation | Zod                     | Shared contracts              |
| Auth       | Custom minimal sessions | Explicit predictable MVP auth |
| AI         | OpenAI API              | Backend-only task improvement |

## Why not Next.js

SEO is not a project goal. A Vite SPA plus Hono API is faster to reason about, easier for coding agents to modify safely, and simpler to deploy as one container.

## Monorepo structure

```txt
kanban/
  apps/
    web/
      src/
        app/
        routes/
        components/
        features/
          auth/
          dashboard/
          workspaces/
          projects/
          boards/
          tasks/
          ai/
          settings/
        i18n/
        lib/
        styles/
    api/
      src/
        index.ts
        app.ts
        routes/
        middleware/
        modules/
          auth/
          workspaces/
          projects/
          boards/
          tasks/
          dashboard/
          ai/
        lib/
        public/            # built Vite SPA copied here for production
  packages/
    db/
      src/
        schema.ts
        client.ts
        migrate.ts
        seed.ts
      migrations/
    shared/
      src/
        api/
        schemas/
        types/
        constants/
    ui/
      src/
        components/
        primitives/
  docs/
```

## Runtime model

### Local development

```txt
Vite dev server: http://localhost:5173
Hono API:        http://localhost:3000/api
PostgreSQL:      localhost:5432
```

The frontend can proxy `/api` to the backend in Vite dev config.

### Production

One Node container serves both:

```txt
https://kanban.matgac.pl/api/* -> Hono API
https://kanban.matgac.pl/*      -> Vite SPA fallback
```

Production static serving requirements:

- build `apps/web` into `apps/web/dist`,
- copy dist into API package/container public directory,
- Hono serves static assets,
- unknown non-API routes return `index.html`,
- `/api/*` never falls through to SPA.

## API boundary

Frontend calls backend only through typed client helpers.

Recommended structure:

```txt
packages/shared/src/api/contracts.ts
apps/web/src/lib/api-client.ts
apps/api/src/routes/*.ts
```

All request/response shapes that affect both frontend and backend should be defined in shared Zod schemas or TypeScript types.

## Response envelope

```ts
export type ApiSuccess<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
};
```

## Auth architecture

MVP uses custom email/password sessions.

### Why custom sessions for MVP

- fully explicit behavior,
- fewer integration unknowns,
- clear DB tables,
- easy reviewer inspection,
- enough for recruitment project.

### Cookie

Cookie name:

```txt
ab_session
```

Cookie attributes:

| Attribute | Development | Production |
| --------- | ----------- | ---------- |
| httpOnly  | true        | true       |
| secure    | false       | true       |
| sameSite  | lax         | lax        |
| path      | /           | /          |
| maxAge    | 7 days      | 7 days     |

### Password rules

- minimum length: 8,
- maximum length: 128,
- hash with Argon2id or bcrypt,
- never return password hash through API.

### Session behavior

- Sessions stored in DB.
- Logout deletes current session and clears cookie.
- Expired sessions are rejected.
- Demo sessions have shorter TTL if configured.

## Workspace boundary enforcement

Every API request must derive access from authenticated user membership.

Mutation validation must check:

1. user is a member of workspace,
2. project belongs to workspace,
3. board belongs to project/workspace,
4. column belongs to board/workspace,
5. task belongs to board/workspace,
6. assignees are workspace members,
7. labels belong to workspace,
8. checklist/comment/activity belongs to task/workspace,
9. AI suggestion belongs to task/workspace.

Never trust IDs from request body without workspace ownership checks.

## Frontend state strategy

### Server state

Use TanStack Query for:

- current session,
- workspace/project/board snapshots,
- task detail,
- dashboard metrics,
- mutations.

### Client state

Use local state for:

- open/closed modals,
- active task sheet,
- active filters before applying,
- theme/language preference,
- draft form values.

Do not put server data in Zustand/Context unless there is a strong reason.

## Query keys

Suggested query keys:

```ts
["session"]["workspaces"][("workspace", workspaceId)][("projects", workspaceId)][
  ("board", boardId, filters)
][("task", taskId)][("dashboard", workspaceId, projectId)];
```

## Mutation rules

- Create/update/delete task invalidates board snapshot and task detail as needed.
- Move task should optimistically update board only if rollback exists.
- Safer MVP: disable dragging during mutation and replace board with server-returned snapshot.
- AI apply invalidates task detail and board snapshot.

## Error handling

All backend routes return structured errors.

Frontend should show:

- toast for mutation failure,
- inline form errors for validation,
- page-level error state for failed screen load,
- retry action where useful.

## Logging

MVP logging:

- request ID per API request,
- method/path/status/duration,
- AI errors logged server-side without full secrets,
- no sensitive user input in logs beyond what is necessary.

## Architecture risks and decisions

| Risk                         | Decision                                                 |
| ---------------------------- | -------------------------------------------------------- |
| Scope too broad              | Build vertical slices by phase                           |
| Auth ambiguity               | Use explicit DB sessions                                 |
| Column rename breaks metrics | Use stable column system keys/behaviors                  |
| Drag/drop ordering bugs      | Transactional move endpoint returns fresh board snapshot |
| AI cost/secrets              | Backend-only OpenAI, env-configured model, feature flag  |
| Mobile drag/drop poor UX     | Provide non-drag Move menu                               |
| Coolify routing issues       | One app service, no custom networks, healthcheck         |
