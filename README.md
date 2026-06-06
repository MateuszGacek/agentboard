# AgentBoard

**AI Kanban for software teams shipping with agents.**

AgentBoard is a full-stack recruitment portfolio project: a polished productivity SaaS for AI development agencies that need clearer tasks, better WIP control, and delivery visibility.

Live URL target:

```txt
https://scalesoftware.matgac.pl
```

> Current repository state: documentation-ready. Implementation should start from `CODEX_START_PROMPT.md`.

## Why this project exists

The assignment is to build a Kanban project, but a simple Trello clone is not enough for a strong full-stack recruitment review.

AgentBoard is designed to show:

- product/business thinking,
- professional UI/UX,
- reusable frontend architecture,
- backend API ownership,
- PostgreSQL data modeling,
- AI workflow integration,
- deployment readiness on a real server,
- public GitHub quality.

## Product positioning

AgentBoard helps AI software agencies turn vague work into clear, prioritized, reviewable delivery items.

Core idea:

```txt
Workspace → Project → Board → Column → Task
```

Differentiators:

- AI task improvement workflow,
- WIP limit warnings,
- delivery dashboard,
- task detail sheet with comments/checklists/activity,
- multilingual UI: English, Polish, Czech,
- responsive mobile/tablet-first Kanban UX,
- light/dark/system theme.

## Planned demo flow

A recruiter should be able to review the app in 2 minutes:

1. Open live URL.
2. Click **Open demo workspace**.
3. See dashboard with delivery metrics.
4. Open default AI agency project board.
5. Move a task between columns.
6. Open task detail sheet.
7. Use **Improve with AI** to compare original vs improved task content.
8. Switch language EN/PL/CS.
9. Switch theme light/dark/system.
10. Check mobile responsive behavior.

## Core features

### Kanban

- Workspaces, projects, boards, columns, tasks.
- Drag & drop on desktop.
- Mobile “Move to...” fallback.
- WIP limit warnings.
- Stable status semantics independent of column names.
- Task priority, labels, assignees, due dates, blocked state.
- Search and filters.

### Task detail

- Sheet/drawer UI.
- Editable title and description.
- Metadata controls.
- Checklist.
- Comments.
- Activity log.
- AI improvement comparison.

### Dashboard

- Total active tasks.
- Completed tasks this week.
- Overdue tasks.
- Blocked tasks.
- WIP limit issues.
- Completion rate.
- Tasks by status and priority.

### AI Improve

The AI feature is not a generic chatbot. It improves task quality:

- clearer title,
- better description,
- acceptance criteria,
- suggested subtasks,
- risk notes,
- side-by-side original vs improved review,
- accept/reject/apply partial workflow.

## Tech stack

### Frontend

- React + Vite + TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- shadcn/ui + Radix primitives
- dnd-kit
- react-hook-form + Zod
- Motion
- i18next

### Backend

- Hono on Node
- PostgreSQL
- Drizzle ORM
- Zod contracts
- Cookie-based sessions
- OpenAI API backend integration

### Deployment

- Docker Compose
- Coolify
- One production domain:

```txt
/api/* -> API
/*      -> SPA fallback
```

## Repository structure

Planned structure:

```txt
agentboard/
  apps/
    web/
    api/
  packages/
    db/
    shared/
    ui/
  docs/
  AGENTS.md
  CODEX_START_PROMPT.md
  STATUS.md
  README.md
  .env.example
  docker-compose.yml
  Dockerfile
```

## Local setup

After implementation, the expected workflow should be:

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Environment variables

See `.env.example`.

Important production variables:

```txt
DATABASE_URL=
SESSION_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
APP_URL=https://scalesoftware.matgac.pl
NODE_ENV=production
SEED_DEMO_DATA=true
```

## Deployment target

Target production setup:

- OVH VPS,
- Coolify connected to GitHub,
- Docker Compose build pack,
- PostgreSQL service,
- app service exposed on `https://scalesoftware.matgac.pl`,
- health check at `/api/health`.

## What to review first

For recruiters/technical reviewers:

1. Live demo flow.
2. `README.md` for project overview.
3. `docs/01_PRD.md` for product thinking.
4. `docs/05_DATABASE.md` for data modeling.
5. `docs/06_API_CONTRACTS.md` for backend design.
6. Board and task detail frontend code.
7. AI integration in backend.
8. Docker/Coolify deployment files.

## Current status

See `STATUS.md`.

## License

MIT — see `LICENSE`.
