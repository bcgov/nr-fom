# bcgov/nr-fom Maturity Report

**Date**: 2026-09-05
**Maturity Level**: Level 4 (Managed)
**Compliance Score**: 92%

## Executive Summary
`nr-fom` is highly mature and successfully leverages modern CI/CD patterns. Following the recent transition to Maintenance Mode, the repository features automated Renovate dependency updates and a Release-Gated production deployment pipeline, completely eliminating manual `workflow_dispatch` gates.

## Dimension Breakdown

| Dimension | Score | Status | Notes |
|-----------|-------|--------|-------|
| 1. Repo Settings | 1.0 | [x] Met | Auto-merge enabled, squash merge enforced. |
| 2. Branch Rulesets | 1.0 | [x] Met | `pr-validate` and tests enforce PR gates. |
| 3. Code Hygiene | 1.0 | [x] Met | E2E and Unit tests present; linting enforced. |
| 4. Secrets | 0.5 | [~] Partial | Need to verify `db_password` entropy and separation per environment. |
| 5. Dependency Updates | 1.0 | [x] Met | Inherits `bcgov/renovate-config` with `automerge: true`. |
| 6. Vulnerability SLAs | 1.0 | [x] Met | `SECURITY.md` is present. |
| 7. CI/CD & Deployments | 1.0 | [x] Met | PR preview environments and Release-Gated PROD deployments configured. |
| 8. Quality Gates | 1.0 | [x] Met | `analysis.yml` test suites gate merges. |
| 9. OpenShift Security | 0.5 | [~] Partial | Helm charts / manifests need full pod security context validation. |

## Remediation Plan

### Tier 2 (Recommended)
- **Secrets Management**: Verify `db_password` in `prod` environment meets 32+ character entropy standards.
- **OpenShift Hardening**: Ensure DeploymentConfigs/StatefulSets drop all capabilities and run as non-root.
