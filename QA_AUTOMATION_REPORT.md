# QA Automation Report

Date: June 7, 2026

Mode: Automated QA and Smoke Scripts

Deployment status: parked. No production deploy, SSH, architecture rewrite, destructive
DB command, or new product feature was performed.

## Scripts Added

- `pnpm check:i18n`
  - Runs `scripts/check-i18n.mjs`.
  - Verifies EN/PL/CS `common.json` translation key parity.
- `pnpm check:links`
  - Runs `scripts/check-markdown-links.mjs`.
  - Verifies internal markdown file links and local markdown anchors.
- `pnpm smoke:local`
  - Runs `scripts/local-smoke.mjs`.
  - Refuses non-local API URLs.
  - Expects a local API already running on `http://localhost:3000/api` unless
    `SMOKE_API_URL` is set to another localhost/127.0.0.1 URL.
  - Checks health, demo auth, board snapshot, dashboard, and AI unavailable behavior
    when `OPENAI_API_KEY` is unset.
- `pnpm predeploy:check`
  - Runs `typecheck`, `lint`, `build`, `format:check`, and `check:i18n`.
  - Does not require `DATABASE_URL` or `OPENAI_API_KEY`.

## README Updates

- Documented `pnpm predeploy:check`.
- Documented `pnpm check:i18n` and `pnpm check:links`.
- Documented local smoke flow with the API running from `.env.local`.
- Documented what requires `DATABASE_URL`.
- Documented when `OPENAI_API_KEY` is optional and when smoke may call OpenAI.
- Corrected feature status: board search/filter is completed; realtime remains planned.

## Smoke Results

Local DB URL was verified as explicit localhost before running DB-backed smoke.

Command:

```bash
pnpm smoke:local
```

Result: PASS.

Smoke covered:

- `GET /api/health`
- `POST /api/auth/demo`
- `GET /api/boards/:boardId`
- `GET /api/workspaces/:workspaceId/dashboard`
- `POST /api/tasks/:taskId/ai/improve` graceful `AI_UNAVAILABLE` path with
  `OPENAI_API_KEY` unset

Observed output:

```txt
Local smoke PASS: health, demo auth, board snapshot (5 tasks), dashboard (4 active tasks), AI unavailable.
```

## Commands Run

| Command                | Result | Notes                                                |
| ---------------------- | ------ | ---------------------------------------------------- |
| `pnpm check:i18n`      | PASS   | EN/PL/CS share 287 keys.                             |
| `pnpm check:links`     | PASS   | 39 markdown files scanned.                           |
| `pnpm smoke:local`     | PASS   | Local API/DB smoke passed with AI unavailable state. |
| `pnpm typecheck`       | PASS   | Workspace TypeScript checks passed.                  |
| `pnpm lint`            | PASS   | ESLint passed with zero warnings.                    |
| `pnpm build`           | PASS   | Workspace build passed.                              |
| `pnpm format:check`    | PASS   | Prettier check passed.                               |
| `pnpm predeploy:check` | PASS   | Static deploy-readiness command passed.              |

## How To Use Before Deploy

Run static checks first:

```bash
pnpm predeploy:check
pnpm check:links
```

If a safe local database is available, run local smoke:

```bash
set -a; source .env.local; set +a
pnpm --filter @agentboard/api start
pnpm smoke:local
```

Do not point `SMOKE_API_URL` at production. The script intentionally rejects non-local
hosts.

## Limitations

- `pnpm smoke:local` assumes the API is already running; it does not start services,
  migrate, seed, or manage Docker.
- The smoke script creates an isolated demo workspace through the normal demo API.
- The smoke script only calls OpenAI when `OPENAI_API_KEY` is explicitly present in the
  environment. With no key, it verifies the graceful unavailable path.
- No browser viewport screenshots are included; browser automation remains a separate
  manual/tooling-dependent QA step.
