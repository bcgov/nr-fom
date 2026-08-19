# Frontend Architecture Blueprint — Admin & Public Applications

> **Scope:** `admin/` and `public/` Angular frontend applications
> **Shared dependencies:** `libs/client/typescript-ng` (generated API client) · `libs/utility/src` (hand-written shared utilities)
> **Stack:** Angular 22 · TypeScript 6 · Angular Material 22 · ng-bootstrap 21 · ngx-bootstrap 21 · Leaflet 1.9 · RxJS 7.8 · Jest 30 · ESLint 10
> **Created:** May 2026 · **Last verified against code:** 2026-08-18

---

## 1. Architectural Overview

Both frontends are **standalone-component, zoneless, signal-first Angular applications**. There are no `NgModule`s anywhere in either app's source (verified: zero `@NgModule` declarations under `admin/src` and `public/src`) — each app is bootstrapped from a single standalone root component via `bootstrapApplication`.

The design follows a layered approach:

```
┌─────────────────────────────────────────────────────────┐
│                    Browser / Runtime                    │
├─────────────────────────────────────────────────────────┤
│  Application Layer  (app/ — pages, feature components)  │
├─────────────────────────────────────────────────────────┤
│  Core Layer  (core/ — services, guards, interceptors)   │
├─────────────────────────────────────────────────────────┤
│  Shared Library Layer  (libs/ — API client + utility)   │
├─────────────────────────────────────────────────────────┤
│  HTTP / API  (NestJS backend at /api)                   │
└─────────────────────────────────────────────────────────┘
```

Four properties define the architecture:

| Property | State |
|---|---|
| **Zoneless change detection** | `provideZonelessChangeDetection()` in **both** apps. `zone.js` is not loaded. |
| **Lazy loading** | All non-critical routes use `loadComponent()`. Only `SearchComponent`, `LogoutComponent` and `NotAuthorizedComponent` (admin) are eager. |
| **Signal-based reactivity** | `rxResource` for data loading, `signal` / `computed` / `linkedSignal` for state, `input()` / `output()` / `viewChild()` for the component API. Templates use `@if` / `@for` control flow (×201 / ×40); a single `AsyncPipe` appears, in `admin/app.component`. |
| **Strict TypeScript** | `strict: true` + `strictTemplates` in both apps (`strictPropertyInitialization` deliberately **off**). |

The **admin** app is authentication-required (AWS Cognito via `aws-amplify` v6). The **public** app is fully unauthenticated.

Both apps share the generated TypeScript API client (`libs/client/typescript-ng`) and the `libs/utility` package. They are **independently deployable** — each has its own `package.json`, `angular.json`, `Dockerfile`, `Caddyfile`, and OpenShift deployment manifest — but they install from a **single hoisted npm workspace root** (see §17, ADR-6).

---

## 2. Repository Layout

```
nr-fom/                       # npm workspaces root: libs, public, admin, api
├── admin/                    # Internal ministry Angular app (authenticated)
│   ├── src/
│   │   ├── main.ts           # Bootstrap entrypoint
│   │   ├── polyfills.ts
│   │   ├── index.html        # Loads assets/env/env.js before the app
│   │   ├── test-setup.ts     # setupZonelessTestEnv()
│   │   ├── jest-global-setup.ts
│   │   ├── app/
│   │   │   ├── app.component.ts           # Root component
│   │   │   ├── app.routes.ts              # Flat route table, lazy loadComponent
│   │   │   ├── about/
│   │   │   ├── analytics-dashboard/
│   │   │   │   ├── analytics-dashboard.component.ts
│   │   │   │   ├── analytics-dashboard-data.service.ts   # forkJoin of 7 endpoints
│   │   │   │   ├── analytics-dashboard-chart-config.ts   # ApexCharts option seeds
│   │   │   │   └── analytics.resolver.ts
│   │   │   ├── foms/                      # Core FOM management features
│   │   │   │   ├── fom-add-edit/          # + fom-add-edit.form.ts (RxWeb)
│   │   │   │   ├── fom-detail/
│   │   │   │   │   └── enddate-change-modal/
│   │   │   │   ├── fom-submission/        # + submission-overview-faq
│   │   │   │   ├── interactions/
│   │   │   │   │   └── interaction-detail/
│   │   │   │   ├── public-notice/
│   │   │   │   ├── review-comments/
│   │   │   │   │   ├── comment-detail/    # Signal Forms
│   │   │   │   │   └── export-terms-modal/
│   │   │   │   ├── summary/
│   │   │   │   │   ├── comments-summary/
│   │   │   │   │   └── interactions-summary/
│   │   │   │   ├── details-map/
│   │   │   │   ├── shape-info/
│   │   │   │   └── fom.resolvers.ts
│   │   │   ├── footer/  header/  logout/  not-authorized/  search/
│   │   │   └── spec/helpers.ts            # Shared test helpers
│   │   ├── core/
│   │   │   ├── components/dialog/         # MatDialog content component
│   │   │   ├── components/file-upload-box/# Signal Forms + @ngx-dropzone
│   │   │   ├── directives/form-control.directive.ts
│   │   │   ├── guards/admin.guard.ts
│   │   │   ├── interceptors/http-error.interceptor.ts
│   │   │   ├── models/                    # attachmentTypeEnum, code-tables, dialog
│   │   │   ├── pipes/newlines.pipe.ts
│   │   │   ├── services/                  # AttachmentResolverSvc, cognito,
│   │   │   │                              # loading, modal, state, mock-user
│   │   │   └── utils/                     # attachmentUploadService, commonUtil,
│   │   │                                  # constants, cognito-token-interceptor,
│   │   │                                  # logout-chain
│   │   ├── assets/  (env/env.js, images, fonts, styles/)
│   │   └── environments/
│   ├── angular.json  jest.config.js  eslint.config.mjs
│   ├── tsconfig.json / .app.json / .spec.json / .editor.json
│   ├── Dockerfile  Caddyfile  openshift.deploy.yml
│   └── package.json
│
├── public/                   # Public-facing Angular app (unauthenticated)
│   ├── src/
│   │   ├── main.ts  polyfills.ts  index.html  test-setup.ts
│   │   ├── app/
│   │   │   ├── app.component.ts
│   │   │   ├── app.routes.ts              # Functional redirectTo, lazy loadComponent
│   │   │   ├── about/  contact/  footer/  header/
│   │   │   ├── applications/
│   │   │   │   ├── projects.component.ts  # Main container
│   │   │   │   ├── app-map/               # Leaflet map
│   │   │   │   │   └── marker-popup/
│   │   │   │   ├── app-public-notices/
│   │   │   │   │   └── notices-filter-panel/
│   │   │   │   ├── details-panel/
│   │   │   │   │   ├── details-map/
│   │   │   │   │   └── shape-info/
│   │   │   │   ├── find-panel/
│   │   │   │   ├── splash-modal/
│   │   │   │   └── utils/                 # filter.ts, leaflet-host.ts, panel.enum.ts
│   │   │   └── comment-modal/
│   │   ├── core/
│   │   │   ├── components/dialog/
│   │   │   ├── constants/appConstants.ts
│   │   │   ├── interceptors/http-error.interceptor.ts
│   │   │   ├── models/code-tables.ts
│   │   │   ├── pipes/shorten.pipe.ts
│   │   │   ├── services/                  # fomFilters, loading, mapLayers, modal,
│   │   │   │                              # state, url
│   │   │   └── utils/appUtils.ts
│   │   ├── assets/  environments/
│   ├── angular.json  jest.config.js  eslint.config.mjs  tsconfig*.json
│   ├── Dockerfile  Caddyfile  openshift.deploy.yml  LOCAL_DEBUG.md
│   └── package.json
│
├── libs/                     # npm workspace @fom/shared
│   ├── index.ts              # Re-exports client + utility
│   ├── client/typescript-ng/ # GENERATED OpenAPI Angular client — do not hand-edit
│   │   ├── api/              # 12 service classes (see §6.1)
│   │   ├── model/            # 47 DTO / enum files
│   │   ├── api.module.ts     # Present but UNUSED by the apps (see §6.1)
│   │   ├── configuration.ts  # `Configuration` — provided directly in main.ts
│   │   └── index.ts
│   └── utility/src/
│       ├── index.ts          # Barrel (note: does NOT export config.service)
│       ├── security/user.ts  # User domain object with role helpers
│       ├── services/
│       │   ├── config.service.ts          # Runtime config + retrieveApiBasePath()
│       │   └── featureSelect.service.ts   # signal-based feature selection
│       ├── models/           # map-layers.ts, primitive-keys.model.ts
│       ├── typeguards/  types/
│       ├── utility.module.ts / utility.service.ts   # NestJS-side, API only
│
├── api/  db/  analysis/
├── docker-compose.yml        # Local dev: init-deps + db + api + admin + public
├── eslint-base.config.mjs
└── package.json              # Workspaces + dependency overrides
```

---

## 3. Bootstrap and Application Initialization

### 3.1 Admin (`admin/src/main.ts`)

```typescript
const apiConfig = new Configuration({ basePath: retrieveApiBasePath() });

const coreProviders = [
  provideZonelessChangeDetection(),
  // Order is critical - the token interceptor must run after the error interceptor
  // (it is last in the array, so it sees the response first and can refresh+retry a
  // 403 before the error interceptor would surface a "Forbidden" dialog).
  provideHttpClient(withInterceptors([errorInterceptor, cognitoTokenInterceptor])),
  // Generated API client config — functional provider replacing ApiModule.forRoot()
  { provide: Configuration, useValue: apiConfig },
  importProvidersFrom(BsDatepickerModule, NgbModule, RxReactiveFormsModule, MatDialogModule, MatSnackBarModule),
  provideAppInitializer(() => inject(CognitoService).init()),
];

const routesProviders = [
  provideRouter(
    AppRoutes,
    withComponentInputBinding(),
    withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    withPreloading(PreloadAllModules)
  )
];

bootstrapApplication(AppComponent, { providers: [...coreProviders, ...routesProviders] })
  .catch((err) => console.error(err));
```

