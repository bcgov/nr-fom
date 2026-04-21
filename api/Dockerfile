# Build container
FROM node:22.14.0-alpine3.21 AS builder

# Install dependencies for building native modules (if any)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY . ./

# Build libs and api
RUN cd libs && npm ci --ignore-scripts && cd .. && \
    cd api && npm ci --ignore-scripts && npm run build:api

# Deployment container
FROM node:22.14.0-alpine3.21

WORKDIR /app

# Copy over app from builder
COPY --from=builder /app/api/node_modules ./node_modules
COPY --from=builder /app/api/dist ./dist
COPY --from=builder /app/api/src/migrations/main ./dist/api/src/migrations/main
COPY --from=builder /app/api/src/migrations/test ./dist/api/src/migrations/test

# Expose port
ARG port=3333
EXPOSE ${port}

# Healthcheck
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:${port} || exit 1  

# Start up command
USER node
ENTRYPOINT ["node", "--max-old-space-size=2048", "./dist/api/src/main.js"]
