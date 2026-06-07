# OVH + Cloudflare + Coolify Preparation

This document prepares the production deployment path only. It does not start
deployment, change infrastructure, or add new product behavior.

## 1. Target Production URL

```txt
https://scalesoftware.matgac.pl
```

## 2. Current Infrastructure

- OVH VPS name: `vps-0e49b011.vps.ovh.ca`
- Provider: OVHcloud VPS
- VPS region/location: Beauharnois, Canada
- IPv4 target: `198.100.155.183`
- IPv6: available, but IPv4 is enough for the initial deployment
- App target port: `3000`
- Domain: `matgac.pl`
- Subdomain: `scalesoftware.matgac.pl`

The VPS IP address is not a secret. Real credentials, SSH keys, passwords, tokens, API
keys, database URLs, and private infrastructure details must never be committed.

## 3. DNS Decision

Current authoritative DNS appears to be Cloudflare because the domain uses these
nameservers:

```txt
alla.ns.cloudflare.com
arch.ns.cloudflare.com
```

The recommended path is:

- keep Cloudflare nameservers,
- add the `A` record in Cloudflare DNS,
- do not rely on the OVH DNS zone record unless nameservers are switched to OVH.

Recommended Cloudflare DNS record:

```txt
Type: A
Name: scalesoftware
Target: 198.100.155.183
Proxy status: DNS only for initial setup
TTL: Auto
```

Use `DNS only` for the first deployment and debugging pass so DNS answers expose the
actual VPS IP. This makes it easier to separate DNS, Coolify routing, TLS, and app
health issues. Cloudflare proxy can be enabled later after the app, HTTPS, cookies, and
healthcheck are confirmed.

Alternative path:

- switch domain nameservers to OVH only if all existing records are copied first,
- this is not recommended right now because it may affect mail/MX records and existing
  DNS configuration.

## 4. OVH DNS Note

The OVH DNS zone currently contains this record:

```txt
scalesoftware.matgac.pl A 198.100.155.183
```

That record may be inactive publicly while Cloudflare nameservers are authoritative. Do
not assume the OVH DNS record works publicly until this command confirms OVH
nameservers:

```bash
dig NS matgac.pl
```

## 5. DNS Verification Commands

```bash
dig NS matgac.pl
dig A scalesoftware.matgac.pl +short
nslookup scalesoftware.matgac.pl
```

Expected results:

- `dig NS matgac.pl` should currently show Cloudflare nameservers.
- After adding the record in Cloudflare, `dig A scalesoftware.matgac.pl +short` should
  return `198.100.155.183` if the record is `DNS only`.
- If Cloudflare proxy is enabled, the result may show Cloudflare IPs instead of the VPS
  IP.

## 6. Coolify Preparation

Prepare Coolify with these target values:

- Project: `scalesoftware-agentboard`
- Environment: `production`
- Future app type: Docker Compose
- Domain: `https://scalesoftware.matgac.pl`
- App container port: `3000`
- Healthcheck path: `/api/health`

Do not start deployment until the repository, environment variables, database, DNS, and
manual checklist are ready.

## 7. Required Production Environment Variables

Set production values in Coolify, not in committed files:

```env
NODE_ENV=production
PORT=3000
APP_URL=https://scalesoftware.matgac.pl
DATABASE_URL=
SESSION_SECRET=
SEED_DEMO_DATA=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
```

When using the Compose Postgres service, `DATABASE_URL` should use the `postgres`
hostname and URL-encode the password segment:
`postgres://agentboard:<url-encoded-password>@postgres:5432/agentboard`.

Generate `SESSION_SECRET` with:

```bash
openssl rand -base64 32
```

`OPENAI_API_KEY` is optional until the AI feature is implemented. Do not commit `.env`.
Update `.env.example` only with placeholders, never real secrets.

## 8. Future Deployment Requirements

Before production deployment starts, confirm the repo has deployable versions of:

- `Dockerfile`,
- `docker-compose.yml`,
- production server that serves:
  - `/api/*` through Hono,
  - `/*` through Vite SPA fallback,
- `/api/health`,
- safe migrations,
- idempotent seed,
- production cookie settings,
- Coolify env vars.

## 9. Manual Deployment Checklist

- Cloudflare `A` record exists.
- DNS resolves.
- Coolify project exists.
- GitHub repo connected.
- Env vars configured.
- App deploys.
- `/api/health` returns 200.
- Demo login works.
- Board loads.
- Task move persists.
- SPA route refresh works.
- Cookies work on HTTPS.

## 10. Troubleshooting

### DNS Not Resolving

Check that the `scalesoftware` `A` record exists in Cloudflare DNS and points to
`198.100.155.183`. Confirm there is no typo in the record name or domain.

### OVH Record Exists but Public DNS Still Does Not Work

If `dig NS matgac.pl` returns Cloudflare nameservers, the OVH DNS zone is not the active
public zone. Add or fix the record in Cloudflare instead.

### Wrong Nameservers

If nameservers are not Cloudflare, identify the authoritative provider before changing
records. Do not switch nameservers unless all existing DNS records, including mail/MX
records, are copied and verified.

### Coolify 404

Check that the domain is assigned to the app service, the service points to container
port `3000`, and the app container is healthy.

### App Unhealthy

Check app logs, startup command, healthcheck path, server bind address, migrations, seed,
and required environment variables.

### Database Unavailable

Check `DATABASE_URL`, database service name, credentials, network reachability, and
whether migrations can connect without using any fallback database URL.

### Cookies Not Working

Check `APP_URL=https://scalesoftware.matgac.pl`, HTTPS access, session secret, secure
cookie behavior, same-site settings, and whether browser requests use the same public
domain.

### SPA Refresh Returns 404

Confirm the production server sends unknown non-API routes to the Vite `index.html`
fallback and does not route them through `/api/*`.

### Cloudflare Proxy Issues

For initial debugging, keep the record `DNS only`. If proxying is enabled later, verify
Cloudflare SSL/TLS mode, HTTPS redirects, websocket or long request behavior if needed,
and whether DNS answers now show Cloudflare IPs instead of `198.100.155.183`.
