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
4. Assign `https://scalesoftware.matgac.pl` to the `app` service.
5. Set the app service port to `3000`.
6. Do not expose the `postgres` service publicly.
7. Add the production environment variables listed below.
8. Deploy.
9. Verify `https://scalesoftware.matgac.pl/api/health`.
10. Verify app routes such as `/login` and `/app` refresh without returning 404.

## Required Environment Variables

Set these in Coolify for the app service:

```txt
NODE_ENV=production
PORT=3000
APP_URL=https://scalesoftware.matgac.pl
WEB_DIST_DIR=/app/apps/web/dist
DATABASE_URL=postgres://agentboard:<password>@postgres:5432/agentboard
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

## Troubleshooting

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
