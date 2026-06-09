FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

FROM base AS deps

ENV NODE_ENV=development

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --prod=false --frozen-lockfile

FROM deps AS build

ENV NODE_ENV=development

COPY . .

RUN pnpm build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_DIR=/app/apps/web/dist

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY docker/entrypoint.sh /usr/local/bin/kanban-entrypoint
COPY scripts/wait-for-db.mjs scripts/wait-for-db.mjs

RUN chmod +x /usr/local/bin/kanban-entrypoint

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["kanban-entrypoint"]
CMD ["pnpm", "start"]
