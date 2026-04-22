FROM registry.access.redhat.com/ubi8/nodejs-20:1-71.1735831626 AS builder
WORKDIR /app
COPY api/ .
COPY libs/ ./libs/
USER root
RUN dnf install -y ca-certificates && \
    cd libs && npm ci --ignore-scripts && cd .. && \
    npm ci --ignore-scripts && npm run build:api
