[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../LICENSE)
![Lifecycle:Maturing](https://img.shields.io/badge/Lifecycle-Maturing-007EC6)

# Forest Operation Map (FOM) - Admin Front-end

Angular front-end where submitting organizations and ministry staff manage FOM projects. Served under `/admin`.

## Documentation

- See the repository overview at [FOM Readme](../README.md).

## Dependencies

Managed with **npm workspaces** and installed once at the **repository root** (`npm ci`). This component has no separate install step, lockfile, or `node_modules`. It consumes the shared `libs` package **as source** via `tsconfig.json` `paths` (`@utility/*`, `@api-client`).

## Local Development

Served at http://localhost:4200/admin.

Run in a container (brings up the database and API too), from the repository root:

```
docker compose up admin
```

Or run the dev server on bare metal — from the repository root, after `npm ci`:

```
npm run start:admin
```

The app reads its API base URL at runtime from `src/assets/env/env.js` (defaults to `http://localhost:3333`). Run the API separately (see [api/README.md](../api/README.md)) for live data. Full functionality (authentication, file uploads) additionally requires security and object storage to be enabled on the API.

## Build

```
npm run build:admin           # production build -> admin/dist/admin
```

The deployable image is built from [`Dockerfile`](./Dockerfile) (a workspace-root `npm ci`, then the production build) and served by Caddy.

## License

- See [LICENSE](../LICENSE).
