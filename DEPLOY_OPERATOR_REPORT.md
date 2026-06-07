# Deploy Operator Report

Date: June 7, 2026

Mode: AgentBoard Deploy Operator Mode

## Summary

Deployment path is no longer blocked by the previously reported public 503/default
certificate symptom. The production URL returned healthy API and SPA responses, and a
non-UI production smoke passed for demo login, board snapshot, dashboard metrics, and
the expected AI unavailable path.

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

## Commands Run

```bash
git status --short --branch
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
docker build -t agentboard-local .
docker build --no-cache -t agentboard-local .
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

No redeploy was triggered from this session because:

- Coolify API variables were unavailable locally,
- SSH access timed out,
- the public production URL was already healthy during smoke checks.

The Docker build robustness fix is ready to push and should make the next Coolify build
less sensitive to build-time `NODE_ENV=production`.

## Production Smoke Result

PASS.

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

## Remaining Blockers

- Coolify environment verification could not be performed from this local shell.
- SSH diagnostics could not be performed because port 22 timed out.
- No Coolify redeploy was triggered from this session.
- Browser/UI smoke was not automated here; API-level production smoke passed.

## Exact Next Action

Push the Dockerfile hardening patch to `origin/main`. If Coolify is configured for
automatic deploys from `main`, watch the next Coolify build. If manual deploy is
required, trigger it from the Coolify UI, then rerun:

```bash
curl -i https://scalesoftware.matgac.pl/api/health
curl -I https://scalesoftware.matgac.pl/login
```

Then run a browser smoke for `/login`, demo session creation, board, task detail, and
dashboard.
