# Coolify Environment Setup

Date: June 7, 2026

Deployment status: environment setup helper added. Do not treat this as a completed
deployment. No real secrets should be committed to this repository.

## Configured Variables

The Coolify application should have these environment variable names configured:

```txt
NODE_ENV
PORT
APP_URL
WEB_DIST_DIR
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
DATABASE_URL
SESSION_SECRET
SEED_DEMO_DATA
OPENAI_API_KEY
OPENAI_MODEL
```

Expected non-secret values:

```txt
NODE_ENV=production
PORT=3000
APP_URL=https://scalesoftware.matgac.pl
WEB_DIST_DIR=/app/apps/web/dist
POSTGRES_DB=agentboard
POSTGRES_USER=agentboard
SEED_DEMO_DATA=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
```

`POSTGRES_PASSWORD`, `DATABASE_URL`, and `SESSION_SECRET` are derived from local shell
environment variables and must never be committed or printed.

`DATABASE_URL` must URL-encode the password segment. The helper does this with
`encodeURIComponent(AGENTBOARD_POSTGRES_PASSWORD)`. Do not manually compose
`postgres://user:<raw-password>@postgres:5432/db` when the password may contain
reserved URL characters such as `/`, `#`, `?`, `%`, `@`, or `:`.

## Local Secret Generation

Generate new secrets in a local shell only:

```bash
export AGENTBOARD_POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"
export AGENTBOARD_SESSION_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
```

The helper also requires:

```bash
export COOLIFY_URL="http://198.100.155.183:8000"
export COOLIFY_TOKEN="<coolify-api-token>"
export COOLIFY_APP_UUID="cnlemhsfin1p0malfvchgf25"
```

Do not commit these values. Do not paste real secrets into repository files.

## Commands

Dry-run prints variable names only:

```bash
pnpm coolify:env:dry-run
```

Push creates missing variables and updates existing variables:

```bash
pnpm coolify:env:push
```

Verify confirms required variable names exist:

```bash
pnpm coolify:env:verify
```

The helper does not deploy the application.

## API Payload Notes

For Coolify application environment variables, the helper uses application env endpoints:

```txt
GET /api/v1/applications/{uuid}/envs
POST /api/v1/applications/{uuid}/envs
PATCH /api/v1/applications/{uuid}/envs
```

Create and update requests send non-preview env variables with:

```txt
key
value
is_buildtime=true
is_runtime=true
is_literal=false
is_multiline=false
is_preview=false
```

Preview env variables are ignored by this helper. `OPENAI_API_KEY` is optional and may
be left empty.

## Manual Coolify Checks Before Deploy

Confirm these settings in Coolify before clicking Deploy:

```txt
Pre-deployment: empty
Post-deployment: empty
Compose path: /docker-compose.yml
Domain: https://scalesoftware.matgac.pl
Public service: app
Public service port: 3000
Healthcheck path: /api/health
DATABASE_URL uses URL-encoded credentials
```

The expected internal database service is `postgres`.

After deployment, verify:

```txt
https://scalesoftware.matgac.pl/api/health
https://scalesoftware.matgac.pl/login
Demo login
Board load
Dashboard load
AI unavailable state when OPENAI_API_KEY is empty
```
