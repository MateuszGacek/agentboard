# Coolify Deployment Blocker Report

Date: June 7, 2026

Mode: Coolify Deployment Blocker Local Repair

Deployment status: parked. No production deploy, SSH, live Coolify setting change, or
product feature work was performed.

## Previous Live Failure

- `https://kanban.matgac.pl/api/health` presented `TRAEFIK DEFAULT CERT`.
- `curl -k https://kanban.matgac.pl/api/health` returned `HTTP 503` with
  `no available server`.

## Suspected Cause Categories

The live symptoms still point to one or more Coolify/proxy/runtime configuration issues:

- app container unhealthy,
- failed app startup during migration/seed/env validation,
- domain attached to the wrong Compose service,
- Coolify routing to the wrong container port,
- proxy route has no healthy upstream,
- Cloudflare DNS/proxy mode interfering with initial certificate issuance,
- Traefik/Coolify proxy certificate not issued because backend was unhealthy or domain
  assignment was incomplete.

## Repository-Side Fixes

- Made API binding explicit:
  - production server now listens on `0.0.0.0`,
  - still uses `PORT`,
  - default remains `3000`.
- Made startup log match container binding:
  - `kanban-api listening on http://0.0.0.0:3000/api`.
- Made Compose app healthcheck use `process.env.PORT || 3000` instead of a hardcoded
  port.
- Changed Compose `SESSION_SECRET` interpolation to `${SESSION_SECRET:-}` so Compose can
  parse the file and the app itself emits the production validation error if the secret
  is missing or too short.
- Made `docker/entrypoint.sh` executable in the repository in addition to the Dockerfile
  `chmod`.
- Expanded deployment documentation with Cloudflare DNS, Coolify domain/port, 503, and
  Traefik default certificate checklists.
- Added non-DB Docker smoke instructions to deployment notes.

## Docker/Compose Findings

- `Dockerfile` already exposes `3000`.
- Healthchecks use Node 22 `fetch`; no curl/wget package is required in the runtime
  image.
- Built SPA assets exist at `/app/apps/web/dist` in the production image.
- Runtime command remains `pnpm start`, which runs the API server.
- `WEB_DIST_DIR=/app/apps/web/dist` is set in Dockerfile and Compose.
- Compose `DATABASE_URL` correctly uses the internal service hostname `postgres`.
- Compose exposes only the app container port `3000`; Postgres remains internal.
- No real secrets were added.

## Healthcheck And SPA Verification

Non-DB Docker smoke was run with `SKIP_DB_BOOTSTRAP=true` and no `DATABASE_URL`.

Result: PASS.

Verified:

- `GET /api/health` returned `200` JSON.
- `GET /login` returned `200 text/html` and the SPA root.
- `GET /api/boards/not-a-real-id` returned structured `503 SERVICE_UNAVAILABLE` JSON.
- The container was stopped after smoke.

## Manual Coolify Checks For Morning

Cloudflare DNS:

- `A kanban -> 198.100.155.183`
- Proxy status: DNS only for first deployment verification.

Coolify resource:

- Compose file: `docker-compose.yml`
- Public service: `app`
- Internal service: `postgres`
- Domain attached to: `app`
- Container port: `3000`
- Healthcheck path: `/api/health`

Coolify domain configuration:

- If Coolify has separate domain and port fields:
  - domain: `https://kanban.matgac.pl`
  - port: `3000`
- If Coolify requires the port inline:
  - domain: `https://kanban.matgac.pl:3000`

App environment:

```txt
NODE_ENV=production
PORT=3000
APP_URL=https://kanban.matgac.pl
WEB_DIST_DIR=/app/apps/web/dist
DATABASE_URL=postgres://kanban:<password>@postgres:5432/kanban
SESSION_SECRET=<at least 32 random characters>
SEED_DEMO_DATA=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
```

Postgres environment:

```txt
POSTGRES_DB=kanban
POSTGRES_USER=kanban
POSTGRES_PASSWORD=<same password as DATABASE_URL>
```

If `503 no available server` persists:

- check app container health,
- check app logs for env validation, DB wait, migration, or seed failure,
- verify the domain is attached to the `app` service,
- verify target container port is `3000`,
- verify the app log shows `0.0.0.0:3000`,
- check Coolify proxy logs,
- retry proxy/certificate issuance only after the app is healthy.

If `TRAEFIK DEFAULT CERT` persists:

- verify DNS points to `198.100.155.183`,
- set Cloudflare to DNS only,
- verify domain assignment in Coolify,
- verify Coolify proxy is running,
- verify backend app health,
- retry certificate issuance after healthy backend and DNS propagation.

## Exact Commands For Server-Side Triage If SSH Is Allowed Later

Do not run these from this local repair pass. They are for the operator during manual
server-side triage:

```bash
docker ps
docker logs <app-container> --tail=200
docker inspect <app-container> --format '{{json .State.Health}}'
docker logs coolify-proxy --tail=200
curl -i http://127.0.0.1:3000/api/health
```

If the app container is on a Docker network without host port publication, run the curl
from inside the app container instead:

```bash
docker exec -it <app-container> node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(async r => { console.log(r.status); console.log(await r.text()); process.exit(r.ok ? 0 : 1); }).catch(e => { console.error(e); process.exit(1); })"
```

## Next Deploy Attempt Checklist

1. Confirm `pnpm predeploy:check` passes locally.
2. Confirm `docker build -t kanban-local .` passes locally.
3. Confirm non-DB Docker smoke passes locally.
4. In Cloudflare, set `A kanban -> 198.100.155.183` and DNS only.
5. In Coolify, deploy Compose resource.
6. Attach `https://kanban.matgac.pl` to `app` service on port `3000`.
7. Verify app container health.
8. Verify `https://kanban.matgac.pl/api/health`.
9. Verify `/login` and `/app` SPA refresh.
10. Verify demo login, board, dashboard, and AI unavailable path.

## Remaining Risk

Repository configuration now validates locally, including a production-image non-DB
smoke. The remaining blocker is likely manual Coolify/Traefik/Cloudflare state:
service/domain attachment, target port, container health, or certificate issuance.