**Key behaviours:**

1. `provideAppInitializer` blocks Angular startup until `CognitoService.init()` resolves, so authentication is settled before any route renders.
2. `withComponentInputBinding()` is load-bearing: route params, `resolve` keys, and route `data` are all delivered as component `input()`s (see §4.3).
3. `withPreloading(PreloadAllModules)` means lazy routes are code-split for the initial payload but fetched eagerly in the background — a deliberate "split without a first-navigation penalty" trade.
4. `AppComponent.ngOnInit()` awaits `StateService.getCodeTables()` (a `forkJoin` of 4 API calls) with a **10-second `timeout`**, then always calls `setReady()`. A hung code-table request degrades the UI rather than blocking it forever.

### 3.2 Public (`public/src/main.ts`)

```typescript
const coreProviders = [
  provideZonelessChangeDetection(),
  provideHttpClient(withInterceptors([errorInterceptor])),
  { provide: Configuration, useValue: apiConfig },
  importProvidersFrom(BsDatepickerModule, MatDialogModule),
];
// same routesProviders shape as admin
```

**Key behaviours:**

1. No app initializer — no auth required.
2. `AppComponent.ngOnInit()` awaits `StateService.getCodeTables()` (3 API calls) and shows `ModalService.showFOMinitFailure()` on failure. `isReady$` is only assigned on success, so the shell renders regardless.
3. Scroll reset on navigation uses `router.events` + `takeUntilDestroyed(destroyRef)`.

> Both apps register **functional** interceptors via `withInterceptors([...])`, and provide the generated client's `Configuration` directly rather than through a module.

---

## 4. Routing Architecture

Both apps use **flat route tables with lazy `loadComponent()`**.

### 4.1 Admin Routes (`admin/src/app/app.routes.ts`)

| Path | Component | Load | Guard | Resolver(s) / `data` |
|------|-----------|------|-------|----------------------|
| `not-authorized` | `NotAuthorizedComponent` | eager | — | — |
| `logout` | `LogoutComponent` | eager | — | — |
| `admin` | `SearchComponent` | eager | — | — |
| `search` | `SearchComponent` | eager | — | — |
| `about` | `AboutComponent` | lazy | — | — |
| `a/create` | `FomAddEditComponent` | lazy | — | `data: { mode: 'create' }` |
| `a/:appId` | `FomDetailComponent` | lazy | — | `projectDetail`, `spatialDetail`, `projectMetrics` |
| `a/:appId/edit` | `FomAddEditComponent` | lazy | — | `data: { mode: 'edit' }` |
| `comments/:appId` | `ReviewCommentsComponent` | lazy | — | — |
| `interactions/:appId` | `InteractionsComponent` | lazy | — | `project` |
| `a/:appId/upload` | `FomSubmissionComponent` | lazy | — | — |
| `a/:appId/summary` | `SummaryComponent` | lazy | — | — |
| `publicNotice/:appId` | `PublicNoticeEditComponent` | lazy | — | `projectDetail`; `data: { editMode: false }` |
| `publicNotice/:appId/edit` | `PublicNoticeEditComponent` | lazy | — | `projectDetail`; `data: { editMode: true }` |
| `analytics-dashboard` | `AnalyticsDashboardComponent` | lazy | `adminGuard` | `analyticsData` |
| `` (default) | `SearchComponent` | eager | — | — |
| `**` | → `/` redirect | — | — | — |

Notes:
- `logout`, `not-authorized` and `search` are **eager on purpose**. `logout` is the URL registered as this app's Cognito sign-out URL and must render without a session; `search` is the default landing.
- `adminGuard` is still the only route-level guard, protecting only the analytics dashboard. Authentication itself is enforced globally by `provideAppInitializer` + `HeaderComponent.ngOnInit` (see §7).
- Route `data` (`mode`, `editMode`) is consumed as an `input()` thanks to `withComponentInputBinding()`.

### 4.2 Public Routes (`public/src/app/app.routes.ts`)

| Path | Target | Purpose |
|------|--------|---------|
| `home/:showSplashModal` | **functional `redirectTo`** → `/projects` (+ `#splash` when `'true'`) | Legacy landing route |
| `about` | `AboutComponent` (lazy) | Static about page |
| `contact` | `ContactComponent` (lazy) | Contact information page |
| `projects` | `ProjectsComponent` (lazy) | Main map/list view of all FOMs |
| `a/:id/:tab` | **functional `redirectTo`** → `/projects?id=<id>#details` | Legacy deep link |
| `` (default) | → `home/true` | Shows splash modal on first visit |
| `**` | → `/home/true` | Wildcard fallback |

A functional `redirectTo` builds a `UrlTree`, which can carry a fragment and query params that a static `redirectTo` string cannot:

```typescript
{
  path: 'home/:showSplashModal',
  redirectTo: (route) => {
    const showSplash = route.params['showSplashModal'] === 'true';
    return inject(Router).createUrlTree(['/projects'], showSplash ? { fragment: 'splash' } : {});
  }
}
```

> The legacy URL contract (`home/:showSplashModal`, `a/:id/:tab`) is a **compatibility guarantee** — see `.github/instructions/frontend-angular.instructions.md`. Do not change its shape without an explicit requirement.

### 4.3 Route Data Delivery (Admin)

Resolvers pre-fetch data before activation; components receive it as **inputs**, not by reading `ActivatedRoute`.

```typescript
// admin/src/app/foms/fom.resolvers.ts
export const projectDetailResolver: ResolveFn<ProjectResponse> = (route) => {
  const projectId = parseInt(route.paramMap.get(PROJECT_ID_PARAM_KEY) ?? '');
  return inject(ProjectService).projectControllerFindOne(projectId);
};
// + projectSpatialDetailResolver, projectMetricsDetailResolver
// admin/src/app/analytics-dashboard/analytics.resolver.ts → AnalyticsDashboardDataService.getAnalyticsData(...)
```

```typescript
// admin/src/app/foms/fom-detail/fom-detail.component.ts
readonly projectDetail  = input.required<ProjectResponse>();              // resolve key
readonly spatialDetail  = input.required<SpatialFeaturePublicResponse[]>();
readonly projectMetrics = input.required<ProjectMetricsResponse>();

// Working copy re-seeded from the input; replaced in place by refreshProject()
readonly project = linkedSignal<ProjectResponse>(() => this.projectDetail());
```

```typescript
// admin/src/app/foms/public-notice/public-notice-edit.component.ts
readonly appId        = input.required<string>();          // :appId route param
readonly projectDetail = input.required<ProjectResponse>(); // resolve key
readonly editMode     = input.required<boolean>();          // route data
readonly projectId    = computed(() => Number(this.appId()));
```

```typescript
// admin/src/app/analytics-dashboard/analytics-dashboard.component.ts
readonly initialAnalyticsData = input.required<AnalyticsDashboardData>({ alias: 'analyticsData' });
readonly analyticsData = linkedSignal(() => this.initialAnalyticsData());  // writable working copy
```

**The `input.required` + `linkedSignal` pair is the canonical pattern** for "resolver seeds it, the component may later replace it". Note the caveat documented in `fom-detail.component.ts`: `linkedSignal` re-seeds if the input changes, discarding a refetched value — which is safe there only because the route opts out of component reuse (`routeReuseStrategy.shouldReuseRoute = () => false`).

---

## 5. Core Layer Architecture

### 5.1 Admin Core (`admin/src/core/`)

#### Services

| Service | Purpose |
|---------|---------|
| `CognitoService` | AWS Cognito authentication via `aws-amplify` v6. Manages sign-in, federated sign-out, token refresh, and exposes the current `User`. Supports a fake-user mode (`mock-user.ts`) when `awsCognitoConfig.enabled = false` (local dev). |
| `StateService` | Pre-loaded reference/code-table data plus a readiness observable (`isReady$` via `BehaviorSubject`). |
| `LoadingService` | Counter-backed global loading signal (see below). |
| `ModalService` | Wrapper over `MatDialog` + `MatSnackBar`. Typed helpers: `openDialog`, `openErrorDialog`, `openWarningDialog`, `openConfirmationDialog`, `openComponentDialog<T>`, `openSnackBar`. |
| `AttachmentResolverSvc` | Attachment fetch/remove, browser download via `file-saver-es`, and the deletion-eligibility business rule (`isDeleteAttachmentAllowed`). |

**`LoadingService` — the global in-flight signal.** A request counter exposed as a signal:

```typescript
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _inFlight = signal(0);
  /** True while one or more HTTP requests are in flight. Read-only to consumers. */
  readonly loading = computed(() => this._inFlight() > 0);
  requestStarted():  void { this._inFlight.update((n) => n + 1); }
  requestFinished(): void { this._inFlight.update((n) => Math.max(0, n - 1)); }
}
```

The HTTP error interceptor is the **only** writer. Components read `loadingSvc.loading()` in templates for spinners and form locks. The identical file exists in both apps.

Two distinct loading concepts now coexist deliberately:
- **Global** (`LoadingService.loading()`) — "any request in flight"; drives shell spinners and save-button locks.
- **Per-resource** (`someResource.isLoading`) — a specific fetch's own state; used where an unrelated request (map tiles, code tables, public notices) must not blank a panel. `ProjectsComponent.loading` and `PublicNoticesPanelComponent.isLoading` both take this route, with comments explaining why.

