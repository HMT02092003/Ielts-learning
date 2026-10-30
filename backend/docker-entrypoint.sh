#!/bin/sh
# Container start. Runs as root only long enough to make the bind-mounted ./data writable (on Linux the host
# owner may not be uid 1000), then re-executes itself as the unprivileged "node" user and:
#   JWT secret (generated once if missing) → prisma migrate deploy → idempotent seed → API server.
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data/storage /app/data/tmp /app/data/backups
  chown node:node /app/data /app/data/storage /app/data/tmp /app/data/backups 2>/dev/null || true
  # Recurse only when something is not owned by node (avoid re-chowning a large storage tree every start).
  if [ -n "$(find /app/data/storage /app/data/tmp ! -user node -print -quit 2>/dev/null)" ]; then
    chown -R node:node /app/data/storage /app/data/tmp 2>/dev/null || true
  fi
  exec setpriv --reuid=node --regid=node --init-groups "$0" "$@"
fi

if [ ! -w /app/data/storage ] || [ ! -w /app/data/tmp ]; then
  echo "[entrypoint] Thư mục ./data không ghi được bởi uid $(id -u). Trên Linux: sudo chown -R 1000:1000 data" >&2
  exit 1
fi

# No secret (or the documentation placeholder) → generate one and keep it in data/ (git-ignored) across restarts.
case "${JWT_ACCESS_SECRET:-}" in
  "" | *change-me*)
    SECRET_FILE=/app/data/.jwt_secret
    if [ ! -s "$SECRET_FILE" ]; then
      node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" > "$SECRET_FILE"
      chmod 600 "$SECRET_FILE"
      echo "[entrypoint] generated JWT secret in data/.jwt_secret"
    fi
    JWT_ACCESS_SECRET="$(cat "$SECRET_FILE")"
    export JWT_ACCESS_SECRET
    ;;
esac

echo "[entrypoint] prisma migrate deploy"
node node_modules/prisma/build/index.js migrate deploy
echo "[entrypoint] seed"
node --import tsx prisma/seed/index.ts
echo "[entrypoint] starting API"
exec node --import tsx src/server.ts
