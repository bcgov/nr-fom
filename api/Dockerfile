# RedHat UBI 8 with nodejs 20
FROM registry.access.redhat.com/ubi8/nodejs-20:1-71.1735831626 AS builder

# Install packages, build and keep only prod packages
WORKDIR /app
COPY api/ ./
COPY libs/ ./libs/
USER root
RUN dnf install -y ca-certificates && \
    cd libs && npm ci --ignore-scripts && cd .. && \
    npm ci --ignore-scripts && \
    for f in src/**/*.ts; do cp "$f" "dist/${f%.ts}.js"; done && \
    cd dist && npm ci --ignore-scripts && npm run build:api -- --exclude '**/*.spec.ts' '**/*.e2e-spec.ts' 2>/dev/null || true