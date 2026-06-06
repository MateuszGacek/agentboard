#!/bin/sh
set -eu

if [ "${SKIP_DB_BOOTSTRAP:-false}" = "true" ]; then
  exec "$@"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for production startup." >&2
  exit 1
fi

node scripts/wait-for-db.mjs
pnpm db:migrate

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  pnpm db:seed
fi

exec "$@"
