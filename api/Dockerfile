# RedHat UBI 8 with nodejs 20
FROM registry.access.redhat.com/ubi8/nodejs-20:1-71.1735831626 AS builder

# Install packages, build and keep only prod packages
WORKDIR /app
COPY api/ ./api/
COPY libs/ ./libs/
USER root
RUN dnf install -y ca-certificates && \
    cd libs && npm ci --ignore-scripts && cd .. && \
    cd api && npm ci --ignore-scripts && npm run build:api