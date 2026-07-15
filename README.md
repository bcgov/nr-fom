[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
![Lifecycle:Maturing](https://img.shields.io/badge/Lifecycle-Maturing-007EC6)

# Forest Operation Map (FOM)

FOM projects (proposals for logging, essentially) are submitted to FOM and made available for public review and comment. The submitting organization then needs to address the comments before submitting the project to the ministry.

## Technical Details

Technology stack: Angular (two front-ends), Node.js with NestJS/TypeORM (API), PostgreSQL with PostGIS, running on OpenShift (OCP v4).

Supported runtime: Node.js `>=22.22.3` or `>=24.15.0`, npm `10.9.4` (see `engines` in the root `package.json`).

This repository is an **npm workspaces monorepo** containing the API backend, the two Angular front-ends, and a shared `libs` package.

### Repository Structure

| Path | Package | Description |
|------|---------|-------------|
| `/` | `nr-fom` | Workspace root: the single `package.json` (with `workspaces`), the single `package-lock.json`, and the single hoisted `node_modules`. |
| `/libs` | `@fom/shared` | Shared code (types, models, security, utilities, and the generated API client), consumed **as source** by `public`, `admin`, and `api`. |
| `/public` | `fom-public` | Public Angular front-end (served under `/public`). |
| `/admin` | `fom-admin` | Admin Angular front-end (served under `/admin`). |
| `/api` | `fom-api` | NestJS + TypeORM backend (served under `/api`). |
| `/db` | – | Local PostgreSQL/PostGIS image configuration. |

### Dependency Management

Dependencies are managed with **npm workspaces**:

- There is **one** lockfile (`/package-lock.json`) and **one** hoisted `node_modules` at the repository root. Each component keeps its own `package.json` (declaring its dependencies), but there are no per-component lockfiles or `node_modules`.
- Install everything with a single command at the repository root:

  ```
  npm ci            # clean install from the lockfile
  npm install       # when adding/updating dependencies (updates the lockfile)
  ```

- Run a component's scripts from the root using its workspace script (e.g. `npm run start:api`), or from inside the component directory (e.g. `cd api && npm run start:api`).
- Keep shared framework dependencies (`@angular/*`, `rxjs`, `zone.js`, `tslib`) on compatible versions across `libs`, `public`, and `admin` so they resolve to a single hoisted copy.

## Documentation

See ministry Confluence site: https://apps.nrs.gov.bc.ca/int/confluence/pages/viewpage.action?pageId=83560736


## Local Development

Once running, the stack is available at:

- Public front-end: http://localhost:4300/public
- Admin front-end: http://localhost:4200/admin
- API: http://localhost:3333/api
- PostgreSQL: localhost:5432

### Run everything in containers (Docker Compose)

Brings up the database, API, and both front-ends. A one-time `init-deps` service performs the shared workspace install into a volume that the other services reuse:

```
docker compose up
```

Components can also be started individually (the front-ends depend on `api` being healthy, and `api` on `db`):

```
docker compose up -d db      # database only, in the background
docker compose up api        # api (brings up db first)
docker compose up public     # public front-end
docker compose up admin      # admin front-end
```

### Run components on bare metal

Install once at the repository root, then start any component from the root:

```
npm ci

npm run start:public         # http://localhost:4300/public
npm run start:admin          # http://localhost:4200/admin
npm run start:api            # http://localhost:3333/api  (needs a database + env — see api/README.md)
```

The front-ends run standalone. The API additionally requires a reachable PostgreSQL and environment variables; the simplest setup is `docker compose up -d db` for the database, then follow [api/README.md](./api/README.md) for the environment.

### Database

The API applies migrations automatically on startup (test-data migrations run only when `DB_TESTDATA=true`). To run migrations manually against a local database, use the `db:migrate-*` scripts in `api/package.json` — see [API Backend - Database Migrations Setup](./api/src/migrations/README.md).

To inspect the database, connect a client (DBeaver/pgAdmin) using the settings in `docker-compose.yml` (host `localhost:5432`, database `fom`, user `postgres`).

## Application Specific Setup:

- API Backend — see [api/README.md](./api/README.md).
- Public Front-end — see [public/README.md](./public/README.md).
- Admin Front-end — see [admin/README.md](./admin/README.md).
- Shared Library — see [libs/README.md](./libs/README.md).

## Client Library Generation
- See Client Library Generation at [API Backend Readme](./api/README.md).

## Continuous Integration / Deployment

CI/CD runs on GitHub Actions:

- **Tests & analysis** ([.github/workflows/analysis.yml](./.github/workflows/analysis.yml)) run on pull requests and pushes: unit tests for `public`, `admin`, and `api`, plus Trivy, Knip, and SonarCloud. Each job installs dependencies once at the workspace root (`npm ci`) and runs the component's `test-unit` script.
- **Build & deploy** workflows build each deployable component from its own Dockerfile (`public/Dockerfile`, `admin/Dockerfile`, `api/Dockerfile`) and deploy to OpenShift. Each image runs a workspace-root `npm ci` and then builds only its component.

## Upgrading 3rd party dependencies

Update the relevant `package.json`(s), run `npm install` at the repository root to refresh the single lockfile, then (given the minimal automated tests) verify — all from the repository root:

- `npm run build:api`
- `npm run test-unit --workspace=api`
- `npm run start:public` (exercise the front-end)
- `npm run start:admin` (ideally with security and object storage enabled)
- `npm run start:api`

Keep shared framework dependencies (`@angular/*`, `rxjs`, `zone.js`, `tslib`) aligned across `libs`, `public`, and `admin`.

<!-- TODO
## Deployment (OpenShift)

See [OpenShift Readme](./openshift/README.md)

<!--- Best to include details in a openshift/README.md --- >
-->

<!---
## Getting Help or Reporting an Issue

<!-- TODO: where to report???
To report bugs/issues/feature requests, please file an [issue](../../issues).
-->

## How to Contribute

If you would like to contribute, please see our [CONTRIBUTING](./CONTRIBUTING.md) guidelines.

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md).
By participating in this project you agree to abide by its terms.

## License
- See [LICENSE](./LICENSE.md)
