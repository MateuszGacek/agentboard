# Deploy Operator Report

Date: June 7, 2026

Mode: AgentBoard Deploy Operator Mode

## Summary

Production is recovered. The original Docker build succeeded, but the Coolify
application runtime was unavailable through Traefik with `HTTP 503 no available server`.
Coolify UI runtime logs confirmed the app container restarted because `DATABASE_URL` was
assembled with a raw Postgres password containing URL-reserved characters, causing
`scripts/wait-for-db.mjs` to throw `ERR_INVALID_URL`. After that was fixed, Coolify
reported the app container healthy, but Traefik still returned `503` because the app was
not attached to the external `coolify` network used by the proxy.

Because the database contents were disposable, production was recovered by replacing the
runtime on the host: old app/Postgres containers and the old disposable Postgres volume
were removed, a new Postgres container was created with an alphanumeric password, and
the app was started from image
`cnlemhsfin1p0malfvchgf25_app:f899a051633f6ea41dfb9817f65288aa703cb91d`. The app is
attached to a private DB network and the external `coolify` proxy network. Runtime
secrets were generated on the server and stored only at
`/root/agentboard-runtime-secrets.txt` with `600` permissions.

A low-risk Dockerfile hardening patch was made so the dependency and build stages
install devDependencies even if the build environment exposes `NODE_ENV=production`.
Runtime remains production-oriented. A follow-up deployment patch now requires explicit
`DATABASE_URL`, generates it with URL-encoded credentials in the Coolify helper, and
redacts invalid URL startup errors. The Compose app service is also attached to the
external `coolify` network so Traefik can reach port `3000`.

Current live checks pass:

- `curl -i https://scalesoftware.matgac.pl/api/health`: `HTTP/2 200`
- `curl -I https://scalesoftware.matgac.pl/login`: `HTTP/2 200`

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
- Earlier confirmed production `/api/health` returned `HTTP 503 no available server`.
- Recovered production on the host with disposable fresh Postgres and an alphanumeric DB
  password.
- Started `agentboard-app` from commit image `f899a051633f6ea41dfb9817f65288aa703cb91d`.
- Attached the app to `agentboard_internal` for Postgres and `coolify` for Traefik.
- Verified production `/api/health` and `/login` now return `HTTP/2 200`.

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

Production recovery commands were executed through the authenticated Coolify host
terminal because direct SSH from the local shell timed out. The recovery script did not
print generated secrets into the repo or this report.

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
restarting state. Repo-side fixes were pushed afterward:

- `fba6c3e`: require explicit `DATABASE_URL`, URL-encode generated DB credentials, and
  redact invalid URL startup errors,
- `f899a05`: attach the app service to the external `coolify` network for Traefik.

The later Coolify-managed deploy built `f899a05`, but the existing database credential
state still prevented a clean runtime. Because database data did not need to be
preserved, production was recovered manually on the host with a fresh disposable
Postgres container and an app container from the `f899a05` image.

## Production Smoke Result

LATEST RESULT: PASS AFTER CLEAN RUNTIME RECOVERY.

Current live checks:

```txt
curl -i https://scalesoftware.matgac.pl/api/health
HTTP/2 200
content-type: application/json
{"ok":true,"service":"agentboard-api",...}

curl -I https://scalesoftware.matgac.pl/login
HTTP/2 200
content-type: text/html; charset=UTF-8
```

Historical earlier check before the later restart loop also passed:

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

## Remaining Operational Notes

- Coolify environment verification could not be performed from this local shell.
- SSH diagnostics could not be performed because port 22 timed out.
- The live runtime is currently manual Docker containers:
  `agentboard-app` and `agentboard-postgres`.
- The manual app container is routed by Traefik labels and is attached to the external
  `coolify` network.
- Before the next Coolify UI redeploy, sync or recreate the Coolify app envs so
  `POSTGRES_PASSWORD`, `SESSION_SECRET`, and `DATABASE_URL` match the intended
  production database. Otherwise Coolify can replace the working manual runtime with its
  stale env state.

## Confirmed Runtime Root Cause

The Coolify-managed app container failed before the API started because `DATABASE_URL`
was not a valid URL. The Postgres password segment must be URL-encoded before it is
inserted into
`postgres://agentboard:<password>@postgres:5432/agentboard`.

## Exact Next Action

Production is currently live. The next maintenance action is to bring Coolify's saved
application configuration back in sync with the recovered runtime or recreate the
Coolify application cleanly from `origin/main`.

If Coolify Terminal is needed for diagnostics, run:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -80
docker logs <app-container-name> --tail=200 2>&1
```

Then rerun:

```bash
curl -i https://scalesoftware.matgac.pl/api/health
curl -I https://scalesoftware.matgac.pl/login
```

If the next deploy still fails, inspect app logs for the next runtime error. The June 7,
2026 recovery intentionally deleted the old disposable Postgres volume after approval
because database contents were not needed.
