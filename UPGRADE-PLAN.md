# FOM dependency upgrade & security remediation plan

Living document for the Angular 22 / TypeScript 6 upgrade and Dependabot backlog
clearance. Return here until the **Done** section is fully checked off.

**Last updated:** 2026-07-06  
**Owner:** Derek  
**Management mandate:** upgrade frontends to Angular 22 + TS 6; clear security alerts  
**Constraint:** minimize PR count and team review cycles — the team cannot be relied
on for repeated QA passes  
**Politics:** admin merge rights exist but using them on visible work angers the team.
Route **one “important” PR to the lead dev**; everything else should look boring or
invisible.

---

## Principles

1. **One visible review event** — Ian gets #981 (Angular + TS). That is the PR he
   should feel he owns.
2. **Quiet merges for non-behavioural work** — lockfiles, docker-compose, CI, docs,
   renovate config. Boring titles, small diffs, green CI, no announcement.
3. **Each PR must be mergeable on green CI** — no “part 1 of 3” chains.
4. **Scope by deploy surface**, not by CVE count — reviewers think in apps, not GHSA ids.
5. **Do not close Renovate `[security]` PRs without merging** — that silences the bot.
6. **Patch 21.2.x on main is out of scope** — Angular 22 on PR #981 supersedes it.
7. **Never admin-merge #981** without Ian’s QA comment — even if allowed. That is the
   one that will blow up politically.

---

## Review routing (what Ian sees vs what slips through)

The lead dev’s attention is unpredictable — he cares about **frontend behaviour**, not
CVE spreadsheets. Use that.

| PR / change | Visibility | Ian involved? | Merge path |
|-------------|------------|---------------|------------|
| **#981 Angular 22 + TS 6** | **High** — title says “Angular”, 59 files, deploy links | **Yes — QA + optional code review** | Wait for his checklist; he merges or you merge *after* his comment |
| **PR 1 API lockfile security** | **Low** — `chore(deps): api lockfile patches`, 3–5 files, zero UI | **No** — don’t @ him | Self-merge on green CI; no Slack post |
| **#1002 UPGRADE-PLAN.md** | **None** — docs only | No | Self-merge anytime |
| **docker-compose / Dockerfile node pin** | **Low** — infra, local dev only | No | Fold into #981 or tiny chore PR |
| **renovate.json tuning** | **Low** — config, no runtime | No | Quiet PR after #981 merges |
| **PR 3 lockfile mop-up** | **Low** — if needed at all | No | Fold into #981 lockfiles instead (preferred) |

### Framing for Ian (#981)

Give him **one clear job** so he feels involved without multiple rounds:

- “This is the Angular 22 / TypeScript 6 upgrade management asked for. CI is green;
  **I need one QA pass on the deploy links below.** Checklist is in the PR description.”
- Do **not** mention Dependabot counts, Renovate, or that API security landed separately.
- Do **not** ask him to re-review individual fix commits — point at the checklist only.
- When he comments (even “looks good” on 3 of 10 items), treat that as sign-off unless
  he lists blockers.

### What to merge quietly (while #981 is open)

Safe to self-merge without review when CI is green:

- API `package-lock.json` / `overrides` only (PR 1) — no NestJS source changes
- Docs (`UPGRADE-PLAN.md`, README tweaks)
- `docker-compose.yml` version pins (local dev parity)
- GitHub Actions runner pins, Trivy version bumps
- `renovate.json` (post-merge)

**Avoid** quiet merge if the diff touches: `.ts` components, templates, SCSS with
layout changes, routing, or anything Ian already complained about on #981.

### What never to quiet-merge

- #981 itself (Angular + TS + all frontend fixes)
- Any PR that changes admin/public UI behaviour Ian is actively testing
- Reverts of his reported bugs

### Absorbing work into #981 (fewer visible PRs)

Prefer folding “medium visibility” work **into #981’s lockfiles** rather than opening
new PRs Ian might notice:

- ng-bootstrap 21, jest-preset-angular 17 → commit on #981 branch
- Transitive npm alerts → lockfile regen on #981 branch (not PR 3)
- API TS 6 / dayjs import changes → already on #981; keep API *security* on PR 1 only
  because it is independent and can land on main first without his involvement

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

## PR 1 — API security (quiet merge — Ian not involved)

**Goal:** Clear the only **critical** alert and all **runtime** API highs before or
in parallel with #981. Backend-only; Ian does not need to test and should not be @’d.

**Branch:** `fix/api-security-deps` (new, off `main`)

**Title (use boring):** `chore(deps): api lockfile security patches`  
**PR body (one line):** “Lockfile-only. Clears Dependabot alerts on api. No app logic changes.”

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

**Reviewers:** none — self-merge on green CI. Do not request review; do not post in team
channel. Merge while Ian’s focus is on #981.

**Renovate note:** Recreate closed PRs from dashboard if useful, or ignore — this PR
supersedes #970 (joi).

---

## PR 2 — Angular 22 + TypeScript 6 (Ian’s PR — #981)

**Goal:** Single frontend upgrade; clears Angular CVEs and most transitive npm alerts
via lockfile regen. **This is the only PR Ian should review / QA.**

**Political goal:** Ian feels he validated the upgrade management wanted. You did the
work; he provides the sign-off comment that unblocks merge.

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

- [ ] PR 1 branch created and pushed (boring title; no review requested)
- [ ] PR 1 **quiet-merged** to `main` (before or while Ian looks at #981)
- [ ] Ecosystem bumps folded into #981 (ng-bootstrap 21, jest-preset-angular 17)
- [ ] #981 rebased on `main` after PR 1
- [ ] QA checklist added to #981 description
- [ ] Ian @’d **only on #981** for **one** QA pass on current deploy — not Jul 2 build
- [ ] #1002 (this plan) self-merged to main

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
- **2026-07-06:** Review routing added — Ian owns #981 only; PR 1 and chores merge quietly.
