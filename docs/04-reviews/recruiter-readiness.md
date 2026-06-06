# GitHub and Recruiter Readiness

## Goal

The public repository should look like a serious portfolio product, not a half-finished coding exercise.

A recruiter or technical reviewer should be able to:

- understand the product quickly,
- open a live demo,
- run locally if desired,
- inspect architecture,
- see honest project status,
- trust that no secrets are exposed.

## Public repo checklist

### Required before making repo public

```txt
[ ] No secrets committed
[ ] .env is ignored
[ ] .env.example exists
[ ] README is product/recruiter-ready
[ ] STATUS.md is accurate
[ ] LICENSE exists
[ ] Setup commands documented
[ ] Build/typecheck commands documented
[ ] Known limitations documented
[ ] Live URL section exists
[ ] Docker/Coolify deployment notes exist
```

### Required before sending to recruiter

```txt
[ ] Live demo works
[ ] Demo login works
[ ] Board data persists
[ ] Task movement works
[ ] Task detail works
[ ] Theme switch works
[ ] Language switch works
[ ] Mobile layout works
[ ] AI works or disabled state is explained
[ ] README has screenshots/GIF or clear demo script
[ ] Final STATUS.md reflects reality
```

### Nice polish

```txt
[ ] Lighthouse/performance notes
[ ] Short architecture diagram
[ ] Small demo GIF
[ ] “What to review first” section
[ ] Accessibility notes
[ ] Roadmap section
[ ] Clean commit history
```

## README structure

Final README should include:

### 1. Hero

- product name,
- tagline,
- live URL,
- screenshot/GIF.

### 2. Demo

- one-click demo instructions,
- demo behavior explanation,
- short flow checklist.

### 3. Why AgentBoard

Explain business problem:

- vague tasks,
- too much WIP,
- unclear delivery risk,
- AI teams need task clarity before implementation.

### 4. Features

Group by value:

- Kanban workflow,
- Task detail,
- AI Improve,
- Dashboard,
- i18n/theme,
- Responsive UX,
- Deployment.

### 5. Tech stack

Table with frontend/backend/deployment choices.

### 6. Architecture

Short explanation:

```txt
React SPA + Hono API + PostgreSQL
One production domain
Docker/Coolify deploy
```

Include monorepo tree.

### 7. Local development

Commands:

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

### 8. Testing/checks

Commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

### 9. Deployment

- Coolify overview,
- env vars,
- healthcheck,
- domain.

### 10. Project status

Link to `STATUS.md`.

### 11. Recruiter notes

Suggested review path:

```txt
Live demo → README → Board code → API contracts → DB schema → AI integration → Deployment files
```

## Screenshot plan

Add screenshots after implementation:

```txt
docs/assets/01-dashboard-light.png
docs/assets/02-board-dark.png
docs/assets/03-task-detail-ai.png
docs/assets/04-mobile-board.png
```

README can reference them with relative paths.

## Repository hygiene

Avoid:

- huge generated files,
- committed `.env`,
- screenshots with private data,
- irrelevant TODO comments,
- “temporary” code without explanation,
- claims that features work if they do not.

Prefer:

- clear commits,
- small PR-like implementation phases,
- `STATUS.md` updated honestly,
- comments only where they explain non-obvious choices,
- readable folder structure.

## Known limitations section

A good limitations section is a strength, not weakness.

Example:

```md
## Known limitations

- Realtime collaboration is intentionally out of scope for MVP.
- File attachments and email invites are planned for v2.
- Demo workspaces are temporary and may be cleaned up.
- AI feature requires `OPENAI_API_KEY`; without it, the app shows a disabled/error state.
```

## Recruiter impact checklist

A reviewer should notice within 2 minutes:

- polished UI,
- real demo access,
- task movement persistence,
- thoughtful task detail,
- AI comparison flow,
- dashboard metrics,
- multilingual/theme polish,
- clear README.

A technical reviewer will inspect:

- DB schema and indexes,
- task move transaction,
- workspace ownership checks,
- API contracts,
- shared validation,
- frontend component organization,
- OpenAI backend-only integration,
- Docker/Coolify setup.

## Final public release checklist

```txt
[ ] README updated from documentation state to implementation state
[ ] STATUS says what actually works
[ ] Live URL tested in incognito
[ ] Mobile tested on real/simulated phone
[ ] Demo user/session tested twice
[ ] Language switch tested EN/PL/CS
[ ] Theme switch tested light/dark/system
[ ] AI tested with valid key and missing-key fallback
[ ] No secrets in git history
[ ] Repo description set on GitHub
[ ] GitHub topics added: react, typescript, kanban, hono, postgres, drizzle, ai, vite
```
