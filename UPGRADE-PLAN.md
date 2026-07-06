# FOM dependency upgrade & security remediation plan

Living document for the Angular 22 / TypeScript 6 upgrade and Dependabot backlog
clearance. Return here until the **Done** section is fully checked off.

**Last updated:** 2026-07-06  
**Owner:** Derek  
**Management mandate:** upgrade frontends to Angular 22 + TS 6; clear security alerts  
**Constraint:** minimize PR count and team review cycles — the team cannot be relied
on for repeated QA passes

---

## Principles

1. **Two human review events max** — one optional (API-only), one required (frontends).
2. **Each PR must be mergeable on green CI** — no “part 1 of 3” chains waiting on the
   next PR.
3. **Scope by deploy surface**, not by CVE count — reviewers think in apps, not GHSA ids.
4. **Do not close Renovate `[security]` PRs without merging** — that silences the bot.
5. **Patch 21.2.x on main is out of scope** — Angular 22 on PR #981 supersedes it.

---

## Current snapshot

| Item | State |
|------|-------|
| Open Dependabot alerts | **100** (~40 unique GHSA; many duplicated across 4 lockfiles) |
| Open CodeQL alerts | **1** (`linkify-it`; same as Dependabot) |
| Main Angular version | **21.2.14** (admin / public / libs) |
| Upgrade branch | `feat/upgrade-angular-ts6` → **Angular 22.0.4**, **TS 6.0.3** |
| Active upgrade PR | [#981](https://github.com/bcgov/nr-fom/pull/981) — CI green, deploy OK, **REVIEW_REQUIRED** |
| Last team QA | Ian, **2026-07-02** — regressions reported; fixes landed **2026-07-03+** (no re-test yet) |
| Renovate | Mend enabled; `prConcurrentLimit: 2`; blanket `automerge: false` in `renovate.json` |

### Alert buckets (which PR clears them)

| Bucket | Packages (representative) | Alerts (approx) | PR |
|--------|---------------------------|-----------------|-----|
| **A — API runtime** | `shell-quote`, `nodemailer`, `multer`, `form-data`, `joi` | ~10 rows | **PR 1** |
| **B — Angular frontends** | `@angular/core`, `@angular/common`, `@angular/compiler` | ~25 rows | **PR 2** (#981) |
| **C — Transitive / dev** | `undici`, `js-yaml`, `vite`, `webpack-dev-server`, `hono`, `linkify-it`, … | ~65 rows | **PR 2** (lockfile regen) + maybe **PR 3** |

---

## PR strategy (2 PRs + optional cleanup)

```text
  PR 1 (API security)          PR 2 (#981 Angular 22 + TS 6)
  ───────────────────          ──────────────────────────────
  api/package.json             admin / public / libs / api TS
  api/package-lock.json        all frontend fixes + lockfiles
  npm overrides (if needed)    ecosystem bumps folded in
         │                              │
         ▼                              ▼
    merge to main  ──rebase──►   ONE team QA pass → merge
         │                              │
         └──────── clears critical ────┴── clears Angular + most npm noise
```

### Why not one mega-PR?

Combining API security into #981 adds ~10 unrelated lockfile lines to an already
59-file frontend upgrade. Reviewers will conflate “map broken” with “nodemailer bump”.
Two PRs keeps scopes honest while still hitting the **two-review ceiling**.

### Why not three frontend PRs?

Patch 21.2.17 → merge → then 22 would force **two frontend QA cycles**. Not viable
with this team.

---

## PR 1 — API security (no team QA required)

**Goal:** Clear the only **critical** alert and all **runtime** API highs before or
in parallel with #981. Backend-only; Ian does not need to test.

**Branch:** `fix/api-security-deps` (new, off `main`)

**Scope (~3–5 files):**

- `api/package.json` — bump `joi` to `^17.13.4`
- `api/package-lock.json` — regen
- `api/package.json` `overrides` (only if lockfile alone does not resolve):
  - `shell-quote`: `1.8.4`
  - `multer`: `2.2.0`
  - `form-data`: `4.0.6`
- Consider bumping `@nestjs-modules/mailer` if needed to pull `nodemailer@9.0.1`
  (nested `mailparser` copy is on 8.0.5 today)

**Merge criteria:**

- [ ] CI green (unit tests + Trivy)
- [ ] `gh api …/dependabot/alerts?state=open` shows **zero critical** on `api/package-lock.json`
- [ ] No application code changes unless a bump requires it

**Reviewers:** optional — self-merge acceptable with management backing.

**Renovate note:** Recreate closed PRs from dashboard if useful, or ignore — this PR
supersedes #970 (joi).

---

## PR 2 — Angular 22 + TypeScript 6 (THE team review)

**Goal:** Single frontend upgrade; clears Angular CVEs and most transitive npm alerts
via lockfile regen. **One QA pass from Ian (or delegate).**

**Branch / PR:** `feat/upgrade-angular-ts6` — [#981](https://github.com/bcgov/nr-fom/pull/981)

### Fold into #981 *before* marking ready (avoid PR 3)

Complete these on the branch so Renovate does not open follow-up PRs:

- [ ] `@ng-bootstrap/ng-bootstrap` → **^21.0.0** (Angular 22 alignment; on ^20 today)
- [ ] `jest-preset-angular` → **^17.0.0** (Angular 22 test preset; on ^16 today)
- [ ] Rebase on `main` after **PR 1** merges
- [ ] Regenerate all lockfiles: `admin`, `public`, `libs`, `api` (api only TS-related changes)
- [ ] Confirm PR body includes QA checklist below (copy/paste for Ian)

### Already done on branch (do not redo)

- Angular 22.0.4, TS 6.0.3 across workspaces
- `ComponentFactoryResolver` → `createComponent` migration
- Zone / change-detection fixes (admin search spinner, details panel, public notices)
- Leaflet `leaflet-host.ts` + `scripts/check-map-contract.sh` CI gate
- Map sizing, duplicate `#map` id, splash modal / footer z-index
- `dayjs` default imports (API, TS 6)
- Docker / docker-compose node image bumps

### Out of scope for #981 (defer)

- Angular strict mode restoration (`strict: false` in tsconfigs — follow-up ticket)
- `minio` ignore in renovate.json (unchanged)
- Major bumps unrelated to upgrade: `typeorm` v1, `dotenv` v17, PostGIS 18, etc.

### Merge criteria

- [ ] CI green (build, unit, deploy, smoke, map contract, Trivy, CodeQL)
- [ ] Team QA checklist signed off (below)
- [ ] Open Dependabot Angular alerts cleared on merge
- [ ] No open `[security]` Renovate PRs left closed-unmerged for packages touched

### PR description template (for Ian)

Add to #981 body so the team has **one document** to test against:

```markdown
## What changed
- Angular 21 → 22, TypeScript 5 → 6 across admin, public, libs, API
- Fixes for map rendering, side panels, and admin search spinner (Angular 22 zone/CD)
- Lockfile updates (security advisories)

## Please test once on PR deploy
Deploy: [admin](…) [public](…) [api](…)

### Public
- [ ] Map loads tiles on first visit (no blank/blue map)
- [ ] Click FOM on map → "View Details" opens details side panel with content
- [ ] Public Notices panel shows notice content for a FOM
- [ ] Find panel filters work; no freeze when URL has `?id=`
- [ ] Comment modal submits and closes
- [ ] Footer visible when splash modal open

### Admin
- [ ] Search returns results; spinner stops; results visible
- [ ] Add new FOM: submit button not spinning until clicked
- [ ] Existing flows: view FOM, edit, attachments (smoke)

### Cosmetic (non-blocking)
- [ ] Header gold border / footer layout on projects page
```

---

## PR 3 — Post-merge cleanup (only if needed)

**Goal:** Mop up alerts still open after PR 1 + 2 merge. May be **zero human review**
if CI-only lockfile maintenance.

**Trigger:** Run after PR 2 merges:

```bash
gh api repos/bcgov/nr-fom/dependabot/alerts?state=open --paginate \
  -q '[.[] | .dependency.package.name] | group_by(.) | map({pkg: .[0], n: length})'
```

**Scope:** Lock file maintenance only — tick dashboard checkbox or:

```bash
# per workspace
npm update && npm audit fix
```

**Merge criteria:** CI green; alert count → 0 (or documented dismissals for dev-only
with `triageReason`).

Skip PR 3 entirely if PR 2 lockfile regen clears everything.

---

## Renovate / process (after merge wave)

Do in a **single config PR** or fold into PR 3 — not worth a separate review:

- [ ] Remove blanket `"automerge": false` for all packages; restore bcgov preset behaviour
- [ ] Add rule: `matchCategories: ["security"]` → `automerge: true` (patch/minor)
- [ ] Temporarily `prConcurrentLimit: 5` during backlog burn-down, then back to 2
- [ ] `minimumReleaseAge: null` for security updates (override bcgov 7-day wait)
- [ ] Pin [Dependency Dashboard #489](https://github.com/bcgov/nr-fom/issues/489); weekly 15-min triage

---

## Execution checklist

### Phase 0 — Now

- [ ] PR 1 branch created and pushed
- [ ] PR 1 merged to `main`
- [ ] Ecosystem bumps folded into #981 (ng-bootstrap 21, jest-preset-angular 17)
- [ ] #981 rebased on `main`
- [ ] QA checklist added to #981 description
- [ ] Ian (or manager) asked for **one** QA pass on current deploy — not the Jul 2 build

### Phase 1 — Merge #981

- [ ] QA sign-off recorded (comment on PR or checkbox in this file)
- [ ] #981 merged
- [ ] Verify Dependabot: Angular alerts closed

### Phase 2 — Close out

- [ ] PR 3 opened only if alerts remain
- [ ] Renovate config PR merged
- [ ] Dependency Dashboard rate-limited items cleared
- [ ] **Done** section below complete

---

## Done

All must be true:

- [ ] **0 open critical / high** Dependabot alerts on `main`
- [ ] **0 open medium** older than 30 days (or documented exception)
- [ ] `main` on **Angular 22** + **TypeScript 6**
- [ ] Team QA signed off on production behaviour (one pass)
- [ ] No closed-unmerged Renovate `[security]` PRs blocking updates

---

## Reference

| Resource | Link |
|----------|------|
| Upgrade PR | https://github.com/bcgov/nr-fom/pull/981 |
| Dependabot | https://github.com/bcgov/nr-fom/security/dependabot |
| Renovate dashboard | https://github.com/bcgov/nr-fom/issues/489 |
| Mend portal | https://developer.mend.io/github/bcgov/nr-fom |

### Ian's 2026-07-02 issues → fix commits

| Issue | Addressed in |
|-------|----------------|
| Public: View Details panel empty | `80521e5b`, `5197b690` |
| Public: Public Notices empty | `80521e5b`, `4f27bc99` |
| Admin: Search spinner hangs | `80521e5b`, `50e30904` |
| Admin: Add FOM submit spinning | `50e30904` |
| Header extra divider line | `62f60d11` … `f9c69210` |
| Map blank on load | `leaflet-host.ts`, `2c8f1673`, multiple map commits |

---

## Notes / log

_Use this section for dated progress updates._

- **2026-07-06:** Plan created. #981 at 49 commits, CI green, awaiting re-QA after Jul 3 fixes.
