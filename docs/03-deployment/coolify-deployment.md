# Coolify Deployment

## Target

```txt
https://scalesoftware.matgac.pl
```

Infrastructure:

- OVH VPS,
- Coolify connected to GitHub,
- Docker Compose resource,
- one app service,
- one PostgreSQL service.

## Production routing

Use one public domain:

```txt
/api/* -> Hono API
/*      -> Vite SPA fallback
```

This avoids CORS complexity and separate API subdomain setup.

## Production server model

The app container should:

1. start a Node/Hono server on port `3000`,
2. handle `/api/*` routes,
3. serve static files from built Vite output,
4. return `index.html` for unknown non-API routes,
5. expose `/api/health`.

## Coolify notes

When using Docker Compose in Coolify:

- `docker-compose.yml` is the source of truth,
- environment variables should be declared in Compose,
- assign the domain to the app service,
- attach the public `app` service to both the default Compose network and the external
  `coolify` network so Coolify's proxy can reach it,
- if the app listens on container port `3000`, specify the domain with port `:3000` in the Coolify service domain field,
- do not expose Postgres publicly,
- do not expose Postgres on the external `coolify` network.

## Environment variables

Production required:

```txt
NODE_ENV=production
APP_URL=https://scalesoftware.matgac.pl
PORT=3000
DATABASE_URL=
SESSION_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
AI_FEATURE_ENABLED=true
SEED_DEMO_DATA=true
```

For the Compose Postgres service, set `DATABASE_URL` with the `postgres` hostname and a
URL-encoded password segment:
`postgres://agentboard:<url-encoded-password>@agentboard-postgres-db:5432/agentboard`.

For new disposable databases, prefer an alphanumeric `POSTGRES_PASSWORD` to avoid URL
reserved-character mistakes. Still keep `DATABASE_URL` explicit so the app service and
Postgres service cannot drift.

Optional:

```txt
OPENAI_TIMEOUT_MS=20000
OPENAI_MAX_OUTPUT_TOKENS=1200
SESSION_TTL_DAYS=7
DEMO_SESSION_TTL_HOURS=24
DEMO_CLEANUP_DAYS=7
LOG_LEVEL=info
```

## Docker Compose shape

Expected services:

```txt
app
postgres
```

Recommended app service behavior:

- build from root Dockerfile,
- depends on postgres healthcheck,
- expose only container port 3000 to Coolify proxy,
- no host port mapping unless explicitly needed,
- healthcheck calls `/api/health`.

Recommended Postgres behavior:

- internal only,
- persistent volume,
- healthcheck using `pg_isready`,
- credentials through env vars.

## Clean Recovery

If production data is disposable and the app is blocked by stale database credentials,
the safe recovery path is:

1. remove only the affected app/Postgres containers,
2. remove the affected Postgres volume after explicit approval,
3. generate a new alphanumeric `POSTGRES_PASSWORD` and `SESSION_SECRET`,
4. update `POSTGRES_PASSWORD` and `DATABASE_URL` together,
5. redeploy from a commit containing the encoded `DATABASE_URL` and `coolify` network
   fixes,
6. verify `/api/health` and `/login` return non-503 responses.

The June 7, 2026 emergency recovery used manual containers named `agentboard-postgres`
and `agentboard-app` from image
`cnlemhsfin1p0malfvchgf25_app:f899a051633f6ea41dfb9817f65288aa703cb91d`. Before the
next Coolify UI redeploy, sync or recreate the Coolify app configuration so it does not
replace the recovered runtime with stale environment values.

## Idempotent startup

Production entrypoint must be safe to run multiple times.

Startup sequence:

```txt
1. wait for database connection
2. run migrations
3. if SEED_DEMO_DATA=true, run idempotent seed
4. cleanup expired demo data if implemented
5. start Node server
```

Rules:

- migration failure should fail container startup,
- seed must use upsert/stable slugs or safe duplicate checks,
- seed must not create duplicate default boards on every restart,
- demo cleanup must never delete non-demo users/workspaces,
- server starts only after migrations finish.

## Healthcheck

Endpoint:

```txt
GET /api/health
```

Expected response:

```json
{
  "data": {
    "ok": true,
    "service": "agentboard-api",
    "version": "1.0.0",
    "timestamp": "2026-06-06T00:00:00.000Z",
    "database": "ok"
  }
}
```

Healthcheck should:

- not require auth,
- check DB connectivity lightly,
- respond quickly.

## Build scripts

Expected commands after implementation:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
pnpm start
```

Root scripts should expose:

```json
{
  "scripts": {
    "dev": "...",
    "build": "...",
    "start": "...",
    "typecheck": "...",
    "lint": "...",
    "db:migrate": "...",
    "db:seed": "..."
  }
}
```

## Deployment checklist

Before deploying:

- GitHub repo is pushed,
- `.env.example` exists but `.env` is not committed,
- Dockerfile exists,
- `docker-compose.yml` exists,
- healthcheck works locally,
- build passes,
- migrations run locally,
- seed is idempotent.

In Coolify:

1. Create new resource.
2. Select GitHub repository.
3. Choose Docker Compose build pack.
4. Use repository root as base directory.
5. Point to `docker-compose.yml`.
6. Set required env vars.
7. Assign domain to app service.
8. Confirm app service listens on port 3000.
9. Deploy.
10. Open `/api/health`.
11. Open app root.
12. Test demo session.

## Common pitfalls

### No available server / 404

Likely causes:

- wrong service domain/port in Coolify,
- failed healthcheck,
- app not listening on `0.0.0.0`,
- container crashed during migration/seed,
- custom networks breaking proxy discovery.

### API works but SPA route 404

Likely cause:

- missing SPA fallback to `index.html` for non-API routes.

### Login cookie not stored

Likely causes:

- wrong `APP_URL`,
- `secure` cookie on non-HTTPS local dev,
- wrong SameSite/domain config.

### AI fails in production

Likely causes:

- missing `OPENAI_API_KEY`,
- `AI_FEATURE_ENABLED=false`,
- model not available to account,
- provider timeout/rate limit.

Frontend should display a graceful error and keep task unchanged.

## Acceptance criteria

- Production app loads from `https://scalesoftware.matgac.pl`.
- `/api/health` returns successful JSON.
- Demo login works.
- Board data persists after page refresh.
- OpenAI key is not present in frontend bundle.
- Restarting container does not duplicate seed data.
- Coolify env vars are documented.
