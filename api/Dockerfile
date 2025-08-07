# RedHat UBI 8 with nodejs 20
FROM registry.access.redhat.com/ubi8/nodejs-20:1-1754572950 AS builder

# Install packages, build and keep only prod packages
WORKDIR /app
COPY . ./
USER root
RUN dnf install -y ca-certificates && \
    cd libs && npm ci && cd .. && \
    cd api && npm ci && npm run build:api


# Deployment container
FROM registry.access.redhat.com/ubi8/ubi:8.10-1754489414

# Node packages and dependencies
COPY --from=builder /usr/bin/node /usr/bin/
COPY --from=builder /usr/lib64/libz.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlidec.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlienc.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libcrypto.so.1.1 /usr/lib64/
COPY --from=builder /usr/lib64/libssl.so* /usr/lib64/
COPY --from=builder /usr/lib64/libstdc++.so.6 /usr/lib64/
COPY --from=builder /usr/lib64/libgcc_s.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlicommon.so.1 /usr/lib64/
COPY --from=builder /etc/pki /etc/pki

# Copy over app
WORKDIR /app
COPY --from=builder /app/api/node_modules ./node_modules
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
