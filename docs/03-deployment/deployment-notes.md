# AgentBoard Deployment Notes

Target domain:

```txt
https://scalesoftware.matgac.pl
```

## Production Model

AgentBoard deploys as one public app service plus one internal PostgreSQL service.

```txt
/api/* -> Hono API
/*      -> Vite SPA static files with index.html fallback
```

The app container listens on port `3000`. In production, the API server serves files from
`WEB_DIST_DIR`, which defaults to the built Vite output in the Docker image:

```txt
/app/apps/web/dist
```

## Coolify Setup

1. Create a new Docker Compose resource from the GitHub repository.
2. Use the repository root as the base directory.
3. Use `docker-compose.yml` as the Compose file.
4. Assign the public domain to the `app` service, not `postgres`.
5. Set the app service port to container port `3000`.
   - If the Coolify UI domain field requires the port inline, use
     `https://scalesoftware.matgac.pl:3000`.
   - If the UI has separate domain and port fields, use
     `https://scalesoftware.matgac.pl` plus port `3000`.
6. Do not expose the `postgres` service publicly.
7. Add the production environment variables listed below.
8. Deploy.
9. Verify `https://scalesoftware.matgac.pl/api/health`.
10. Verify app routes such as `/login` and `/app` refresh without returning 404.

## Cloudflare DNS Checklist

For the first deployment attempt, prefer DNS-only mode until Coolify proxy routing and
certificate issuance are verified:

```txt
Type: A
Name: scalesoftware
Value: 198.100.155.183
Proxy status: DNS only
```

After the app is healthy and Coolify has issued a valid certificate, Cloudflare proxying
can be evaluated separately. If Cloudflare is proxied too early, certificate and proxy
errors can be harder to distinguish from app health failures.

## Required Environment Variables

Set these in Coolify for the app service:

```txt
NODE_ENV=production
PORT=3000
APP_URL=https://scalesoftware.matgac.pl
WEB_DIST_DIR=/app/apps/web/dist
DATABASE_URL=postgres://agentboard:<url-encoded-password>@postgres:5432/agentboard
SESSION_SECRET=<at least 32 random characters>
SEED_DEMO_DATA=true
```

PostgreSQL service variables:

```txt
POSTGRES_DB=agentboard
POSTGRES_USER=agentboard
POSTGRES_PASSWORD=<strong password>
```

Optional future AI variables:

```txt
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
OPENAI_TIMEOUT_MS=20000
OPENAI_MAX_OUTPUT_TOKENS=1200
```

Session timing variables:

```txt
SESSION_TTL_DAYS=7
DEMO_SESSION_TTL_HOURS=24
DEMO_CLEANUP_DAYS=7
```

## Startup Behavior

The Docker entrypoint runs before the API server:

1. fails fast if `DATABASE_URL` is missing,
2. waits until the configured database host and port are reachable,
3. runs `pnpm db:migrate`,
4. runs `pnpm db:seed` only when `SEED_DEMO_DATA=true`,
5. starts the API server.

Migrations and seed never target a fallback database URL. The seed script is designed to
be idempotent.

To skip DB bootstrap for emergency diagnostics only:

```txt
SKIP_DB_BOOTSTRAP=true
```

## Healthcheck

Endpoint:

```txt
GET /api/health
```

The health endpoint does not require authentication and does not require a DB query. The
Dockerfile and Compose healthchecks call this endpoint from inside the app container.

Healthcheck expectations:

- HTTP status: `200`
- Response type: JSON
- Example payload:

  ```json
  {
    "ok": true,
    "service": "agentboard-api",
    "timestamp": "2026-06-07T00:00:00.000Z"
  }
  ```

- No redirect.
- No database dependency.
- Container port: `3000`.

## Troubleshooting

### `503 no available server`

Coolify/Traefik `503 no available server` usually means the proxy has no healthy backend
for the domain. Check these in order:

- The `app` service is deployed and running.
- The `app` container is healthy.
- Coolify points the domain to the `app` service, not the `postgres` service.
- Coolify routes to container port `3000`.
- `PORT=3000` is present in the app environment.
- The app logs include:

  ```txt
  agentboard-api listening on http://0.0.0.0:3000/api
  ```

- The app healthcheck is configured for `/api/health`.
- `DATABASE_URL` uses `postgres` as the host when using the Compose Postgres service.
- `DATABASE_URL` URL-encodes the password segment. Use `encodeURIComponent(password)`
  before placing it between `agentboard:` and `@postgres`.
