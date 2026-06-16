# 180 — Deployment pipeline execution index

## Goal

Execute the remaining deployment pipeline from local baseline to publish-ready state, in 5 PABCD slices. TUI modernization is excluded (another agent's scope).

## Current baseline (verified 2026-06-14)

| Area | Status |
|------|--------|
| jawcode package surface | `jawcode@0.1.0`, bin `jwc`, export `jawcode/sdk` |
| jawcode main push | Done — origin/main synced at `1a053c71` |
| jawcode local validation | `validate:jwc-release` passes |
| cli-jaw JWC integration | Embedded `jawcode/sdk` import verified, no-global smoke passes |
| cli-jaw dev branch | ~170 unpushed commits, no `origin/dev`, 3 dirty files (2 TUI + `config.ts`) |
| npm auth | Not logged in (401) |
| npm `jawcode` name | Available (404) |
| `@gajae-code/natives` | Published (0.4.4 used, 0.5.0 latest) — not a blocker |
| `@gajae-code/coding-agent` | Published (devDependency only) — not a blocker |
| GitHub workflows | Blocked by `check-no-github-workflows.ts` guard |
| cli-jaw dep on jawcode | `file:../jawcode/packages/jwc` (local link) |

## Slice plan

### Slice 180: cli-jaw JWC integration push

**What**: Push cli-jaw dev branch to `origin/dev` so JWC integration commits are on remote.

**Pre-check**:
- `git log --oneline dev --not --remotes` → list all ~170 unpushed commits
- Verify dirty files (2 TUI + `src/core/config.ts`) are not staged
- Scan unpushed commits for secrets: `git log --oneline -170 -p | grep -iE 'password|token|secret|api.key' | head -20`

**Action**:
```sh
cd /Users/jun/Developer/new/700_projects/cli-jaw
git push -u origin dev
```

**Verification**:
- `git branch -vv` shows `dev` tracking `origin/dev`
- `git status` still shows same dirty files untouched
- Remote has JWC integration commits visible

**Files**: None modified — push only.

### Slice 181: jawcode npm publish dry-run

**What**: Validate the jawcode package can be published as-is.

**Actions**:
```sh
cd /Users/jun/Developer/new/700_projects/jawcode/packages/jwc
npm pack --dry-run 2>&1
npm publish --dry-run 2>&1
```

**Verify checklist**:
- [ ] Tarball contains: `bin/`, `dist/`, `dist-node/`, `scripts/`, `src/`
- [ ] `bin/jwc.js` present and marked executable
- [ ] Package name is `jawcode`, version `0.1.0`
- [ ] `bun@1.3.14` listed as dependency
- [ ] No workspace-only or unpublished dependencies block publish
- [ ] `jawcode/sdk` export resolves to `dist-node/sdk.js`
- [ ] Packed install + `node -e "import('jawcode/sdk')"` succeeds
- [ ] `postinstall` script (`verify-runtime.cjs`) doesn't hard-fail without Bun

**Potential blockers**:
- `@gajae-code/natives@0.4.4` — published, OK
- `markit-ai@0.5.3` — need to verify published
- `better-sqlite3`, `json5`, `strip-ansi`, `@silvia-odwyer/photon-node` — all public packages

**Files**: None modified — validation only. Document results in this file.

### Slice 182: npm auth/ownership verification

**What**: Confirm npm credentials and `jawcode` package name ownership.

**Pre-check**:
```sh
npm whoami                    # currently 401 — must login first
npm view jawcode              # currently 404 — name available
npm access ls-packages        # list owned packages
```

**User action required**: `npm login` (interactive — cannot be automated).

**Post-login verification**:
- `npm whoami` returns the correct npm username
- `npm view jawcode` still 404 (confirming no one else took it)
- If 2FA is enabled: confirm `npm publish` will work with current auth setup

**Files**: None modified — auth check only.

### Slice 183: CI redesign (GitHub-hosted only)

**What**: Introduce minimal GitHub Actions CI using only GitHub-hosted runners.

**Runner policy**:
- GitHub-hosted runners ONLY (`ubuntu-latest`, `macos-latest`)
- NO `self-hosted`, NO upstream runner labels, NO fork-inherited runners
- Document policy in `060_ci_release_tracks.md` update

**Workflow files to create**:

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | push/PR to main | Workspace install, typecheck, test, package dry-run |
| `.github/workflows/release.yml` | `workflow_dispatch` only | Manual publish trigger with version input |

**Guard changes (MUST be atomic with workflow creation)**:
- MODIFY `scripts/check-no-github-workflows.ts` → replace blanket guard with runner-label guard that rejects `self-hosted`
- Guard relaxation and workflow files MUST land in the same commit — otherwise `validate:jwc-release` breaks mid-slice

**Verification**:
- `bun run validate:jwc-release` still passes
- No `self-hosted` string in any workflow file
- CI workflow syntax valid (`actionlint` or manual review)

**Files**:
- NEW: `.github/workflows/ci.yml`
- NEW: `.github/workflows/release.yml`
- MODIFY: `scripts/check-no-github-workflows.ts` → runner policy guard
- MODIFY: `devlog/_plan/.../060_ci_release_tracks.md` → document policy

### Slice 183.5: npm publish (user-gated)

**What**: Actual `npm publish` of jawcode@0.1.0 to the registry.

**Prerequisites**: Slices 181 (dry-run OK), 182 (auth OK), 183 (CI ready).

**Action**:
```sh
cd /Users/jun/Developer/new/700_projects/jawcode/packages/jwc
npm publish
```

**Verification**:
- `npm view jawcode@0.1.0` returns package metadata (not 404)
- `npm install -g jawcode && jwc --version` outputs `jwc/0.1.0`

**User decision required**: Confirm publish is intentional. This is irreversible (version numbers cannot be reused).

### Slice 184: release dependency switch

**What**: Switch cli-jaw from `file:` link to published jawcode version.

**Prerequisites**: Slice 183.5 (package published on npm).

**Action**:
```diff
# cli-jaw/package.json
- "jawcode": "file:../jawcode/packages/jwc"
+ "jawcode": "0.1.0"
```

**Verification**:
```sh
cd /Users/jun/Developer/new/700_projects/cli-jaw
npm install
npm run smoke:jwc:no-global
npm run typecheck
```

**Files**:
- MODIFY: `/Users/jun/Developer/new/700_projects/cli-jaw/package.json`
- MODIFY: `/Users/jun/Developer/new/700_projects/cli-jaw/package-lock.json` (auto-generated)

## Execution order and dependencies

```
180 (push) ──→ independent, can run first
181 (dry-run) ──→ independent, can run first
182 (npm auth) ──→ requires user interaction (npm login)
183 (CI) ──→ after 181 validates package is publishable
184 (dep switch) ──→ after 182 (auth) + actual npm publish
```

Slices 180 and 181 are independent and can execute immediately.
Slice 182 blocks on user action (`npm login`).
Slice 183 depends on 181 passing.
Slice 183.5 (publish) depends on 182 (auth) + 183 (CI). User-gated.
Slice 184 depends on 183.5 (package live on registry).

## Commit discipline

- Each slice gets its own atomic commit in the relevant repo
- cli-jaw staging uses explicit path lists (TUI dirty files excluded)
- No `git push` unless explicitly part of the slice scope
