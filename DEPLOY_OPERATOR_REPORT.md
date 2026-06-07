# Deploy Operator Report

Date: June 7, 2026

Mode: AgentBoard Deploy Operator Mode

## Summary

Current production blocker: the Docker build succeeds, but the Coolify application
runtime is unavailable through Traefik with `HTTP 503 no available server`. Coolify UI
reported the app container as restarting after deployment. SSH to the server is
unavailable from this environment, so active debugging must use Coolify Application
runtime logs or the Coolify Terminal.

Earlier in this session the production URL briefly returned healthy API and SPA
responses, including a non-UI production smoke for demo login, board snapshot,
dashboard metrics, and the expected AI unavailable path. After the later Coolify
deployment, production returned to `503`, so the latest state is runtime deployment
blocked.

A low-risk Dockerfile hardening patch was made so the dependency and build stages
install devDependencies even if the build environment exposes `NODE_ENV=production`.
Runtime remains production-oriented.

## Actions Taken

- Read required handoff and deployment files.
- Verified local git state before changes.
- Ran required local static validation.
- Built the Docker image locally.
- Patched the Dockerfile build stages for Coolify robustness.
- Re-ran all required validation after the patch.
- Checked local Coolify helper environment availability without printing values.
- Attempted safe read-only SSH diagnostics against the deployment server.
- Ran public production HTTP smoke checks.
- Ran production API smoke for demo auth, board snapshot, dashboard, and AI state.
- Re-checked deployment without SSH after Coolify showed the app as restarting.
- Confirmed current production `/api/health` returns `HTTP 503 no available server`.

## Commands Run

```bash
git status --short --branch
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
docker build -t agentboard-local .
docker build --no-cache -t agentboard-local .
pnpm predeploy:check
curl -i --max-time 30 https://scalesoftware.matgac.pl/api/health
curl -I --max-time 30 https://scalesoftware.matgac.pl/login
```

Read-only SSH attempts:

```bash
ssh deploy@198.100.155.183 "hostname && docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
ssh deploy@198.100.155.183 "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -80"
ssh deploy@198.100.155.183 "docker logs coolify-proxy --tail=150 2>&1 || true"
```

## Local Build Result

PASS.

- `pnpm typecheck`: PASS
- `pnpm lint`: PASS
- `pnpm build`: PASS
- `pnpm format:check`: PASS
- `pnpm check:i18n`: PASS
- `pnpm predeploy:check`: PASS
- `docker build -t agentboard-local .`: PASS
- `docker build --no-cache -t agentboard-local .`: PASS

The no-cache Docker build log confirmed:

- deps stage installs devDependencies with `pnpm install --prod=false --frozen-lockfile`,
- runtime stage installs production dependencies only,
- runtime `NODE_ENV=production` remains confined to the runtime stage.

## Dockerfile Change

Updated `Dockerfile` so:

- deps stage sets `NODE_ENV=development`,
- deps stage runs `pnpm install --prod=false --frozen-lockfile`,
- build stage sets `NODE_ENV=development`,
- runtime stage still sets `NODE_ENV=production`,
- runtime `WEB_DIST_DIR=/app/apps/web/dist` remains unchanged,
- `EXPOSE 3000` remains unchanged.

## Coolify Env Verify Result

BLOCKED_ON_LOCAL_ENV.

The local shell did not have these required variables available:

- `COOLIFY_URL`
- `COOLIFY_TOKEN`
- `COOLIFY_APP_UUID`
- `AGENTBOARD_POSTGRES_PASSWORD`
- `AGENTBOARD_SESSION_SECRET`

Because they were unavailable, `pnpm coolify:env:verify` and
`pnpm coolify:env:push` were not run.

## SSH Diagnostics

BLOCKED_BY_NETWORK_OR_SSH_ACCESS.

All read-only SSH commands to `deploy@198.100.155.183` timed out connecting to port 22:

```txt
ssh: connect to host 198.100.155.183 port 22: Operation timed out
```

No server logs, container names, container health state, volumes, or services were
modified.

## Deployment Result

Build passed in Coolify for commit `7988487`, then the app container entered a
restarting state. No redeploy was triggered from this local session because:

- Coolify API variables were unavailable locally,
- SSH access timed out,
- current debugging requires the runtime application logs from Coolify UI.

The Docker build robustness fix was pushed to `origin/main` in commit `7988487` and
should make the next Coolify build less sensitive to build-time `NODE_ENV=production`.

## Production Smoke Result

LATEST RESULT: FAILING AFTER REDEPLOY.

Current live check:

```txt
HTTP/2 503
no available server
```

Historical earlier check before the later restart loop:

`curl -i https://scalesoftware.matgac.pl/api/health` returned:

```txt
HTTP/2 200
content-type: application/json
{"ok":true,"service":"agentboard-api",...}
```

`curl -I https://scalesoftware.matgac.pl/login` returned:

```txt
HTTP/2 200
content-type: text/html; charset=UTF-8
```

Production API smoke passed:

```txt
Production smoke PASS: health, demo auth, board snapshot (5 tasks), dashboard (4 active tasks), AI unavailable.
```

Post-push health polling remained healthy:

```txt
attempt 1 200 application/json
attempt 2 200 application/json
attempt 3 200 application/json
```

## Remaining Blockers

- Coolify environment verification could not be performed from this local shell.
- SSH diagnostics could not be performed because port 22 timed out.
- Current production returns `HTTP 503 no available server`.
- Coolify reports the app container as restarting.
- The next required evidence is the first runtime error from Coolify
  Application -> Logs, not the Deployment Log.
- If Coolify Terminal is available, `docker ps -a` and `docker logs <app-container>`
  can provide the same evidence without external SSH.
- Browser/UI smoke is blocked until `/api/health` is back to HTTP 200.

## Exact Next Action

Open Coolify -> Application -> Logs and copy the first 30-80 runtime log lines after
the app container starts. Do not use Deployment Log for this step.

If Coolify Terminal is easier, run:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -80
docker logs <app-container-name> --tail=200 2>&1
```

Then rerun:

```bash
curl -i https://scalesoftware.matgac.pl/api/health
curl -I https://scalesoftware.matgac.pl/login
```

Likely runtime causes to identify from logs:

- `SESSION_SECRET`: update only `SESSION_SECRET` to at least 32 random characters.
- `DATABASE_URL`: fix the app `DATABASE_URL`.
- `password authentication failed`: Postgres password and existing volume likely do not
  match; do not delete the volume without explicit approval.
- `WEB_DIST_DIR` or missing `index.html`: verify `/app/apps/web/dist`.
- `Cannot find module`: fix runtime dependencies or Docker copy path.
- app running but healthcheck failing: verify port `3000` and `/api/health`.
- app healthy but Traefik 503: verify domain is attached to service `app` on port
  `3000`.