- `SESSION_SECRET` is set to at least 32 non-placeholder characters.
- Migration/seed did not fail before the API server started.
- Coolify proxy logs do not show a stale route or upstream service mismatch.

### Traefik default certificate

If the browser or `curl` shows `TRAEFIK DEFAULT CERT`, verify:

- DNS `A scalesoftware -> 198.100.155.183` is correct.
- Cloudflare is set to DNS only for first deployment verification.
- The domain is assigned to the correct Coolify resource and `app` service.
- The Coolify proxy is running.
- The app container is healthy before certificate issuance is retried.
- The domain is configured as `https://scalesoftware.matgac.pl` with container port
  `3000`, or as `https://scalesoftware.matgac.pl:3000` if the Coolify UI requires the
  port inline.
- Certificate issuance has been retried after DNS propagation and a healthy backend are
  confirmed.

### 404 on domain

Check:

- Coolify domain is assigned to the `app` service, not `postgres`.
- Coolify points to container port `3000`.
- The app container is healthy.
- Startup did not fail during migration or seed.

### DB unavailable

Check:

- `DATABASE_URL` uses the Compose service hostname `postgres`.
- `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` match the URL.
- The Postgres service is healthy.
- The app logs show the database wait step succeeding.

### Migrations failed

Check:

- `DATABASE_URL` points to the intended production database.
- The database user can create tables, indexes, enums, and foreign keys.
- The failure appears before server startup; this is intentional.
- Fix the migration or database permissions, then redeploy.

### SPA route refresh returns 404

Check:

- `NODE_ENV=production`.
- `WEB_DIST_DIR=/app/apps/web/dist`.
- `apps/web/dist/index.html` exists in the image.
- Non-API routes are not configured as API routes in an external proxy.

### Cookies not working

Check:

- `APP_URL=https://scalesoftware.matgac.pl`.
- The app is accessed over HTTPS.
- Browser requests use the same domain for app and API.
- `SESSION_SECRET` is set and is not the local placeholder.
- Coolify proxy forwards HTTPS correctly.

## Local Docker Build

Non-destructive build check:

```bash
docker build -t agentboard-local .
```

The build does not run migrations or seed. Migrations and seed run only when a container
starts with a configured `DATABASE_URL`.

## Non-DB Docker Smoke

For repository-side validation without touching a production database:

```bash
docker build -t agentboard-local .
docker run --rm -d \
  --name agentboard-nodb-smoke \
  -p 127.0.0.1:3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e APP_URL=http://localhost:3000 \
  -e SESSION_SECRET=local-docker-smoke-secret-change-me-32 \
  -e WEB_DIST_DIR=/app/apps/web/dist \
  -e SKIP_DB_BOOTSTRAP=true \
  agentboard-local
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/login
curl -i http://127.0.0.1:3000/api/boards/not-a-real-id
docker stop agentboard-nodb-smoke
```

Expected results:

- `/api/health` returns `200` JSON.
- `/login` returns the SPA HTML.
- A DB-backed API route returns a structured `503 SERVICE_UNAVAILABLE` JSON response
  when `SKIP_DB_BOOTSTRAP=true` and no `DATABASE_URL` is configured.

## Morning Coolify Checklist

Before the next manual deploy attempt:

1. Confirm Cloudflare DNS:
   - `A scalesoftware -> 198.100.155.183`
   - DNS only for initial verification.
2. Confirm Coolify resource:
   - Compose file: `docker-compose.yml`
   - Public service: `app`
   - Internal service: `postgres`
   - Public domain attached to `app`
   - Container port: `3000`
   - Healthcheck path: `/api/health`
3. Confirm app env:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `APP_URL=https://scalesoftware.matgac.pl`
   - `WEB_DIST_DIR=/app/apps/web/dist`
   - `DATABASE_URL=postgres://agentboard:<url-encoded-password>@postgres:5432/agentboard`
   - `SESSION_SECRET=<at least 32 random characters>`
   - `SEED_DEMO_DATA=true`
4. Deploy manually in Coolify.
5. If it fails, inspect in this order:
   - app container logs,
   - app health status,
   - migration/seed output,
   - domain attached service,
   - port mapping/target port,
   - Coolify proxy logs,
   - certificate issuance state.

Useful server-side commands for the operator to run manually if SSH is allowed later:

```bash
docker ps
docker logs <app-container> --tail=200
docker inspect <app-container> --format '{{json .State.Health}}'
docker logs coolify-proxy --tail=200
curl -i http://127.0.0.1:3000/api/health
```

Do not run those from this local repair pass; they are for the next manual server-side
triage only.
