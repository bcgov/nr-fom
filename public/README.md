[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../LICENSE)
![Lifecycle:Maturing](https://img.shields.io/badge/Lifecycle-Maturing-007EC6)

# Forest Operation Map (FOM) - Public Front-end

Angular front-end where the public reviews and comments on FOM projects. Served under `/public`.

## Documentation

- See the repository overview at [FOM Readme](../README.md).

## Dependencies

Managed with **npm workspaces** and installed once at the **repository root** (`npm ci`). This component has no separate install step, lockfile, or `node_modules`. It consumes the shared `libs` package **as source** via `tsconfig.json` `paths` (`@utility/*`, `@api-client`).

## Local Development

Served at http://localhost:4300/public.

Run in a container (brings up the database and API too), from the repository root:

```
docker compose up public
```

Or run the dev server on bare metal — from the repository root, after `npm ci`:

```
npm run start:public
```

The app reads its API base URL at runtime from `src/assets/env/env.js` (defaults to `http://localhost:3333`). Run the API separately (see [api/README.md](../api/README.md)) for live data.

## Build

```
npm run build:public          # production build -> public/dist/public
```

The deployable image is built from [`Dockerfile`](./Dockerfile) (a workspace-root `npm ci`, then the production build) and served by Caddy.

## License

- See [LICENSE](../LICENSE).
