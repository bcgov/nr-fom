# RedHat UBI 8 with nodejs 24
FROM registry.access.redhat.com/ubi8/nodejs-24:1-1782882986 AS builder

# Install packages, build and keep only prod packages
WORKDIR /app
USER root
RUN dnf install -y ca-certificates && dnf clean all && rm -rf /var/cache/dnf
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


# Deployment container
FROM registry.access.redhat.com/ubi8/ubi:8.10-1781720109

# Node packages and dependencies
COPY --from=builder /usr/bin/node /usr/bin/
COPY --from=builder /usr/lib64/libnode.so* /usr/lib64/
COPY --from=builder /usr/lib64/libz.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlidec.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlienc.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libcrypto.so.1.1 /usr/lib64/
COPY --from=builder /usr/lib64/libssl.so* /usr/lib64/
COPY --from=builder /usr/lib64/libstdc++.so.6 /usr/lib64/
COPY --from=builder /usr/lib64/libgcc_s.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlicommon.so.1 /usr/lib64/
COPY --from=builder /etc/pki /etc/pki

# Copy over app (node_modules is hoisted to the workspace root under npm workspaces)
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/api/dist ./dist
COPY --from=builder /app/api/src/migrations/main ./dist/api/src/migrations/main
COPY --from=builder /app/api/src/migrations/test ./dist/api/src/migrations/test

# Expose port - mostly a convention, for readability
ARG port=3333
EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:${port} || exit 1  

# Start up command
USER 1001
ENTRYPOINT ["node", "--max-old-space-size=2048", "./dist/api/src/main.js"]
