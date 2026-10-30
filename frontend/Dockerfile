# Web image: Next.js 16 standalone output. API_ORIGIN is frozen into the build (Next rewrites are build-time),
# so it is a build argument; in docker compose it points at the backend container.
FROM node:20.20.0-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/frontend

FROM base AS deps
COPY package.json yarn.lock .yarnrc ./
RUN yarn install --frozen-lockfile && yarn cache clean

FROM base AS build
ARG API_ORIGIN=http://backend:4000
ENV API_ORIGIN=$API_ORIGIN
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY . .
# public/ may be missing in a fresh clone (git does not keep empty folders); the runtime stage copies it.
RUN mkdir -p public
# next/font/google downloads the fonts here (needs internet during the build).
RUN yarn run build

FROM node:20.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./.next/static
COPY --from=build --chown=node:node /app/frontend/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
