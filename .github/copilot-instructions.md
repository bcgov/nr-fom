# GitHub Copilot & AI Coding Instructions for `nr-fom`

## Project Architecture & Monorepo Overview
`nr-fom` (Forest Operations Map) is an npm workspaces monorepo:
* **`admin/`**: Angular 22 admin portal for Forest Clients and Ministry staff to create, edit, submit, and review FOMs.
* **`public/`**: Angular 22 public-facing portal for citizens to discover FOMs and submit comments.
* **`api/`**: NestJS 11 backend service utilizing TypeORM 1.0, PostgreSQL 18 with PostGIS spatial extensions, and Pino logging.
* **`libs/client/typescript-ng/`**: Auto-generated Angular API client from OpenAPI (`@api-client`).
* **`libs/utility/`**: Shared security, authentication, and common TypeScript helpers.

---

## 1. Containerized Execution Invariants (Podman / Docker)

### Never Run Heavy Workloads on Bare Metal
* **Rule**: Never run test runners (`jest`, `npm run test-unit`), compilations (`ng build`, `nest build`), or migrations directly on the host machine.
* **Execution**: Always dispatch commands inside Podman containers:
  ```bash
  # Run unit tests inside containers
  podman compose exec admin npm run test:admin
  podman compose exec api npm run test:api
  podman compose exec public npm run test:public

  # Database migrations
  podman compose exec api npm run db:migrate-main --workspace=api
  ```
* **Worker Concurrency**: Always bound test runner concurrency with `--maxWorkers=2` or `--runInBand` on all Jest scripts (`test-unit`, `test-unit-watch`, `test-e2e`, `test:cov`) to prevent host CPU and memory starvation.

---

## 2. Frontend Reactive & Null Safety Standards (Angular 22)

### Reactive Resource & Signal Patterns
* **`rxResource` Resolution**: When consuming an Angular `rxResource`, check `resource.hasValue()` rather than evaluating truthiness (`if (!resource.value())`). 
  * A resolved `null` payload (e.g., when a forest client has no historical public notice) is a **resolved valid state**, not an uncompleted loading state.
* **Signal Un-tracking**: Inside `effect()` blocks, wrap downstream initialization calls (such as `buildForm()`) in `untracked()` if only the primary resource signal should trigger re-computation.

### Form Building & Null Safety
* **Form Initialization**: Always guard against `null` responses when constructing `@rxweb/reactive-form-validators` models:
  ```typescript
  const formModel = new PublicNoticeForm(this.response ?? undefined);
  this.formGroup = this.formBuilder.formGroup(formModel) as IFormGroup<PublicNoticeForm>;
  ```
* **Prohibit Unchecked Type Casting**: Avoid blindly casting to `as Partial<T>` or `as any` to silence TypeScript compiler diagnostics. Check and guard property existence explicitly.

### Authorization & State Gating in UI
* Always verify project workflow state (`project.workflowState.code === WorkflowStateEnum.INITIAL`) and client permissions (`user.isForestClient && user.isAuthorizedForClientId(...)`) before exposing destructive actions (delete, submit).
* Distinguish between `isNewForm` (project has no associated record) and `editMode` (route state).

---

## 3. Backend API & TypeORM Standards (NestJS 11)

### OpenAPI & DTO Contracts
* Every nullable or optional field in a DTO must be explicitly annotated with `@ApiPropertyOptional()` so that auto-generated Angular clients accurately reflect the nullable contract.
* Avoid returning untyped object literals; map entities directly to declared response DTOs.

### Multi-Tenancy & Client Scoping
* All mutating endpoints must validate the caller's JWT claims against the target entity's `forestClient.id` using `user.isAuthorizedForClientId(clientId)`.
* Ministry users (`user.isMinistry`) have cross-client read and administrative review capabilities.

---

## 4. Test Suite Requirements

* **Unit Tests**: Test suites must cover the full lifecycle matrix:
  1. Unresolved / loading state.
  2. Resolved `null` / empty state (zero-state scenarios).
  3. Resolved valid entity state.
  4. Error states (403, 404, 500).
* **Mock Realism**: Do not mock services to return only happy-path truthy data. Write explicit regression tests for empty and boundary return values.