#### Guards

| Guard | Type | Logic |
|-------|------|-------|
| `adminGuard` | Functional | `CognitoService.getUser()?.isAdmin === true`; otherwise `router.navigate(['/not-authorized'])` and return `false`. |

#### Interceptors (functional)

| Interceptor | Purpose |
|-------------|---------|
| `errorInterceptor` | `loadingSvc.requestStarted()` on entry, `requestFinished()` in `finalize`. Maps 400 / 403 / 422 / 500 / other to `ModalService` dialogs. |
| `cognitoTokenInterceptor` | Adds `Authorization: Bearer <token>`. On 403, refreshes the Cognito token once and retries. Refresh de-duplication state lives in a `providedIn: 'root'` `TokenRefreshState` service (`inProgress` + `refreshed$` Subject) rather than interceptor instance fields. Short-circuits entirely when `cognitoService.initialized === false`. |

#### Directives

| Directive | Purpose |
|-----------|---------|
| `AppFormControlDirective` (`[appFormControl]`) | Signal-input directive that applies `is-invalid` / `invalid` classes from an `AbstractControl`'s state. Two extra inputs solve a real UX bug: `appFormControlErrorOnDirty` switches the trigger from `touched` to `dirty` for picker-only fields (`bsDatepicker` blurs the input one event *before* the picked value lands, which flashed a required error), and `appFormControlSubmitted` lights up never-touched fields once save is attempted. It also emits an `error-on-dirty` marker class so the global `.form-control.ng-touched.ng-invalid` SCSS rule can opt out. |

#### Pipes

| Pipe | Purpose |
|------|---------|
| `NewlinesPipe` | `\n` → `<br>` for HTML display. |

> Sorting and filtering are done in `computed()` signals or with `remeda` helpers (`indexBy`, `differenceWith`, `findIndex`, `funnel`, `isNullish`) rather than in pipes. Impure, value-changing pipes are a poor fit for zoneless change detection.

#### Shared UI Components (`core/components/`)

