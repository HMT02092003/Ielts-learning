# API image: Node 20 + Yarn 1 (bundled in the official node image). Runs TypeScript directly with tsx (no build step yet — docs/tech-debt.md #1).
# On start: prisma migrate deploy → idempotent seed → server (see docker-entrypoint.sh).
FROM node:20.20.0-bookworm-slim AS base
# openssl: required by the Prisma schema engine (migrate deploy).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend

FROM base AS deps
COPY package.json yarn.lock .yarnrc ./
COPY prisma.config.ts ./
COPY prisma/schema.prisma ./prisma/schema.prisma
# prisma.config.ts requires DATABASE_URL to exist; this placeholder is only used by `prisma generate` (postinstall).
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build yarn install --frozen-lockfile && yarn cache clean

FROM base AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000 \
    STORAGE_LOCAL_ROOT=/app/data/storage \
    UPLOAD_TMP_DIR=/app/data/tmp
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=deps /app/backend/src/generated ./src/generated
COPY . .
RUN chmod +x docker-entrypoint.sh \
 && mkdir -p /app/data/storage /app/data/tmp \
 && chown -R node:node /app
# No `USER node` here on purpose: the entrypoint starts as root to fix ownership of the bind-mounted ./data,
# then drops to the "node" user with setpriv (util-linux, part of bookworm-slim) before running anything.
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
