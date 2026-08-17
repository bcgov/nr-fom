# Global args
ARG port=3333


# Build container
FROM node:24.19.0-bookworm-slim AS build

# Install dependencies and build API
WORKDIR /app
RUN npm install -g npm@10.9.4

# Root lockfile + only the manifests this image builds (api + libs). `npm ci`
# reads the full root lockfile but skips workspaces whose directory is absent,
# so it installs just api's + libs' deps. (npm is pinned to 10.9.4 above, which
# makes this skip-missing-workspaces behaviour deterministic.)
COPY package.json package-lock.json ./
COPY libs/package.json ./libs/
COPY api/package.json ./api/

# Hoisted install incl. devDeps (@nestjs/cli + typescript) needed to build.
RUN npm ci --ignore-scripts

# Source for the shared lib and the api
COPY libs ./libs
COPY api ./api
WORKDIR /app/api
RUN npm run build:api

# Reinstall prod-only, api-scoped deps so the runtime node_modules (hoisted to
# /app/node_modules) is lean and matches the pre-workspace api-only footprint.
WORKDIR /app
RUN npm ci --ignore-scripts --workspace=api --omit=dev


# Deploy container
FROM node:24.19.0-bookworm-slim

# Copy over app (node_modules is hoisted to the workspace root under npm workspaces)
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist
COPY --from=build /app/api/src/migrations/main ./dist/api/src/migrations/main
COPY --from=build /app/api/src/migrations/test ./dist/api/src/migrations/test

# Add curl to debian-slim for the health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Expose port - mostly a convention, for readability
ARG port
EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:${port} || exit 1

# Non-root secure execution
USER 1001

ENTRYPOINT ["node", "--max-old-space-size=2048", "./dist/api/src/main.js"]

