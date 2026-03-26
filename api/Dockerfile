# RedHat UBI 8 with nodejs 22
FROM registry.access.redhat.com/ubi8/nodejs-22@sha256:00bfe260c0178a5195d45a1011ff17e872b12c1668c3505bf750a106714db8bb

# Install packages, build and keep only prod packages
WORKDIR /app
COPY . ./
USER root
RUN dnf install -y ca-certificates && \
    cd libs && npm ci --ignore-scripts && cd .. && \
    cd api && npm ci --ignore-scripts && npm run build:api

# Build output is produced from the api package.
WORKDIR /app/api

# Expose port - mostly a convention, for readability
ARG port=3333
EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:${port} || exit 1

# Start up command
USER 1001
ENTRYPOINT ["node", "--max-old-space-size=2048", "./dist/api/src/main.js"]
