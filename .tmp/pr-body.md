## Summary

This PR modernizes the entire FOM stack, moving from Angular 19.x to **Angular 21.x**, and aligning the backend and libraries with **TypeScript 5.9.3** and **Jest 30**.

### Key Changes
- **Angular 21 Upgrade**: Upgraded `admin`, `public`, and `libs` to Angular 21.2.7.
- **Backend Alignment**: Upgraded `api` to TypeScript 5.9.3 and Jest 30.3.0 to match the project-wide modernization.
- **Security Hardening**:
    - Cleared all high/critical vulnerabilities identified by `npm audit` (including `handlebars` and `tar`).
    - Fixed `path-to-regexp` and `picomatch` vulnerabilities in `libs`.
- **Infrastructure**: Bumped Docker base images to **Node 22-alpine**.
- **Build Fixes**: Resolved TypeScript module resolution issues in `tsconfig.json` that were breaking production builds.

### Testing
- **admin**: Unit tests passed ✅
- **public**: Unit tests passed ✅
- **api**: Unit tests passed ✅
- **libs**: Unit tests passed ✅
- **Production Builds**: Verified `ng build` for both frontend apps.

Closes #910
