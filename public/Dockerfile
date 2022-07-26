# RedHat UBI 8 with nodejs 14
FROM registry.access.redhat.com/ubi8/nodejs-14:1-75.1652296492 as builder

# Install packages, build and keep only prod packages
WORKDIR /app
COPY . ./
USER root
RUN cd libs && \
    npm ci && \
    cd ../public && \
    npm ci && \
    npm run build:public && \
    rm -rf node_modules

# Deployment container
# FROM registry.access.redhat.com/ubi8/ubi-micro
FROM caddy:2

# Vars - configured for local development
ENV FOM_ENV=dev

# Node packages and dependencies
COPY --from=builder /usr/bin/node /usr/bin/
COPY --from=builder /usr/lib64/libz.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlidec.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlienc.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libcrypto.so.1.1 /usr/lib64/
COPY --from=builder /usr/lib64/libssl.so.1.1 /usr/lib64/
COPY --from=builder /usr/lib64/libstdc++.so.6 /usr/lib64/
COPY --from=builder /usr/lib64/libgcc_s.so.1 /usr/lib64/
COPY --from=builder /usr/lib64/libbrotlicommon.so.1 /usr/lib64/

# Copy over app
WORKDIR /app
COPY --from=builder /app/public/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/public/Caddyfile .

# Expose port - mostly a convention, for readability
EXPOSE 4300 2019 80 443

# Start up command
USER 1001 
ENTRYPOINT ["caddy", "run"]
