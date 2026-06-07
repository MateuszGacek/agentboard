# ScopePilot

**Delivery clarity for AI software teams.**

Live URL placeholder: [https://scalesoftware.matgac.pl](https://scalesoftware.matgac.pl)

Production runtime has been recovered for the public URL. See [STATUS.md](STATUS.md)
for the current source of truth and latest verification results.

## Product Summary

ScopePilot is a full-stack product for AI/software teams that need to turn vague ideas
into clear delivery tasks, keep work-in-progress under control, and see risk early. It
is intentionally built as a real vertical slice with PostgreSQL persistence, typed API
contracts, authenticated workspace boundaries, responsive UI, and server-side OpenAI
integration.

The core workflow is:

```txt
Delivery space -> Project -> Workflow -> Column -> Task -> Task detail -> AI clarification
```

## Why This Exists

AI delivery teams often start from vague task notes, unclear acceptance criteria, and
too much work in progress. ScopePilot turns that into a reviewable workflow:

- workflows show current delivery state,
- task detail captures the implementation brief,
- WIP warnings highlight delivery pressure,
- delivery metrics summarize risk,
- AI clarification converts rough tasks into clearer execution plans.

## Feature Status

| Area                    | Status    | Notes                                                                |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| Auth/register/login     | Completed | Cookie sessions, password hashing, protected routes.                 |
| Demo session            | Completed | Creates isolated demo space/project/workflow data.                   |
| Space/project shell     | Completed | Shell and core project flow exist; full space management is planned. |
| Saved workflow board    | Completed | Workflow snapshot comes from PostgreSQL through authenticated API.   |
| Task create/edit/delete | Completed | Create, update, archive/delete, and detail APIs use persisted data.  |
| Drag/drop movement      | Completed | Desktop task movement persists across columns and ordering.          |
| Mobile move fallback    | Completed | Native status selector avoids relying on mobile drag/drop.           |
| WIP warnings            | Completed | Column WIP limit warnings use persisted counts.                      |
| Task detail             | Completed | Properties, labels, assignees, checklist, comments, activity.        |
| Delivery metrics        | Completed | Space metrics, WIP risk, due-soon, priority/status breakdowns.       |
| Clarify with AI         | Completed | Server-side OpenAI call, persisted suggestions, apply/reject UI.     |
| Search/filter           | Completed | Workflow filters run over the authenticated API snapshot.            |
| EN/PL/CS i18n           | Completed | Visible UI strings use translation keys.                             |
| Light/dark/system theme | Completed | Stored client preference with system mode support.                   |
| Responsive UI           | Completed | Shell, workflow, overview, and task sheet use responsive layouts.    |
| Docker/Coolify baseline | Completed | Dockerfile, Compose, entrypoint, healthcheck, deployment notes.      |
| Public deployment       | Completed | Public `/api/health` and `/login` returned `HTTP/2 200`.             |
| Runtime DB/OpenAI smoke | Pending   | Requires safe `DATABASE_URL` and server-only `OPENAI_API_KEY`.       |
| Realtime collaboration  | Planned   | Out of scope for the current recruiter-ready slice.                  |
| File uploads, billing   | Planned   | Future product work, intentionally not implemented.                  |

## Tech Stack

| Layer      | Choices                                             |
| ---------- | --------------------------------------------------- |
| Frontend   | React, Vite, TypeScript, TanStack Router/Query      |
| UI         | Tailwind CSS, shadcn/Radix-style primitives, lucide |
| Backend    | Hono on Node.js, structured API envelopes           |
| Database   | PostgreSQL, Drizzle ORM, migrations, seed data      |
| Contracts  | Shared Zod schemas and TypeScript types             |
| Auth       | HTTP-only session cookies, bcrypt password hashing  |
| AI         | OpenAI Responses API from backend only              |
| Deployment | Docker, Docker Compose, Coolify-oriented setup      |

## Architecture Summary

```txt
apps/web        React + Vite SPA
apps/api        Hono API and production SPA static serving
packages/db     Drizzle schema, migrations, seed, DB client
packages/shared Shared domain constants, Zod API contracts, types
docs/           Product, architecture, implementation, deployment, audits
```

Production is designed around one public domain:

```txt
/api/* -> Hono API
/*      -> Vite SPA fallback served by the API container
```

Security and boundary notes:

- `OPENAI_API_KEY` is server-only and must never be exposed in frontend code.
- Persisted routes require authentication and workspace membership checks.
- Migration and seed scripts require an explicit `DATABASE_URL`; there is no fallback DB URL.
- API responses use standard success/error envelopes.

## Local Setup

Prerequisites:

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+ for persisted-data runtime smoke

Install and configure:

```bash
pnpm install
cp .env.example .env
```

Edit `.env` for your local machine. At minimum, persisted-data routes need:

```txt
DATABASE_URL=postgres://agentboard:agentboard@localhost:5432/agentboard
SESSION_SECRET=change-me-in-local-env
```

AI clarification is optional for local review:

```txt
AI_FEATURE_ENABLED=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
```

Without `OPENAI_API_KEY`, the app should show a graceful AI unavailable/error state and
normal task editing remains usable.

## Database Migrate and Seed

Run these only when `DATABASE_URL` points to a safe local or staging database:

```bash
pnpm db:migrate
pnpm db:seed
```

The seed is designed to be idempotent and creates demo space/project/workflow/task data
for review.

## Development Scripts

```bash
pnpm dev            # run web and API in development
pnpm typecheck      # TypeScript checks across packages
pnpm lint           # ESLint with zero warnings
pnpm build          # package builds and Vite production build
pnpm format:check   # Prettier check
pnpm format         # apply Prettier formatting
pnpm check:i18n     # verify EN/PL/CS translation key parity
pnpm check:links    # verify internal markdown links
pnpm predeploy:check # typecheck, lint, build, format check, i18n parity
```

Useful package-level checks:

```bash
pnpm --filter @agentboard/web build
pnpm --filter @agentboard/api build
pnpm --filter @agentboard/shared build
pnpm --filter @agentboard/db build
```

## Local QA and Smoke

Pre-deploy local verification:

```bash
pnpm predeploy:check
```

This command does not require a database or OpenAI key. It runs static checks only:
typecheck, lint, build, formatting check, and i18n key parity.

Internal documentation links can be checked separately:

```bash
pnpm check:links
```

Persisted-data local smoke expects the API to already be running against a safe local
database URL:

```bash
# terminal 1
set -a; source .env.local; set +a
pnpm --filter @agentboard/api start

# terminal 2
pnpm smoke:local
```

`pnpm smoke:local` refuses non-local API URLs. By default it calls
`http://localhost:3000/api` and checks:

- `/api/health`
- demo session creation
- workflow snapshot
- delivery overview
- AI unavailable behavior when `OPENAI_API_KEY` is unset

To point it at another local API port:

```bash
SMOKE_API_URL=http://127.0.0.1:3001/api pnpm smoke:local
```

Environment requirements:

- `DATABASE_URL` is required for demo auth, workflow snapshot, delivery overview, and
  task/AI persisted routes. Use only a safe local or staging database.
- `OPENAI_API_KEY` is optional. When unset, smoke expects the server-side AI path to
  return the graceful `AI_UNAVAILABLE` response. When explicitly set, smoke expects AI
  clarification to succeed and may call OpenAI from the backend.

## Docker and Coolify Notes

Non-destructive local image build:

```bash
docker build -t agentboard-local .
```

Coolify deployment model:

1. Create a Docker Compose resource from this repository.
2. Assign `https://scalesoftware.matgac.pl` to the `app` service.
3. Use container port `3000`.
   - If the Coolify UI requires port in the domain value, use
     `https://scalesoftware.matgac.pl:3000`.
   - If the UI has a separate port field, use `https://scalesoftware.matgac.pl` and
     port `3000`.
4. Keep the `postgres` service internal.
5. Set production env vars in Coolify, especially `DATABASE_URL`,
   `SESSION_SECRET`, `APP_URL`, and optional `OPENAI_API_KEY`.
6. Deploy and verify `/api/health`, demo login, workflow, task detail, overview, and AI
   unavailable/working state.

For first verification, Cloudflare should point `A scalesoftware` to `198.100.155.183`
with DNS-only proxy status. If Coolify returns `503 no available server`, check app
health, target service, target port `3000`, app logs, proxy logs, and whether the domain
is attached to the `app` service. If the browser shows `TRAEFIK DEFAULT CERT`, verify
DNS, domain assignment, proxy state, and certificate issuance after the app is healthy.

The container entrypoint waits for the DB, runs migrations, optionally seeds demo data,
then starts the API server.

More detail: [docs/03-deployment/deployment-notes.md](docs/03-deployment/deployment-notes.md).

## Known Limitations

- Production runtime is live through manual recovery containers; Coolify saved
  configuration should still be synchronized before relying on one-click redeploy.
- Runtime DB smoke needs a safe `DATABASE_URL` when run locally.
- Real AI smoke is pending until a server-only `OPENAI_API_KEY` is configured.
- Full multi-workspace management UI is planned.
- Realtime collaboration, file uploads, billing, and invites are planned future work.

## Recruiter Review Path

1. Live app/demo at the target URL once deployed.
2. Workflow vertical slice: `apps/web/src/features/boards` and
   `apps/api/src/modules/boards`.
3. Task detail: checklist/comment/activity UI and persisted mutations.
4. Delivery metrics: `apps/web/src/features/dashboard` and
   `apps/api/src/modules/workspaces/dashboard.ts`.
5. AI feature: `apps/api/src/modules/ai`, task detail AI panel, and shared contracts.
6. Backend contracts: `packages/shared/src/api/contracts.ts`.
7. Database schema: `packages/db/src/schema.ts` and migrations.

## Documentation

- Current state: [STATUS.md](STATUS.md)
- Morning handoff: [MORNING_HANDOFF.md](MORNING_HANDOFF.md)
- Final recruiter audit: [FINAL_RECRUITER_AUDIT.md](FINAL_RECRUITER_AUDIT.md)
- Documentation map: [docs/index.md](docs/index.md)
- API contracts: [docs/01-architecture/api-contracts.md](docs/01-architecture/api-contracts.md)
- Database: [docs/01-architecture/database.md](docs/01-architecture/database.md)
- Deployment: [docs/03-deployment/deployment-notes.md](docs/03-deployment/deployment-notes.md)

## License

MIT - see [LICENSE](LICENSE).
