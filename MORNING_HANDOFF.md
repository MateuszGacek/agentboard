# Kanban Morning Handoff

## Executive summary

Kanban is locally deploy-ready as a repository. Overnight work improved DB/API
ownership safety, product polish, board interactions, accessibility/responsive/i18n,
repeatable QA scripts, and Coolify-facing deployment configuration/docs.

No production deploy was performed. No SSH was used. No live Coolify, Traefik,
Cloudflare, OVH, or production DNS settings were changed. No secrets were committed.

The remaining blocker is manual infrastructure state: the previous live attempt served
`TRAEFIK DEFAULT CERT` and returned `HTTP 503 no available server`. Repository-side
Docker build and non-DB Docker smoke now pass, so the next action is a manual Coolify
deployment/configuration check.

## Overnight commits

| Commit    | Summary                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| `1d2756a` | Hardened DB/API contracts, ownership validation, indexes, and seed verification.          |
| `d1e6621` | Polished product UX and responsive UI across shell, dashboard, board, and task detail.    |
| `957cce3` | Added high-impact product interactions: board filters/search, hints, shortcuts, settings. |
| `cdb96d4` | Improved accessibility, responsive layouts, and EN/PL/CS i18n coverage.                   |
| `206ee75` | Added QA scripts: i18n check, markdown link check, local smoke, predeploy check.          |
| `bf94a6e` | Hardened Coolify deployment configuration and deployment-blocker documentation.           |

## Product status

| Area        | Status      | Notes                                                                                       |
| ----------- | ----------- | ------------------------------------------------------------------------------------------- |
| DB/API      | PASS        | Index migration added, ownership checks tightened, standard envelopes preserved.            |
| Auth        | PASS        | Login/register/demo/session routes are DB-backed with cookie sessions.                      |
| Board       | PASS        | DB-backed board supports create/edit/archive/move plus search and filters.                  |
| Task detail | PASS        | Properties, labels, assignees, checklist, comments, activity, metadata, delete, AI panel.   |
| Dashboard   | PASS        | Workspace-scoped DB metrics, WIP, due-soon, priority/status, activity.                      |
| AI          | PASS        | Backend-only Improve path, persisted suggestions, apply/reject, graceful unavailable state. |
| UX/UI       | PASS        | Shell, dashboard, board, task detail, settings, loading/error/empty states polished.        |
| Responsive  | PASS        | Code-level improvements done; prior local runtime smoke checked 360/768/1024/1440 widths.   |
| i18n        | PASS        | EN/PL/CS key parity passes with 287 keys.                                                   |
| QA          | PASS        | `predeploy:check`, `check:i18n`, `check:links`, and `smoke:local` exist and pass.           |
| Deployment  | READY_LOCAL | Docker build and non-DB Docker smoke pass; live Coolify remains manually blocked.           |

## Validation results

Final validation on June 7, 2026:

| Command                          | Result | Notes                                                     |
| -------------------------------- | ------ | --------------------------------------------------------- |
| `pnpm typecheck`                 | PASS   | Workspace TypeScript checks passed.                       |
| `pnpm lint`                      | PASS   | ESLint passed with zero warnings.                         |
| `pnpm build`                     | PASS   | Workspace build and Vite production build passed.         |
| `pnpm format:check`              | PASS   | Prettier check passed.                                    |
| `pnpm predeploy:check`           | PASS   | Typecheck, lint, build, format check, i18n parity passed. |
| `docker build -t kanban-local .` | PASS   | Production image built locally.                           |
| `pnpm smoke:local`               | PASS   | Local API/DB smoke passed with AI unavailable path.       |

## Local runtime result

Local DB-backed runtime remains PASS.

Final local smoke command:

```bash
pnpm smoke:local
```

Result:

```txt
Local smoke PASS: health, demo auth, board snapshot (5 tasks), dashboard (4 active tasks), AI unavailable.
```

The smoke used `.env.local` with `DATABASE_URL` pointing to localhost. `OPENAI_API_KEY`
was unset, so the smoke verified the intended graceful `AI_UNAVAILABLE` path and did not
call OpenAI.

## Deployment blocker status

Previous live symptoms:

- `https://kanban.matgac.pl/api/health` served `TRAEFIK DEFAULT CERT`.
- `curl -k https://kanban.matgac.pl/api/health` returned
  `HTTP 503 no available server`.

Repository-side deployment state:

