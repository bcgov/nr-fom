# AGENTS.md

Repository facts for automated coding assistants. Teams may edit or remove this file.

## Layout
- npm workspaces: `admin/` and `public/` (Angular 22), `api/` (NestJS 12, TypeORM 1.0, Pino), `libs/` (`@fom/shared`, consumed as source)
- `admin/` is the portal where Forest Clients and Ministry staff create, edit, submit, and review FOMs. `public/` is where citizens discover FOMs and submit comments.
- `libs/client/typescript-ng/` is the generated OpenAPI Angular client (`@api-client`). `libs/utility/` is shared security, authentication, and TypeScript helpers.
- `db/` is the PostgreSQL 18/PostGIS image, not a workspace
- OpenShift templates (not Helm): `libs/openshift.init.yml` and `{admin,api,db,public}/openshift.deploy.yml`
- Workflows: `.github/workflows/` (`pr-open.yml` builds and calls `.deploy.yml`; `merge.yml` deploys TEST; `release.yml` deploys PROD; `analysis.yml` tests; `load.yml` is k6). Playwright specs: `e2e/`

## Build, test, deploy
- Docker and Podman are interchangeable. When only Podman is installed, use Podman. A `docker compose` command below is the same with `podman compose`.
- Local stack: `docker compose up`. Or `npm ci`, then `npm run start:public`, `npm run start:admin`, `npm run start:api` (`docker compose up -d db` for the API database).
- Build from the repo root: `npm run build:admin`, `npm run build:api`, `npm run build:public`
- Unit tests from the repo root: `npm run test:admin`, `npm run test:api`, `npm run test:public`. E2E: `docker compose up -d --wait admin public`, then `docker compose run --rm --no-deps e2e`
- OpenShift deploys run from GitHub Actions (PR open, merge to `main`, published release), not from a workstation
- Run test runners, compilations, and migrations in a container. See Containerized execution.

## Shared actions
- `bcgov/actions/*` and `bcgov/actions-openshift/*` are used as provided. Don't copy or fork them.
- Never pin `@main`. Pin those actions to a published release SHA with a `# vX.Y.Z` comment.

## Containerized execution
Never run test runners (`jest`, `npm run test-unit`), compilations (`ng build`, `nest build`), or migrations on the host. Run them in a container with `docker compose` or `podman compose`. Use Podman when it is the only engine installed.

```bash
docker compose exec admin npm run test:admin
docker compose exec api npm run test:api
docker compose exec public npm run test:public
docker compose exec api npm run db:migrate-main --workspace=api
```

Bound every Jest script (`test-unit`, `test-unit-watch`, `test-e2e`, `test:cov`) with `--maxWorkers=2` or `--runInBand`.

## Frontend (Angular 22)

### Reactive resources and signals
- When consuming an Angular `rxResource`, check `resource.hasValue()` rather than evaluating truthiness (`if (!resource.value())`). A resolved `null` payload (for example, a forest client with no historical public notice) is a resolved valid state, not a loading state.
- Inside `effect()` blocks, wrap downstream initialization calls (such as `buildForm()`) in `untracked()` when only the primary resource signal should trigger re-computation.

### Forms and null safety
- Guard against `null` responses when constructing `@rxweb/reactive-form-validators` models:

```typescript
const formModel = new PublicNoticeForm(this.response ?? undefined);
this.formGroup = this.formBuilder.formGroup(formModel) as IFormGroup<PublicNoticeForm>;
```

- Do not cast to `as Partial<T>` or `as any` to silence TypeScript. Check and guard property existence.

### Authorization in the UI
- Verify project workflow state (`project.workflowState.code === WorkflowStateEnum.INITIAL`) and client permissions (`user.isForestClient && user.isAuthorizedForClientId(...)`) before exposing destructive actions (delete, submit).
- Distinguish `isNewForm` (project has no associated record) from `editMode` (route state).

## Backend (NestJS 12, TypeORM)

### OpenAPI and DTOs
- Every nullable or optional DTO field must use `@ApiPropertyOptional()` so generated Angular clients reflect the nullable contract.
- Map entities to declared response DTOs. Do not return untyped object literals.

### Multi-tenancy
- Mutating endpoints must validate the caller's JWT claims against the target entity's `forestClient.id` with `user.isAuthorizedForClientId(clientId)`.
- Ministry users (`user.isMinistry`) have cross-client read and administrative review capabilities.

## Tests
Cover the lifecycle matrix:
1. Unresolved / loading state.
2. Resolved `null` / empty state.
3. Resolved valid entity state.
4. Error states (403, 404, 500).

Do not mock services so they return only happy-path truthy data. Write regression tests for empty and boundary return values.
