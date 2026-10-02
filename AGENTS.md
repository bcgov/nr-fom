# AGENTS.md

Repository facts for automated coding assistants. Teams may edit or remove this file.

## Layout
- npm workspaces: `admin/` and `public/` (Angular), `api/` (NestJS, TypeORM), `libs/` (`@fom/shared`, consumed as source)
- `db/` is the PostgreSQL/PostGIS image, not a workspace
- OpenShift templates (not Helm): `libs/openshift.init.yml` and `{admin,api,db,public}/openshift.deploy.yml`
- Workflows: `.github/workflows/` (`pr-open.yml` builds and calls `.deploy.yml`; `merge.yml` deploys TEST; `release.yml` deploys PROD; `analysis.yml` tests; `load.yml` is k6). Playwright specs: `e2e/`

## Build, test, deploy
- Local stack: `docker compose up`. Or `npm ci`, then `npm run start:public`, `npm run start:admin`, `npm run start:api` (`docker compose up -d db` for the API database).
- Build from the repo root: `npm run build:admin`, `npm run build:api`, `npm run build:public`
- Unit tests from the repo root: `npm run test:admin`, `npm run test:api`, `npm run test:public`. E2E: `docker compose up -d --wait admin public`, then `docker compose run --rm --no-deps e2e`
- OpenShift deploys run from GitHub Actions (PR open, merge to `main`, published release), not from a workstation

## Shared actions
- `bcgov/actions/*` and `bcgov/actions-openshift/*` are used as provided. Don't copy or fork them.
- Never pin `@main`. Pin those actions to a published release SHA with a `# vX.Y.Z` comment.