| Component | Purpose |
|-----------|---------|
| `DialogComponent` | `MatDialog` content component with typed `DialogData` (title, HTML message, cancel/confirm buttons). Inline template. |
| `UploadBoxComponent` (`app-upload-box`) | Drag-and-drop upload on `@ngx-dropzone/cdk` + `@ngx-dropzone/material`. Enforces accept-list (delegated to the library's `AcceptService`) and a max size from the `maxFileSizeMB` input. Built on **Angular Signal Forms** (`@angular/forms/signals`). |

> Buttons, file rows and form-field groups are plain Bootstrap markup styled by the SCSS partials in `assets/styles/components/`, not shared components.

### 5.2 Public Core (`public/src/core/`)

#### Services

| Service | Purpose |
|---------|---------|
| `StateService` | Code tables + `isReady$`. `getCodeTable()` shows `showFOMinitFailure()` and throws if called before initialization. |
| `LoadingService` | Identical to admin's counter-backed signal. |
| `FOMFiltersService` | Filter state as `BehaviorSubject<Map<string, IFilter\|IMultiFilter>>`, exposed as `filters$`. |
| `MapLayersService` | Leaflet base-layer / overlay change state via `BehaviorSubject`, plus `mapLayersUpdate()` and `applyCurrentMapLayers()` helpers that apply the state to a caller's `L.Map`. |
| `ModalService` | Thin `MatDialog` wrapper: `openDialog()` and `showFOMinitFailure()`. |
| `UrlService` | Query-param + fragment synchronization for shareable map/filter state. `onNavEnd$` (shared `NavigationEnd` stream), and `navigate` is debounced with a **`remeda` `funnel`** at `minQuietPeriodMs: 100`. |

#### Interceptors

| Interceptor | Purpose |
|-------------|---------|
| `errorInterceptor` | Same counter-based loading pattern. One generic, `disableClose` error dialog regardless of status code; details go to `console.error`. Deliberately less granular than admin's. |

#### Pipes

| Pipe | Purpose |
|------|---------|
| `ShortenPipe` | Truncates strings with ellipsis. |

#### Shared UI Components

`DialogComponent` only (with its own local `DialogData` interface, including `isWarning`).

---

## 6. Shared Library Layer (`libs/`)

### 6.1 Generated API Client (`libs/client/typescript-ng`)

> **IMPORTANT:** everything under `api/` and `model/` is **generated** from `api/openapi/swagger-spec.json` by OpenAPI Generator (v5.1.0). Do not hand-edit. Regenerate with `npm run gen:client-api:ng` from `api/`.

**Registration is app-side, not via `ApiModule`.** The generator cannot emit functional providers, so instead of `importProvidersFrom(ApiModule.forRoot(...))` both apps provide the `Configuration` class directly:

```typescript
const apiConfig = new Configuration({ basePath: retrieveApiBasePath() });
// ...
{ provide: Configuration, useValue: apiConfig }
```

The generated services `inject(Configuration, { optional: true })`, so this satisfies them without touching generated code. `api.module.ts` still ships in the generated output but is **not referenced anywhere** in either app.

**API services (12):**

| Service | Covers |
|---------|--------|
| `AnalyticsDashboardService` | Analytics aggregation endpoints |
| `AttachmentService` | Attachment CRUD + file-content download |
| `AuthService` | Cognito config endpoint |
| `DistrictService` | District reference data |
| `ExternalService` | External system integrations |
| `ForestClientService` | Forest client lookup |
| `InteractionService` | Interaction (engagement) records |
| `ProjectService` | FOM project CRUD, workflow transitions, metrics, search |
| `PublicCommentService` | Public comments, response codes, comment scope codes |
| `PublicNoticeService` | Public notice management |
| `SpatialFeatureService` | Geospatial feature data |
| `SubmissionService` | FOM spatial submission handling |

**Models: 47 files** under `model/`. Selected:

| Model | Purpose |
|-------|---------|
| `ProjectResponse` | Full FOM project detail |
| `ProjectPublicSummaryResponse` | Lightweight summary for map display |
| `ProjectCreateRequest` / `ProjectUpdateRequest` | Create/edit payloads |
| `ProjectWorkflowStateChangeRequest` | Workflow transition payload |
| `ProjectCommentingClosedDateChangeRequest` | End-date change payload |
| `ProjectCommentClassificationMandatoryChangeRequest` | Classification toggle |
| `SpatialFeaturePublicResponse` | Feature geometry + metadata for map rendering |
| `PublicCommentCreateRequest` / `PublicCommentAdminResponse` / `PublicCommentAdminUpdateRequest` | Comment submission and admin reply |
| `PublicNoticePublicFrontEndResponse` | Public notices list for the public app |
| `WorkflowStateEnum` | Six states: `INITIAL`, `PUBLISHED`, `COMMENT_OPEN`, `COMMENT_CLOSED`, `FINALIZED`, `EXPIRED` |
| `ProjectPlanCodeEnum` / `ProjectPlanCodeFilterEnum` | FSP / Woodlot / All |
| `ResponseCodeEnum` | Comment response classification |
| `SpatialObjectCodeEnum` | `CutBlock`, `RoadSection`, `Wtra` |
| `AwsCognitoConfig` (+ `AwsCognitoOauthConfig`, `AwsCognitoLogoutConfig`) | Cognito + federated-logout configuration from the API |

### 6.2 Utility Library (`libs/utility/src`)

Hand-written shared code. Not to be confused with the generated client. Note that the package also contains NestJS-side code (`utility.module.ts`, `utility.service.ts`) used only by `api/`.

**`security/user.ts` — `User` class.** Holds `userName`, `displayName`, `isMinistry`, `isForestClient`, `isAdmin`, `clientIds`. Methods: `isAuthorizedForAdminSite()`, `isAuthorizedForClientId(clientId)`; factories `convertAwsCognitoDecodedTokenToUser(token)` (current path — reads `cognito:groups` from the **access** token and `custom:idp_username` / `custom:idp_display_name` from the **ID** token), `convertJwtToUser(jwt)` (legacy Keycloak), `convertJsonToUser(json)`.

**`services/config.service.ts`** — `retrieveApiBasePath()` (free function) and `ConfigService`. On `localhost`, the API base is `http://localhost:3333`; otherwise it reads `fom_api_base_url` from `localStorage`. `getEnvironmentDisplay()` returns `undefined` for prod / empty, driving the header environment badge. `getAttachmentUrl(id)` builds attachment download URLs.

**`services/featureSelect.service.ts`** — spatial feature selection, exposed as a signal with deliberately custom equality:

```typescript
// `equal: () => false` preserves the previous BehaviorSubject semantics: every changeSelectedFeature()
// notifies consumers even when the index is unchanged, so re-selecting the same row re-triggers the
// map fly-to / scroll side effects.
private readonly _featureSelected = signal<string | null>(null, { equal: () => false });
readonly currentSelected: Signal<string | null> = this._featureSelected.asReadonly();
```

**`models/map-layers.ts`** — the `MapLayers` class (base layers, overlays, layer control, `MAX_ZOOM_LEVEL`) shared by all four map components.

> **Barrel caveat:** `libs/utility/src/index.ts` exports `utility.module`, `utility.service`, `models/*`, `types/*` and `security/user` — but **not** the services. `ConfigService` and `FeatureSelectService` are imported by deep path (`@utility/services/config.service`).

---

## 7. Authentication & Authorization Architecture (Admin)

### Authentication Flow

```
Browser
  │
  ▼
provideAppInitializer → CognitoService.init()
  │
  ├─ isLogoutLanding()  → pathname ends with '/logout' → loggedOut = true,
  │                        initialized = false, return null
  │                        (no config fetch, no login redirect)
  │
  ├─ loadRemoteConfig() → GET <apiBase>/api/awsCognitoConfig  (memoised promise)
  │     └─ Amplify.configure(toAmplifyConfig(config))
  │     └─ If config.enabled = false → getFakeUser() [local dev only], initialized = true
  │
  ├─ getCurrentUser() succeeds
  │     └─ refreshToken() → fetchAuthSession({ forceRefresh: true }) → jwtDecode
  │           └─ initialized = true
  │
  └─ getCurrentUser() fails → signInWithRedirect() [Cognito hosted UI]
```

There is **no `canActivate` for authentication anywhere in the route table.** Authentication is enforced by two things working together: `init()` above (which redirects to the hosted UI when there is no session) and `HeaderComponent.ngOnInit`, which routes an unauthenticated or unauthorized user to `/not-authorized` (skipping the redirect when already on `/not-authorized`, matched on `pathname` so a stray query string cannot defeat the check, and when `cognitoService.loggedOut`). `HeaderComponent.ngOnInit` also force-routes an admin-role-only user straight to `/analytics-dashboard`. Anything that changes either one changes the app's authentication behaviour globally.

### Logout: the federated chain

Cognito's hosted `/logout` does **not** propagate to an upstream OIDC identity provider. Signing out of Cognito alone leaves the Keycloak (loginproxy) and Siteminder (IDIR / BCeID) sessions intact, and the next visit silently signs the user straight back in. A real logout has to end all three.

So the app builds the whole chain itself and hands the browser to it in one full-page navigation, with **Cognito firing last**:

```
1. app        window.location.assign(<siteminder>)
2. Siteminder https://logon*.gov.bc.ca/clp-cgi/logoff.cgi
                ?retnow=1&returl=<urlencode(step 3)>
3. Keycloak   https://<loginproxy>/auth/realms/standard/protocol/openid-connect/logout
                ?client_id=<idir | bceidbusiness keycloak client>
                &post_logout_redirect_uri=<urlencode(step 4)>
4. Cognito    https://<cognito-domain>/logout
                ?client_id=<FOM app client id>
                &logout_uri=<urlencode(https://<host>/admin/logout)>
5. app        https://<host>/admin/logout   ← the only URL Cognito must allow-list
```

**Why Cognito last.** It makes Keycloak's `post_logout_redirect_uri` the *Cognito* logout URL — one stable, app-agnostic value — so FOM's own URL only ever needs registering as a Cognito sign-out URL, which FAM manages per app client. The app URL never has to go on the shared FAM Keycloak client. The browser still carries the Cognito session cookie when the chain reaches step 4, so that hop clears it server-side and returns home in a single pass.

Three things that are easy to get wrong:

- **Encode each nested URL exactly once**, where it is embedded in the enclosing query string. Miss it and `logoff.cgi` parses the inner `?…&…` as its own parameters, silently dropping the next hop's redirect target. The symptom is Siteminder or Keycloak landing on a default page instead of continuing.
- **The Keycloak client id depends on the IdP the user signed in with**, read from `custom:idp_name` on the ID token. FAM registers one client for IDIR and one for BCeID Business; sending the wrong one leaves that IdP's session alive. Matching is by **substring, case-insensitively** (`keycloakClientIdFor`), so it holds whether the claim carries the bare IdP name (`idir`) or the Cognito provider name (`DEV-IDIR` / `TEST-IDIR` / `PROD-IDIR`).
- **Amplify's `signOut()` must not run on this path.** It redirects to Cognito first, which pre-empts the chain. `logout()` clears the stored tokens locally (`clearStoredTokens()` sweeps `CognitoIdentityServiceProvider.<clientId>*` out of `localStorage`) and then navigates.

`appReturnUrl` is taken from `awsCognitoConfig.oauth.redirectSignOut` rather than a locally built `origin + '/admin/logout'`, so the chain's final hop and the Amplify fallback cannot land on different URLs.

| Piece | Where |
|---|---|
| Chain builder (pure, unit-tested) | `admin/src/core/utils/logout-chain.ts` |
| Caller, token clearing, IdP lookup | `CognitoService.logout()` |
| Landing page (eager route, no session needed) | `admin/src/app/logout/`, served at `/admin/logout` |
| Loop-breaker on the landing | `CognitoService.isLogoutLanding()`, `HeaderComponent.ngOnInit` |
| Endpoints and client ids | `logout` block of `GET /api/awsCognitoConfig`, from the `aws-cognito-env.json` ConfigMap |

`buildFederatedLogoutUrl()` returns `null` when the IdP is unknown or any config value is missing; the caller then falls back to a plain Amplify `signOut()`. That is a Cognito-only logout — degraded, but far better than navigating to a malformed URL. It is also what happens in local development, where the chain is normally unconfigured, and on the `refreshToken()` failure path, where the session is already gone and the IdP can no longer be read.

### Authorization Model

Roles come from `cognito:groups` on the **access** token:

| Cognito group | User flag | Access |
|---|---|---|
| `FOM_REVIEWER` | `isMinistry = true` | All admin site routes |
| `FOM_SUBMITTER_<clientId>` | `isForestClient = true`, `clientIds` populated | Admin site routes scoped to their forest client |
| `FOM_ADMIN` | `isAdmin = true` | Analytics Dashboard (`adminGuard`); routed there directly if it is the only role |

`adminGuard` checks `user.isAdmin`. For forest-client–scoped data access, authorization is enforced at the API level; the frontend uses `user.isAuthorizedForClientId()` for conditional UI rendering (`SearchComponent.canEditFOM` / `canViewSubmission` / `canAccessComments`).

> `User.convertJwtToUser()` maps a second, **legacy Keycloak** role vocabulary (`fom_ministry`, `fom_forest_client_<id>`). That factory is retained on the `User` class but is not reached by the live Cognito flow.

### Token Management

`cognitoTokenInterceptor` adds `Authorization: Bearer <token>` to every request. On a 403:

1. If `TokenRefreshState.inProgress` is already `true`, the request subscribes to `refreshed$` and waits — so a 403 storm triggers exactly one refresh.
2. Otherwise it sets `inProgress = true`, calls `CognitoService.updateToken()`, then emits on `refreshed$`.
3. The refreshed token is re-attached to the original request and the request is retried once.
4. If the refresh itself fails, the **original 403** is rethrown (not the refresh error).

The interceptor short-circuits when `cognitoService.initialized` is false, which is what keeps it safe on the logout landing: `init()` early-returns there, so `awsCognitoConfig` is never populated and `addAuthHeader` — which dereferences it — is never reached.

---

## 8. State Management Architecture

Neither app uses NgRx or any dedicated state-management library. State lives in `providedIn: 'root'` services, now in **two coexisting flavours**:

### Pattern A — Signals (preferred for new code)

```typescript
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly _inFlight = signal(0);
  readonly loading = computed(() => this._inFlight() > 0);   // read-only projection
  requestStarted()  { this._inFlight.update(n => n + 1); }
  requestFinished() { this._inFlight.update(n => Math.max(0, n - 1)); }
}
```

Used by: `LoadingService` (both apps), `FeatureSelectService`.

### Pattern B — `BehaviorSubject` observable store (retained where an Observable is the useful shape)

```typescript
private _state$ = new BehaviorSubject<T>(initialValue);
state$ = this._state$.asObservable();   // exposed read-only
```

Used by: `StateService.isReady$` (both apps), `FOMFiltersService.filters$`, `MapLayersService.$mapLayersChange`.

Consumers bridge these into the signal world with `toSignal()` rather than subscribing:

```typescript
// public/src/app/applications/find-panel/find-panel.component.ts
// `requireSync` is safe because `filters$` is backed by a BehaviorSubject — a current value always
// exists, so the panel is never in a "no filters yet" state and needs no placeholder defaults.
private readonly fomFilters = toSignal(this.fomFiltersSvc.filters$, { requireSync: true });
readonly fomNumberFilter = computed(() => this.fomFilters().get(FOM_FILTER_NAME.FOM_NUMBER) as Filter<number>);
```

### The reference-identity trap

`FOMFiltersService` documents a subtlety that any `BehaviorSubject → toSignal → rxResource` chain must respect:

```typescript
updateFiltersSelection(newFilters: Map<string, IFilter|IMultiFilter>) {
  // Emit a fresh Map so reference-based consumers (e.g. projects.component's rxResource keyed on
  // toSignal(filters$)) always detect the change. Callers (the Find panel) often pass back the same
  // Map instance after mutating its filter values; re-emitting that identical reference would be
  // swallowed by a signal, dropping the search.
  const nextFilters = new Map(newFilters);
  ...
}
```

Signals dedupe by reference; `BehaviorSubject` does not. Mutate-and-re-emit works with the latter and silently breaks with the former.

### State inventory

| App | Service | State held | Consumers |
|-----|---------|------------|-----------|
| both | `StateService` | `codeTables`, `isReady$` | `AppComponent`, all feature components |
| both | `LoadingService` | in-flight request count → `loading` signal | HTTP interceptor (writer); templates/components (readers) |
| admin | `TokenRefreshState` | `inProgress`, `refreshed$` | `cognitoTokenInterceptor` |
| admin | `CognitoService` | `awsCognitoConfig`, decoded tokens, `initialized`, `loggedOut` | guard, interceptor, header, feature components |
| public | `FOMFiltersService` | `Map<string, IFilter\|IMultiFilter>` | `FindPanelComponent`, `ProjectsComponent` |
| public | `MapLayersService` | base layer + overlay set | all four map components |
| public | `UrlService` | query params + fragment | `ProjectsComponent`, panels, `MarkerPopupComponent` |
| both | `FeatureSelectService` (`@utility`) | selected feature index signal | `fom-detail`, `details-panel`, map + shape-info components |

### Subscription cleanup

Every subscription in both apps uses `takeUntilDestroyed()` — there are zero `takeUntil(` occurrences:

```typescript
private destroyRef = inject(DestroyRef);
// ...
this.urlService.onNavEnd$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...);
```

`ngOnDestroy` still appears where a non-subscription resource needs releasing: `clearTimeout`, `ResizeObserver.disconnect()`, `MatSnackBarRef.dismiss()`, `NgbModalRef.dismiss()`, `L.Map.remove()`.

---

## 9. Data Loading with `rxResource`

`rxResource` is the standard way to load data in both apps (23 occurrences). It consumes the generated client's `Observable` directly and cancels the in-flight request when its params change.

### The house pattern

```typescript
private readonly projectResource = rxResource({
  params: () => Number(this.appId()),
  stream: ({ params }) => this.projectSvc.projectControllerFindOne(params),
});

// `value()` throws while the resource is in the error state, so guard reads with hasValue().
readonly project = computed(() => this.projectResource.hasValue() ? this.projectResource.value() : undefined);
readonly loading = this.projectResource.isLoading;
```

Three conventions are consistent across the codebase and should be followed:

1. **Always guard `value()` with `hasValue()`.** `value()` throws in the error state.
2. **`params: () => undefined` means "idle".** `SearchComponent` uses `signal<FindArgs | undefined>(undefined)` so no search runs until one is requested, while a defined object with all-null filters still searches everything — preserving "submit with empty filters searches all" without also searching on a bare page load.
3. **Side effects on load outcome go in `effect()`**, not in a subscribe callback:

```typescript
// SearchComponent — result-cap warning and error toast
effect(() => {
  if (!this.projectsResource.hasValue()) return;
  if (this.projectsResource.value().length >= 2500) { this.modalSvc.openSnackBar({ ... }); }
});
effect(() => {
  const error = this.projectsResource.error();
  if (error) { this.snackBarRef = this.snackBar.open('Error searching foms ...', undefined, { duration: 3000 }); }
});
```

### Resource granularity

`SummaryComponent` is the reference example of choosing many small resources over one big request:

```typescript
// The five report sections load independently: one failing must not blank out the others, which is
// why each keeps its own resource and its own error flag rather than sharing one request.
private readonly projectResource      = rxResource({ ... });
private readonly commentsResource     = rxResource({ ... });
private readonly spatialResource      = rxResource({ ... });
private readonly interactionsResource = rxResource({ ... });
private readonly attachmentsResource  = rxResource({ ... });
```

Contrast `AnalyticsDashboardDataService`, which *does* use a single `forkJoin` of 7 endpoints — but wraps each in `catchError` returning an `ApiError` sentinel, so the union type `T | ApiError` carries per-panel failure into the view.

**Where `rxResource` is used:** admin — `search`, `fom-detail`, `fom-add-edit`, `public-notice-edit`, `review-comments`, `interactions`, `summary` (+ its two sub-summaries), `comment-detail`; public — `projects`, `public-notices-panel`, `details-panel`, `find-panel`, `app-map`, `comment-modal`.

---

## 10. Forms Architecture

Three form technologies coexist, by design and by migration stage.

### 10.1 RxWeb reactive-form-validators (admin — the established pattern)

Decorator-driven model classes built with `RxFormBuilder`, typed as `IFormGroup<T>`:

```typescript
// admin/src/app/foms/fom-add-edit/fom-add-edit.form.ts
export class FomAddEditForm implements Pick<ProjectResponse, typeof updateFields[number]> {
  @prop() @required({ message: 'FOM Name is required.' }) @minLength({ value: 5, message: 'Minimum length is 5' })
  name: string;

  @prop() @required({
    message: 'FSP ID is required.',
    conditionalExpression: (x: FomAddEditForm) => x.projectPlanCode == ProjectPlanCodeEnum.Fsp
  })
  @numeric({ message: 'Must be a number.' })
  fspId?: number = null!;
}
```

Notable: the form class `implements Pick<ProjectResponse, ...>` against a generated DTO, so a schema change breaks the form at compile time. Conditional validation stays declarative in the model (`conditionalExpression`) rather than leaking into the component. Used by `fom-add-edit`, `fom-submission`, `public-notice`, `interaction-detail`.

Field-level invalid styling comes from `[appFormControl]` (§5.1).

### 10.2 Angular Signal Forms (`@angular/forms/signals`) — new work

Two components use it:

```typescript
// admin/src/app/foms/review-comments/comment-detail/comment-detail.component.ts
private readonly model = linkedSignal(() => {
  const comment = this.selectedComment();
  return {
    responseDetails: comment.responseDetails ?? '',
    responseCode: (comment.response?.code as ResponseCodeEnum) ?? '',
    revisionCount: comment.revisionCount,
  };
});

readonly commentForm = form(this.model, (path) => {
  required(path.responseCode, { message: 'Select a response' });
  maxLength(path.responseDetails, this.responseDetailsLimit, { message: `Maximum length is ...` });
  disabled(path.responseCode,    { when: () => !this.canReplyComment() });
  disabled(path.responseDetails, { when: () => !this.canReplyComment() });
});

readonly remainingChars = computed(() => this.responseDetailsLimit - this.commentForm.responseDetails().value().length);
```

Two constraints recorded in that file are worth knowing before writing another Signal Form:
- The `[formField]` directive **forbids the native `maxlength` attribute**. Enforce the limit with a `maxLength` validator plus a live character counter instead of a hard keystroke cap.
- Validators do not run while a field is `disabled`, so the save guard is backed by a separate length-based `computed` (`detailsOverLimit`) — the DB column limit must hold regardless of field state.

Also used by `UploadBoxComponent`.

### 10.3 Template-driven `ngModel` (public + simple admin filters)

`FindPanelComponent`, `CommentModalComponent`, `EnddateChangeModalComponent`, `SearchComponent` and the analytics filters use `FormsModule` + plain properties. In `FindPanelComponent` the `ngModel` targets are the **service's own filter objects** read through `computed()`, so editing a field mutates shared state directly — intentional, and documented in the component.

> Recommended per `.github/instructions/frontend-angular.instructions.md`: keep admin forms on the existing RxWeb pattern unless deliberately migrating to Signal Forms; keep public validation lightweight.

---

## 11. HTTP and Error Handling

### Request Pipeline (Admin)

```
Component → API Service (generated) → HttpClient
  → errorInterceptor        (LoadingService.requestStarted; maps errors → dialogs)
  → cognitoTokenInterceptor (add Bearer token; refresh + retry on 403)
  → HTTP / API
```

Interceptor **order is load-bearing** and is commented as such in `main.ts`: the token interceptor is *last in the array*, so it is *innermost* — it sees the response first and can refresh + retry a 403 before the error interceptor would surface a "Forbidden" dialog.

### Request Pipeline (Public)

```
Component → API Service (generated) → HttpClient
  → errorInterceptor (LoadingService counter; generic error dialog)
  → HTTP / API
```

### Error Handling Matrix (Admin `errorInterceptor`)

| HTTP status | User feedback | Title |
|---|---|---|
| 400 | "The request was not valid: `{error}`. Please fix the issue and try again." | Bad Request |
| 403 | "You were not authorized to perform the request… try logging out and back in…" | Forbidden |
| 422 | "`{error}`" | Save Conflict |
| 500 | "A system error occurred. Please try again later…" (+ `console.error` with `urlWithParams`) | System Error |
| other | Generic unknown-error message (+ `console.error`) | Error |

Admin rethrows the *extracted message* (`throwError(() => error)`); public rethrows the *original `HttpErrorResponse`* (`throwError(() => err)`). Callers in each app are written to that shape.

The public interceptor shows one generic `disableClose` dialog for every status code, with details logged as a structured object.

---

## 12. Map Architecture

There are **four** Leaflet map components, not one:

| Component | App | Role |
|---|---|---|
| `AppMapComponent` | public | The main all-FOMs cluster map |
| `DetailsMapComponent` | public (`applications/details-panel/details-map/`) | Single-FOM map inside the details panel |
| `DetailsMapComponent` | admin (`foms/details-map/`) | Single-FOM map on FOM detail + summary pages |
| `ShapeInfoComponent` | both | Feature list paired with the details maps |

### Public map component hierarchy

```
ProjectsComponent (container: layout, panel state, FOM fetch)
  ├── AppMapComponent            (Leaflet cluster map; input projectsSummary, output updateCoordinates)
  │   └── MarkerPopupComponent   (Angular component created + attached into a Leaflet popup)
  ├── FindPanelComponent         (filter UI; output update: IUpdateEvent)
  ├── DetailsPanelComponent      (project detail; embeds DetailsMap + ShapeInfo; output update)
  └── PublicNoticesPanelComponent(+ PublicNoticesFilterPanelComponent)
```

Children are reached via `viewChild()` signal queries (`appmap`, `findPanel`, `detailsPanel`, `publicNoticesPanel`), and are addressed as `this.appmap()?.resetView(false)`.

### `leaflet-host.ts` — the shared Leaflet boundary

`public/src/app/applications/utils/leaflet-host.ts` is a small, unit-tested module that every public map component goes through. It exists to fix two classes of real bug:

```typescript
/** Leaflet bind target in map component templates — pair with .map-host CSS, never id="map". */
export const MAP_HOST_SELECTOR = ':scope .map-host';

export function initMap(container: HTMLElement, options: L.MapOptions): L.Map {
  // double-init caused filter-freeze when two maps shared getElementById('map')
  if ((container as any)._leaflet_id != null) {
    throw new Error('Leaflet map already initialized on this container');
  }
  return L.map(container, options);
}

export function observeMapSize(map: L.Map, onFirstSized: () => void): ResizeObserver { ... }
```

- **Never `id="map"`.** Two simultaneously mounted maps sharing `getElementById('map')` double-initialised one container and froze filtering. Components query a scoped `.map-host` element via `mapContainer(elementRef)` instead.
- **Sizing is `ResizeObserver`-driven, not timer-driven.** `observeMapSize()` calls `invalidateSize()` on every resize and runs `onFirstSized` exactly once — on the first callback where the container actually has non-zero width — for the one-time `fitBounds` / `setView`. Callers must `disconnect()` on teardown.

Where a resize genuinely cannot be observed (closing the ngb splash modal does not resize the map container), `afterNextRender` is used instead of a timeout:

```typescript
// ProjectsComponent
private invalidateMapSize() {
  // Closing the splash modal doesn't resize the map container, so the map's own
  // ResizeObserver won't fire; refresh it once the post-close render has painted.
  afterNextRender(() => this.appmap()?.invalidateSize(), { injector: this.injector });
}
```

### Leaflet integration details

- Leaflet is loaded **twice on purpose**: as an ES module import *and* as a global script via `angular.json → scripts`. `leaflet.markercluster` augments both, and `AppMapComponent` falls back across them: `(window as any).L?.markerClusterGroup || L.markerClusterGroup`. The cluster group is built in the **constructor** because `ngOnChanges` (which calls `drawMap`) fires before `ngAfterViewInit`.
- Module interop: `const L = (L_import as any).default || L_import;` in every file that imports Leaflet.
- `L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40, iconCreateFunction: this.clusterCreate })`.
- Custom marker icons are SVG assets under `assets/images/`.
- Angular components are injected into Leaflet popups with `createComponent(MarkerPopupComponent, { environmentInjector })` + `appRef.attachView(compRef.hostView)`.
- `MapLayersService` decouples the layer control from the maps: components subscribe to `$mapLayersChange` (via `takeUntilDestroyed`) and call `mapLayersUpdate(map, mapLayers)` / `applyCurrentMapLayers(map, mapLayers)`.
- Map-move notification is throttled with `remeda`'s `funnel` (`emitCoordinates.call()`).

---

## 13. Path Aliases and Module Resolution

Aliases are declared in each app's `tsconfig.json` and mirrored in `jest.config.js` `moduleNameMapper`. `baseUrl: "./src"` also makes `app/...` resolvable.

| Alias | Admin resolves to | Public resolves to |
|---|---|---|
| `@admin-core/*` | `admin/src/core/*` | — |
| `@public-core/*` | — | `public/src/core/*` |
| `@api-client` | `libs/client/typescript-ng` | `libs/client/typescript-ng` |
| `@utility/*` | `libs/utility/src/*` | `libs/utility/src/*` |
| `app/*` | `admin/src/app/*` (via `baseUrl`) | `public/src/app/*` (via `baseUrl`) |

Both apps compile with `moduleResolution: "bundler"`, `target: ES2022`, `strict: true`, `strictTemplates: true`, `strictInjectionParameters`, `strictInputAccessModifiers` — and `strictPropertyInitialization: false` (an explicit project decision; hence the `user!: User` / `null!` patterns).

---

## 14. Runtime Configuration

Both apps use **runtime** configuration for the API base URL (not build-time substitution):

1. `index.html` loads `assets/env/env.js` **before** the app bundle.
2. That file writes to `window.localStorage`:
   - `fom_api_base_url` — backend API URL
   - `fom_environment_name` — display label (`dev`, `test`, …); empty/`prod` in production
3. `retrieveApiBasePath()` returns `http://localhost:3333` when `hostname === 'localhost'`, otherwise reads `fom_api_base_url`. It is called once in `main.ts` to build the `Configuration`, and again by `ConfigService`.
4. `ConfigService` reads `fom_environment_name` at construction; `getEnvironmentDisplay()` drives the header environment badge.
5. In OpenShift, `env.js` is generated from a ConfigMap in `openshift.deploy.yml` and mounted at `/dist/assets/env`:

```yaml
data:
  env.js: |-
    window.localStorage.setItem('fom_environment_name', '${ZONE}');
    window.localStorage.setItem('fom_api_base_url', 'https://${URL}');
```

One Docker image therefore serves every environment without a rebuild.

> The checked-in `src/assets/env/env.js` holds the **local dev** values (`''` / `http://localhost:3333`) and is overwritten by the mount in deployed environments.

---

## 15. Build and Deployment

### Build

```bash
# From repo root (npm workspaces)
npm run build:admin     # → admin/dist/admin
npm run build:public    # → public/dist/public
npm run start:admin     # ng serve --configuration development --host=0.0.0.0  (:4200)
npm run start:public    # ng serve --configuration development --host=0.0.0.0  (:4300)
```

Both apps use the modern `@angular/build:application` builder (esbuild/Vite), not the legacy webpack browser builder.

| | Admin | Public |
|---|---|---|
| `baseHref` | `/admin/` | `/public/` |
| Dev-server port | 4200 | 4300 |
| Initial-bundle budget | warn 5 MB / error 6.1 MB | warn 5 MB / error 5 MB |
| Component-style budget | warn 6 KB / error 10 KB | warn 8 KB / error 10 KB |
| `allowedCommonJsDependencies` | `leaflet`, `json-2-csv` | `leaflet`, `leaflet.markercluster`, `object-hash` |
| Global `scripts` | leaflet, markercluster, apexcharts | leaflet, markercluster |
| Extra global style | — | `@angular/material/prebuilt-themes/indigo-pink.css` |

Production configuration in both: `environment.ts` → `environment.prod.ts` file replacement, `outputHashing: all`, hidden source maps, `extractLicenses`, `inlineCritical: false`.

### Local development (`docker-compose.yml`)

`init-deps` runs a **single hoisted `npm ci --ignore-scripts` at the workspace root** into a shared `root-node-modules` volume; `admin`, `public` and `api` all mount it and depend on `init-deps` completing. This is what guarantees one physical Angular copy and avoids `NG0203`. Angular's `.angular` build cache is kept in named volumes so it never lands root-owned on the host.

### Containers

Multi-stage `Dockerfile` per app: `node:24.19.0-bookworm-slim` build stage → `caddy:2.11.4-alpine` serve stage, running as `USER 1001`.

The build stage copies **only the root lockfile plus the manifests this image needs** (`libs/package.json` + the app's `package.json`), then runs one root-level `npm ci --ignore-scripts`:

```dockerfile
RUN npm install -g npm@10.9.4
COPY package.json package-lock.json ./
COPY libs/package.json ./libs/
COPY admin/package.json ./admin/
# `npm ci` reads the full root lockfile but skips workspaces whose directory is absent,
# so it installs just admin's + libs' deps. npm is pinned to 10.9.4 so this
# skip-missing-workspaces behaviour is deterministic.
RUN npm ci --ignore-scripts
```

Caddy serves the SPA with HTML5 `pushState` (`handle_path /admin/*  { try_files {path} {path}/ {file} /index.html }`), zstd/gzip encoding, `Cache-Control max-age=300`, and a full `Content-Security-Policy` allow-listing `*.gov.bc.ca`, `*.auth.ca-central-1.amazoncognito.com`, `cognito-idp.ca-central-1.amazonaws.com`, and the ArcGIS / `maps.gov.bc.ca` tile hosts.

### CI/CD (`.github/workflows/`)

`pr-open.yml` builds `admin`, `api`, `db`, `public` in a matrix via `bcgov/action-builder-ghcr`, with **path triggers** (`admin` builds on `admin/` or `libs/` changes), then deploys to a per-PR OpenShift namespace, smoke-tests, and gates the merge on a `results` job. `merge.yml`, `prod.yml`, `pr-close.yml`, `pr-validate.yml`, `analysis.yml` cover the remaining lifecycle.

---

## 16. Testing Architecture

Both apps use **Jest 30** with `jest-preset-angular` 17 (no Karma/Jasmine).

### Zoneless test environment

```typescript
// admin/src/test-setup.ts  (identical in public)
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';
setupZonelessTestEnv();
```

This is the counterpart to `provideZonelessChangeDetection()` and is **required** — tests must `await fixture.whenStable()` rather than relying on `fakeAsync`/`tick` zone semantics.

### Configuration

- `jest.config.js` per app; `moduleNameMapper` mirrors the tsconfig aliases exactly.
- `setupFiles: ['<rootDir>/src/jest-global-setup.ts']` — patches the `Buffer` prototype chain so esbuild's `instanceof Uint8Array` check passes inside Jest's VM context (Node 22+ compatibility).
- `setupFilesAfterEach: ['<rootDir>/src/test-setup.ts']` — the zoneless env.
- Coverage output: `coverage/admin/`, `coverage/public/`, `libs/coverage/` at repo root.
- `tsconfig.spec.json` per app (`types: ["jest", "node"]`).

### Coverage inventory

| Area | Components | Spec files |
|---|---|---|
| admin | 26 | 21 |
| public | 17 | 22 |
| libs/utility | — | 2 (`user.spec.ts`, `utility.service.spec.ts`) |

Notable test targets beyond components: `logout-chain.spec.ts` (the pure chain builder), `cognito-token-interceptor.spec.ts`, `http-error.interceptor.spec.ts` (both apps), `fom.resolvers.spec.ts`, `app.routes.spec.ts` (public — asserts the functional redirects), `leaflet-host.spec.ts`, `filter.spec.ts`, `fomFilters.service.spec.ts`, `loading.service.spec.ts` (both apps), `form-control.directive.spec.ts`. `admin/src/app/spec/helpers.ts` holds shared TestBed helpers.

### Running tests

```bash
cd admin  && npm run test-unit          # jest --coverage
cd public && npm run test-unit
cd admin  && npm run test-unit-watch
```

No frontend e2e suite; e2e tests exist only under `api/src/e2e`.

### Lint

Flat ESLint 10 config (`eslint.config.mjs`) per app: `typescript-eslint` recommended + `@angular-eslint` component/directive selector rules (`app` prefix, kebab-case elements / camelCase attributes) + `eslint-config-prettier`. `eslint-base.config.mjs` at the root holds shared ignores and rules. Run with `npx ng lint admin` / `npx ng lint public`.

---

## 17. Key Architectural Decisions

### ADR-1: Standalone components, zero NgModules
Neither app declares an `@NgModule`. `importProvidersFrom(...)` bridges the remaining module-only third-party libraries (`BsDatepickerModule`, `NgbModule`, `RxReactiveFormsModule`, `MatDialogModule`, `MatSnackBarModule`). *Consequence:* the dependency graph is explicit per component; the cost is a longer `imports` array on each component.

### ADR-2: Zoneless change detection (both apps)
`provideZonelessChangeDetection()` means no `zone.js` monkey-patching. *Consequences:* (a) all view-relevant state must be a signal or flow through a template binding — a value written from an async callback and read directly by the template will not repaint (see the "written from async callbacks, so the view only learns about them through signals" comment in `DetailsPanelComponent`); (b) `setTimeout` does not schedule change detection, so DOM timing goes through `afterNextRender` / `ResizeObserver`; (c) tests must use `setupZonelessTestEnv()` + `whenStable()`; (d) `ngx-bootstrap`'s datepicker is the most zoneless-sensitive component in either app and the first thing to regression-test on any upgrade.

### ADR-3: Lazy loading via `loadComponent` + `PreloadAllModules`
Routes are code-split, and `withPreloading(PreloadAllModules)` fetches them in the background so navigation stays instant. Only auth-critical / default routes are eager. *Trade-off:* smaller initial parse, at the cost of background network use after boot.

### ADR-4: Signals + `rxResource` over manual `subscribe`
Data loading, derived state, and component I/O are signal-based. RxJS is used where it is genuinely the right shape (`forkJoin` for parallel fetches, `BehaviorSubject` stores, router event streams) and bridged with `toSignal` / `rxResource`. *Consequence:* no manual loading flags or `subscribe(next, error)` bookkeeping; the signal reference-equality trap (§8) is a live hazard for any store that mutates and re-emits.

### ADR-5: Service-based state (no NgRx)
State lives in `providedIn: 'root'` services holding signals or `BehaviorSubject`s. Appropriate for the app's complexity — no complex derived cross-entity state, no optimistic updates, no time-travel requirement.

### ADR-6: Single hoisted npm workspace
The repo root is an npm workspaces root (`workspaces: ["libs", "public", "admin", "api"]`). All installs are one hoisted `npm ci --ignore-scripts` at the root, in Docker and in docker-compose alike, so the app and the `libs` source it compiles in-place resolve `@angular/*` to one physical copy — which is what prevents `NG0203`. `package.json` `overrides` force `ngx-bootstrap` onto Angular 22 peers. *Consequence:* installs happen at the repo root; a per-app `npm ci` inside `admin/` or `public/` is not a supported path.

### ADR-7: Generated API client, provided app-side
The client is generated from the NestJS OpenAPI spec, guaranteeing type safety across the API boundary. Because the generator cannot emit functional providers, `ApiModule.forRoot()` is bypassed and `Configuration` is provided directly in `main.ts` — solving the problem without hand-editing generated output. *Consequence:* client regeneration must follow every API schema change; `api.module.ts` remains dead generated code.

### ADR-8: Runtime configuration
API base URL and environment label come from `localStorage`, populated by a ConfigMap-mounted `env.js`. One image, many environments.

### ADR-9: Federated logout chain owned by the frontend
See §7. Building the Siteminder → Keycloak → Cognito chain in the app (rather than relying on Amplify `signOut()`) is what makes a real logout possible while keeping only *one* FOM URL on the FAM-managed allow-list. The pure builder is isolated in `logout-chain.ts` and unit-tested; the caller degrades to a Cognito-only sign-out when config is incomplete.

### ADR-10: Signal Forms adopted incrementally
`@angular/forms/signals` is used for two new/rewritten components while the established RxWeb decorator pattern stays in place for the four large admin forms. *Rationale:* the RxWeb models encode substantial conditional validation and are typed against generated DTOs; a wholesale rewrite carries more risk than value today. *Consequence:* three form technologies coexist — pick by the table in §10, not by preference.

---

## 18. Extension and Evolution Patterns

### Adding a new admin feature page

1. Create a component directory under `admin/src/app/<feature-name>/`.
2. Write a standalone component (no `standalone: true` needed — it is the Angular 22 default). Prefer `inject()` over constructor params, `input()` / `output()` / `viewChild()` over decorators.
3. Add a **lazy** route: `loadComponent: () => import('./<feature>/<feature>.component').then(m => m.XComponent)`.
4. If the page needs data before it renders, add a `ResolveFn` in `<feature>.resolvers.ts` and receive it as `input.required<T>()` (route param, `resolve` key, and route `data` key all arrive as inputs). Use `linkedSignal(() => this.thatInput())` if the component will later replace the value.
5. For data fetched *by* the component, use `rxResource` with `hasValue()` guards; put load side effects in `effect()`.
6. If admin-only, add `canActivate: [adminGuard]`.
7. Inject `StateService` for code tables, `LoadingService` for global in-flight state, generated services from `@api-client` for data.
8. Use `@if` / `@for` in templates. Do not add `CommonModule` — import only the pipes you need (`DatePipe`, `TitleCasePipe`, …).

### Adding a new API call

1. Update the NestJS API and expose it via Swagger.
2. Refresh `api/openapi/swagger-spec.json` from the running API (`GET http://localhost:3333/api-json`).
3. Run `npm run gen:client-api:ng` from `api/`.
4. The updated service/model is available from `@api-client`. Never hand-edit `libs/client/typescript-ng/api` or `model`.

### Adding a new shared utility

- Place hand-written code in `libs/utility/src/`.
- Export it from `libs/utility/src/index.ts` **if** it belongs in the barrel — note that services are currently imported by deep path (`@utility/services/...`); follow whichever convention the neighbouring code uses.
- Import via `@utility/<path>` from either app.

### Adding a new public filter

1. Add a `FOM_FILTER_NAME` enum entry in `FOMFiltersService`.
2. Add a default entry in `DEFAULT_FOM_FILTERS` and wire it into `_getDefaultFilters()`.
3. Expose the control in `FindPanelComponent` — add a `computed()` that reads it out of the `toSignal(filters$)` map.
4. Consume it in `ProjectsComponent.fetchFOMs()`; the `rxResource` re-runs automatically.
5. **Emit a new `Map`** from any new service mutator (see §8).

### Adding a new map

1. Put a `.map-host` element in the template — **never `id="map"`**.
2. Use `mapContainer(elementRef)` + `initMap()` from `leaflet-host.ts`.
3. Register `observeMapSize(map, onFirstSized)` for sizing and the one-time `fitBounds`; `disconnect()` it in `ngOnDestroy` and call `destroyMap(map)`.
4. Route layer changes through `MapLayersService`, and URL/panel state through `UrlService`.

### Component authoring conventions

The canonical choice for each concern, applied consistently across both apps:

| Concern | Use |
|---|---|
| Component input | `readonly x = input.required<T>()` / `input<T>(default)` |
| Component output | `readonly y = output<T>()` |
| Template query | `readonly z = viewChild<T>('z')` / `viewChild.required(...)` |
| Dependency injection | `private a = inject(A)` |
| Fetching data | `rxResource({ params, stream })` + `computed(() => r.hasValue() ? r.value() : undefined)` |
| In-flight state | `resource.isLoading` (per-fetch) or `loadingSvc.loading()` (global) |
| Load-outcome side effects | `effect(() => ...)` on `resource.error()` / `hasValue()` |
| Subscription teardown | `takeUntilDestroyed(inject(DestroyRef))` |
| Making the view repaint | make the state a `signal` |
| DOM work that must wait for paint | `afterNextRender(..., { injector })` or `ResizeObserver` |
| Template control flow | `@if` / `@for` |
| Sorting / filtering a collection | `computed()` + `remeda` |

---

## 19. Architectural Pattern Examples

### Layer separation — resolver → input → working copy

```typescript
// Route (app.routes.ts)
{
  path: 'a/:appId',
  loadComponent: () => import('./foms/fom-detail/fom-detail.component').then(m => m.FomDetailComponent),
  resolve: { projectDetail: projectDetailResolver, spatialDetail: projectSpatialDetailResolver,
             projectMetrics: projectMetricsDetailResolver }
}

// Resolver (fom.resolvers.ts) — knows the API, not the component
export const projectDetailResolver: ResolveFn<ProjectResponse> = (route) =>
  inject(ProjectService).projectControllerFindOne(parseInt(route.paramMap.get(PROJECT_ID_PARAM_KEY) ?? ''));

// Component — knows the shape, not where it came from
readonly projectDetail = input.required<ProjectResponse>();
readonly project = linkedSignal<ProjectResponse>(() => this.projectDetail());
```

### Cross-cutting concern — interceptor as the only writer of global state

```typescript
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const modalSvc   = inject(ModalService);
  const loadingSvc = inject(LoadingService);

  loadingSvc.requestStarted();
  return next(request).pipe(
    finalize(() => loadingSvc.requestFinished()),
    catchError((err) => { /* status → dialog */ return throwError(() => error); })
  );
};
```

No component ever sets a loading flag for an HTTP call, and no component builds its own error dialog for a transport failure.

### Component communication — service as the decoupling point

```typescript
// Publisher: the layer control calls
mapLayersService.notifyLayersChange({ overlay: { action: OverlayAction.Add, layerName } });

// Subscriber: any map component, with no reference to the control
this.mapLayersService.$mapLayersChange
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(() => this.updateOnLayersChange());
```

### Extension point — dynamic component into a third-party DOM node

```typescript
// AppMapComponent — Angular component rendered inside a Leaflet popup
const compRef = createComponent(MarkerPopupComponent, { environmentInjector: this.injector as any });
this.appRef.attachView(compRef.hostView);
// compRef.location.nativeElement is then handed to marker.bindPopup(...)
```

### Idle-until-requested resource

```typescript
// SearchComponent — `undefined` params keep the loader idle
private readonly criteria = signal<FindArgs | undefined>(undefined);
private readonly projectsResource = rxResource({
  params: () => this.criteria(),
  stream: ({ params }) => this.searchProjectService.projectControllerFind(
    params.projectId, params.fspId, params.districtId, params.workflowStateCode, params.forestClientName),
  defaultValue: [] as ProjectResponse[],
});
readonly searched = computed(() => this.projectsResource.status() !== 'idle');
```

---

## 20. Architecture Governance

| Mechanism | Where |
|---|---|
| Coding standards & preferred patterns | `.github/instructions/frontend-angular.instructions.md` (`applyTo: ./admin/**, ./public/**`), `repo-shared.instructions.md`, `instructions.instructions.md` |
| Architecture references | `.github/references/frontend-architecture-blueprint.md`, `api-backend-architecture-blueprint.md`, and this document |
| Lint enforcement | `eslint.config.mjs` per app + `eslint-base.config.mjs`; `npx ng lint admin` / `public` |
| Type enforcement | `strict: true` + `strictTemplates` + `strictInjectionParameters` + `strictInputAccessModifiers` |
| Bundle-size enforcement | `angular.json` budgets (initial + per-component style) |
| Generated-code protection | `libs/client/typescript-ng/.openapi-generator-ignore`; explicit "do not hand-edit" rules in the instructions file |
| CI gates | `pr-open.yml` matrix build + deploy + smoke, with a merge-blocking `results` job |
| Dependency currency | `renovate.json`, plus root `overrides` pinning `ngx-bootstrap` peers to Angular 22 |
| Local-dev parity | `docker-compose.yml` (single hoisted install, health-gated startup ordering) |

**Per-app validation checklist** (from the instructions file):

```bash
# Admin changes
npm ci --ignore-scripts          # at repo root (workspaces)
cd admin && npm run test-unit && npm run build:admin && npx ng lint admin

# Public changes
npm ci --ignore-scripts
cd public && npm run test-unit && npm run build:public && npx ng lint public
```

> `.github/instructions/frontend-angular.instructions.md` carries `applyTo: ./admin/**, ./public/**`, so it is loaded automatically for any frontend change. It is the short, rule-shaped form of this document; keep the two in step.

---

## 21. Common Pitfalls

Each of these is a bug that has actually occurred in this codebase and is guarded by a comment in the source.

| Pitfall | Guard |
|---|---|
| Changing admin interceptor order | Token interceptor must stay **last** in `withInterceptors([...])` so it is innermost and can refresh+retry a 403 before the error dialog fires. Comment in `main.ts`. |
| Mutating and re-emitting the same `Map` from `FOMFiltersService` | Signals dedupe by reference; the search silently stops running. Always `new Map(...)`. |
| Reading `resource.value()` without `hasValue()` | Throws in the error state. |
| `linkedSignal` seeded from a route input on a reused route | Re-seeding discards a refetched value. `fom-detail` opts out via `routeReuseStrategy.shouldReuseRoute = () => false`. |
| Two Leaflet maps sharing `id="map"` | Double-init froze filtering. Use `.map-host` + `initMap()`'s guard. |
| Sizing a Leaflet map with `setTimeout` | Use `observeMapSize()`; where no resize occurs (splash-modal close), use `afterNextRender`. |
| Building the `markerClusterGroup` in `ngOnInit` | `ngOnChanges` → `drawMap` runs first and throws, aborting change detection. Build it in the constructor. |
| Calling Amplify `signOut()` on the logout path | It redirects to Cognito first and pre-empts the federated chain. |
| Double- or zero-encoding a nested logout URL | `logoff.cgi` swallows the next hop. Encode exactly once, at the point of embedding. |
| Dereferencing `awsCognitoConfig` on the logout landing | `init()` early-returns there, so it is `undefined`. Use `?.` — see `HeaderComponent.navigateToLogout`. |
| Writing view state from an async callback into a plain field | Zoneless: the view never learns. Make it a `signal`. |
| `maxlength` attribute on a Signal Forms `[formField]` | Forbidden by the directive. Use the `maxLength` validator + a counter. |
| Relying on a Signal Forms validator while the field is `disabled` | Validators do not run. Back the guard with a plain length `computed` (`detailsOverLimit`). |
| `npm ci` inside `admin/` or `public/` alone | Breaks the single-hoisted-Angular invariant → `NG0203`. Install at the repo root. |
| Adding an impure pipe for sorting/filtering | Impure pipes do not re-evaluate reliably under zoneless change detection. Use `computed()` + `remeda`. |

### Known remaining rough edges

- **12 `setTimeout` call sites** remain in production code (`details-panel`, `fom-detail`, both `details-map`s, `interactions`, `review-comments` ×3, `projects`, `public-notices-panel`, `analytics-dashboard`). Most are deliberate "let the view paint before scrolling" waits; `afterNextRender` is the preferred replacement where the timing is actually render-bound.
- **One `ChangeDetectorRef` reference** remains in the codebase; everywhere else the state it would guard is a signal.
- `ProjectsComponent.handleFragment` still routes through a `setTimeout` + `clearTimeout` pair rather than a render hook.
- `libs/utility/src/index.ts` does not export the services, so import paths are inconsistent (barrel for `User`, deep path for `ConfigService`).
- `libs/client/typescript-ng/api.module.ts` is generated but dead.
- `admin`/`public` `index.html` contain an `*ngIf` inside the `<app-root>` loading placeholder. It is inert — the placeholder is never compiled as a template — but it reads as live code.

---

## 22. Quick Reference

### Import paths

| What | Import path |
|---|---|
| Any API service, DTO, or enum | `@api-client` |
| `User` domain object | `@utility/security/user` |
| `ConfigService` / `retrieveApiBasePath` | `@utility/services/config.service` |
| `FeatureSelectService` | `@utility/services/featureSelect.service` |
| `MapLayers` | `@utility/models/map-layers` |
| Admin core service | `@admin-core/services/<name>` |
| Admin guard | `@admin-core/guards/admin.guard` |
| Admin constants | `@admin-core/utils/constants` |
| Public core service | `@public-core/services/<name>` |
| Public constants | `@public-core/constants/appConstants` |
| Feature component (either app) | `app/<feature>/<name>.component` |

### Reactive API cheat-sheet (current usage counts)

| API | Occurrences |
|---|---|
| `computed(` | 37 |
| `viewChild` | 26 |
| `rxResource` | 23 |
| `signal(` / `signal<` | 17 / 21 |
| `takeUntilDestroyed` | 19 |
| `input.required` / `input(` | 15 / 2 |
| `linkedSignal` | 11 |
| `toSignal` | 8 |
| `effect(` | 8 |
| `@if` / `@for` in templates | 201 / 40 |
| `*ngIf` / `*ngFor` | 2 (both inert, in `index.html`) / 0 |
| `takeUntil(` | 0 |

### Ports

| Service | Port |
|---|---|
| admin dev server / Caddy | 4200 |
| public dev server / Caddy | 4300 |
| API | 3333 |

### Environment badge

Header components render a badge when `ConfigService.getEnvironmentDisplay()` returns a value — i.e. any environment where `fom_environment_name` is set and is not `'prod'`.

---

## Maintaining this document

**Generated:** 2026-08-18, from a direct read of `admin/`, `public/`, `libs/`, the build/test/lint configs, `docker-compose.yml`, the Dockerfiles/Caddyfiles/OpenShift manifests, and `.github/workflows/`.

Re-verify this blueprint when any of the following change, since each invalidates a specific section:

- **Angular major upgrade** → §1 (stack line), §3 (bootstrap APIs), §9–10 (`rxResource` / Signal Forms surface), §16 (test env), ADR-2.
- **`main.ts` provider array** → §3, §11 (interceptor order), ADR-1/ADR-7.
- **Route table** → §4, §18.
- **`libs/client/typescript-ng` regeneration** → §6.1 (service/model inventory), and check whether `Configuration` is still injected `{ optional: true }`.
- **Cognito / FAM configuration or the logout chain** → §7, ADR-9.
- **A new state service, or a store changing between signal and `BehaviorSubject`** → §8.
- **A new map component** → §12, §18.
- **Workspace, Docker, or OpenShift install topology** → §15, ADR-6.
- **Any change above** → mirror it in `.github/instructions/frontend-angular.instructions.md`, which agents load automatically for frontend work.
