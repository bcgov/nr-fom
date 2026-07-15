# Global args
ARG build_dir=public
ARG port=4300

# Build container
FROM node:24.18.0-bookworm-slim AS build

# Install dependencies and build static content
ARG build_dir
WORKDIR /app
RUN npm install -g npm@10.9.4

# Root lockfile + only the manifests this image builds (public + libs). `npm ci`
# reads the full root lockfile but skips workspaces whose directory is absent,
# so it installs just public's + libs' deps. (npm is pinned to 10.9.4 above,
# which makes this skip-missing-workspaces behaviour deterministic.)
COPY package.json package-lock.json ./
COPY libs/package.json ./libs/
COPY public/package.json ./public/

# Single hoisted install at the workspace root. The app and the libs SOURCE it
# compiles in-place both resolve @angular/* from /app/node_modules -> one physical
# Angular copy -> no duplicate -> no NG0203.
RUN npm ci --ignore-scripts

# Source for the shared lib and this app
COPY libs ./libs
COPY ${build_dir} ./${build_dir}
WORKDIR /app/${build_dir}
RUN npm run build:${build_dir}
WORKDIR /app
RUN rm -rf node_modules


# Deploy container
FROM caddy:2.11.4-alpine

# Copy over Caddyfile and static content
ARG build_dir
COPY --from=build /app/${build_dir}/dist/${build_dir} /dist
COPY --from=build /app/${build_dir}/Caddyfile /etc/caddy/Caddyfile

# Port, health check and user
ARG port
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/:${port}
USER 1001
