# Global args
ARG build_dir=public
ARG port=4300

# Build container
FROM node:20.19.0-alpine3.20 AS build

# Install dependencies and build static content
ARG build_dir
WORKDIR /app
COPY ./libs ./libs
COPY ./${build_dir} ./${build_dir}
RUN npm install -g npm@10.9.4
WORKDIR /app/libs
RUN npm ci --ignore-scripts
WORKDIR /app/${build_dir}
RUN npm ci --ignore-scripts && npm run build:${build_dir}
WORKDIR /app
RUN rm -rf libs/node_modules ${build_dir}/node_modules


# Deploy container
FROM caddy:2.11.3-alpine

# Copy over Caddyfile and static content
ARG build_dir
COPY --from=build /app/${build_dir}/dist/${build_dir} /dist
COPY --from=build /app/${build_dir}/Caddyfile /etc/caddy/Caddyfile

# Port, health check and user
ARG port
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/:${port}
USER 1001
