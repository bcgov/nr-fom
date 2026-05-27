## Description
This PR upgrades the FOM applications to Angular 21 and resolves several critical regressions in both the Public and Admin projects that were introduced during the dependency upgrade.

### Key Changes

#### Admin Project
- **Bootstrap Restoration**: Resolved a hang in the `APP_INITIALIZER` flow caused by silent failures in Cognito initialization.
- **Auth Interceptor Heroics**: Fixed a critical bug where the `Authorization` header was being sent as a JSON-stringified object instead of a raw JWT, causing infinite 403 refresh loops.
- **Search Rendering**: Fixed a race condition/change detection issue where search results were fetched but not rendered.
- **UI Stability**: Resolved 'Submitting' state hangs on the FOM Add/Edit page and fixed filter label overlaps via `container-fluid`.

#### Public Project
- **Splash Modal**: Restored the splash popup functionality by correctly handling URL fragments during the initial bootstrap.
- **Map Initialization**: Fixed the Leaflet map lifecycle to ensure FOM markers render correctly on initial load.
- **NG0100 Fixes**: Mitigated multiple `ExpressionChangedAfterItHasBeenCheckedError` instances across the header and map components.
- **Type Safety**: Resolved `TypeError` in `remeda` usage within the map component.

#### Infrastructure & Tools
- **Docker**: Updated Dockerfiles to Node.js 20.19.0-alpine for compatibility with Angular 21.
- **Dependencies**: Resolved multiple peer dependency conflicts and updated test environments (Jest/JSDOM).

## Success Criteria
- [x] Admin app successfully bootstraps past Cognito initialization.
- [x] Search results render correctly in Admin.
- [x] Public map markers render on initial page load.
- [x] Splash modal appears on `/public#splash`.
- [x] Docker containers build and run successfully.

Closes #929
