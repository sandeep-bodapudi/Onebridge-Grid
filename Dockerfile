# OneBridge Grid: one image, three processes (D-VPS-DEPLOY B4).
# docker-compose.yml runs it as:
#   api         node scripts/prod-api.mjs                  (port 8080, all services)
#   web-app     next start (apps/web-app)       -p 3100    (admin app)
#   web-public  next start (apps/web-public)    -p 3200    (public site, assets under /_cards)
#
# Build:  docker compose build            (PUBLIC_URL comes from .env)
# The build needs about 3 GB of memory: add a 2 GB swap file on a 4 GB server (see deploy/DEPLOYMENT-GUIDE.md, section 4).
# Node 20 and pnpm 9 match CI (.github/workflows/ci.yml) and the lockfile format (9.0).

# ---------------------------------------------------------------- build stage
FROM node:20.18.1-bookworm-slim AS build
# MONGOMS_DISABLE_POSTINSTALL: the test-only mongodb-memory-server must not download a MongoDB binary.
ENV CI=true NEXT_TELEMETRY_DISABLED=1 MONGOMS_DISABLE_POSTINSTALL=1
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

ARG PUBLIC_URL
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN test -n "$PUBLIC_URL" || (echo "Set PUBLIC_URL in .env (e.g. https://onebridgecard.com)" && exit 1); \
    PUBLIC_URL="$PUBLIC_URL" node deploy/build.mjs

# Keep only what runs: production dependencies, build output, scripts.
RUN pnpm prune --prod \
 && rm -rf apps/*/.next/cache packages/ui-kit/storybook-static \
 && find . -path ./node_modules -prune -o \( -name "*.spec.ts" -o -name "*.spec.tsx" \) -type f -print -delete > /dev/null

# -------------------------------------------------------------- runtime stage
FROM node:20.18.1-bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# The node image already has a "node" user (uid 1000); the app runs as that user.
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data/media && chown node:node /data/media
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
# Each compose service sets its own command and health check.
CMD ["node", "scripts/prod-api.mjs"]