- API listens on `0.0.0.0`.
- `PORT` default is `3000`.
- Dockerfile exposes `3000`.
- Docker/Compose healthchecks target `/api/health`.
- `WEB_DIST_DIR=/app/apps/web/dist`.
- `docker/entrypoint.sh` is executable.
- Non-DB production-image smoke passed:
  - `/api/health`: `200` JSON
  - `/login`: SPA HTML
  - DB-backed route without DB: structured `503 SERVICE_UNAVAILABLE`

Remaining blocker is manual Coolify/Traefik/Cloudflare state.

## Exact manual Coolify checklist

1. Cloudflare DNS check
   - Confirm `A kanban -> 198.100.155.183`.
   - Set proxy status to DNS only for first deployment verification.

2. Coolify project/resource check
   - Resource uses this repository.
   - Base directory is repository root.
   - Compose file is `docker-compose.yml`.
   - Public service is `app`.
   - `postgres` remains internal only.

3. Domain/service/port check
   - Attach the domain to `app`, not `postgres`.
   - Target container port is `3000`.
   - If Coolify has separate fields: domain `https://kanban.matgac.pl`, port `3000`.
   - If Coolify requires inline port: `https://kanban.matgac.pl:3000`.
   - Healthcheck path is `/api/health`.

4. Env vars check
   - `NODE_ENV=production`
   - `PORT=3000`
   - `APP_URL=https://kanban.matgac.pl`
   - `WEB_DIST_DIR=/app/apps/web/dist`
   - `DATABASE_URL=postgres://kanban:<password>@postgres:5432/kanban`
   - `SESSION_SECRET=<at least 32 random characters>`
   - `SEED_DEMO_DATA=true`
   - `POSTGRES_DB=kanban`
   - `POSTGRES_USER=kanban`
   - `POSTGRES_PASSWORD=<same password used in DATABASE_URL>`
   - `OPENAI_API_KEY=` can stay empty for AI unavailable smoke.

5. Deploy
   - Deploy manually in Coolify.
   - Watch app logs for DB wait, migration, optional seed, then:

     ```txt
     kanban-api listening on http://0.0.0.0:3000/api
     ```

6. `/api/health`
   - Verify `https://kanban.matgac.pl/api/health`.
   - Expected: `200` JSON with `ok: true`.

7. `/login`
   - Verify `https://kanban.matgac.pl/login`.
   - Refresh should return SPA HTML, not 404.

8. Demo login
   - Start demo session from the login page.
   - Expected: isolated workspace and board load.

9. Board/dashboard/AI smoke
   - Board: create task, open detail, edit, move, refresh.
   - Task detail: checklist item, comment, labels/assignees if available.
   - Dashboard: metrics load from DB.
   - AI: with no key, verify graceful unavailable alert; with backend key, verify generate/apply/reject.

## UX review checklist for morning

- Desktop 1440
  - Home, login, app shell, board, task detail, dashboard, settings.
- Laptop 1024
  - Board filter row wrapping, dashboard grid, task sheet width.
- Tablet 768
  - Mobile nav drawer, board columns, task detail sheet, settings cards.
- Mobile 360
  - Auth/header switchers, board filters, create dialog, task detail, dashboard cards.
- Light/dark/system
  - Toggle in app shell and auth pages.
  - Verify contrast and active states.
- EN/PL/CS
  - Switch languages from shell/auth pages.
  - Check long PL/CS strings on board filters, dashboard cards, settings, task detail.
- Task flow
  - Demo login, create task, edit core fields, move via drag/status select, archive/delete.
- Dashboard flow
  - WIP warnings, due-soon, recent activity, empty/error state if DB unavailable.
- AI state
  - No key: graceful unavailable with request ID.
  - Optional key: backend-only generate/apply/reject.

## Remaining blockers

- Production is not verified live.
- Live domain previously showed Traefik default certificate and `503 no available server`.
- Manual Coolify/Traefik/Cloudflare checks are required.
- Browser screenshot automation was unavailable in this session; morning manual visual QA is still recommended.
- Real AI provider smoke still requires an explicitly configured backend-only `OPENAI_API_KEY`.

## Next exact action

Manual Coolify deployment/configuration attempt:

1. Confirm Cloudflare DNS-only `A kanban -> 198.100.155.183`.
2. Confirm Coolify domain is attached to `app` on container port `3000`.
3. Confirm production env vars, especially `DATABASE_URL` and `SESSION_SECRET`.
4. Deploy manually.
5. Verify `/api/health`, `/login`, demo login, board, dashboard, and AI unavailable path.
6. Update `STATUS.md` with live smoke results before recruiter sharing.
