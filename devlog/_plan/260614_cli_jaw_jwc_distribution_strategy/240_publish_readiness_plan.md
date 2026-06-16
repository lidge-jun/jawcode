# 240 — Publish Readiness: files optimization + CI strengthening

## Goal

Make `jawcode` package publish-ready (dry-run only, no actual npm publish):
1. Trim `files` field to ship only runtime-necessary artifacts
2. Verify dual-runtime (bun + npm/node) paths work
3. Strengthen GitHub CI with Node SDK smoke, pack size guard, and release safety

## Current State

### Package contents (npm pack --dry-run)

| File | Size | Needed at runtime? |
|------|------|--------------------|
| `bin/jwc.js` | 1.6KB | YES — CLI entry |
| `dist/jwc.bundle.js` | 22.6MB | YES — Bun CLI bundle |
| `dist-node/sdk.js` | 25.5MB | YES — Node SDK bundle |
| `scripts/resolve-bun-runtime.cjs` | 3.0KB | YES — Bun resolver for bin/jwc.js |
| `scripts/verify-runtime.cjs` | 904B | YES — postinstall check |
| `scripts/build-node.ts` | 4.6KB | NO — build tool only |
| `scripts/smoke-*.mjs` (4 files) | 13.1KB | NO — dev smoke tests |
| `scripts/test-node-shims.mjs` | 21.2KB | NO — dev test |
| `src/cli-entry.ts` | 456B | NO — bundled into dist/ |
| `src/index.ts` | 361B | YES — type entry for `.` export |
| `src/sdk.ts` | 417B | YES — type entry for `./sdk` export |
| `src/shims/*.ts` (16 files) | ~68KB | NO — bundled into dist-node/ |

**Current: 48.2MB unpacked / 9.4MB packed / 34 files**
**Target after 340 bootstrap: ~48.1MB unpacked / ~9.4MB packed / 10 files** (bundles dominate; bootstrap adds two small runtime artifacts)

### CI (current .github/workflows/)

- `ci.yml`: check + package-dry-run (no Node smoke, no size guard)
- `release.yml`: manual dispatch, npm publish with version verify

## Implementation Slices

### Slice A — files field optimization

**Class: C1** (single file, local change, instantly verifiable)

| Action | File |
|--------|------|
| MODIFY | `packages/jwc/package.json` |

Change `files` from:
```json
["bin", "dist", "dist-node", "scripts", "src"]
```
to:
```json
[
  "bin",
  "dist",
  "dist-node",
  "defaults/cli-jaw/settings.json",
  "scripts/resolve-bun-runtime.cjs",
  "scripts/verify-runtime.cjs",
  "scripts/bootstrap-cli-jaw-home.cjs",
  "src/index.ts",
  "src/sdk.ts"
]
```

**Audit finding — dev scripts reference excluded files:**
`bundle`, `build:node`, `smoke:node-sdk`, `smoke:packed-sdk` scripts in
package.json reference files that won't be in the published package. This is
harmless — consumers never run dev scripts. `postinstall` is the only
lifecycle script and it correctly references included files. No action needed.

**Audit finding — type entries depend on devDependency:**
`src/sdk.ts` re-exports from `@gajae-code/coding-agent/sdk` (devDep only).
Published consumers use `dist-node/sdk.js` for runtime. `.d.ts` generation
is a separate future slice (see docs 120-130). Accepted for now.

**Verification:**
```bash
cd packages/jwc && npm pack --dry-run 2>&1
# Expected: 10 files (bin/jwc.js, dist/jwc.bundle.js, dist-node/sdk.js,
# defaults/cli-jaw/settings.json, scripts/resolve-bun-runtime.cjs,
# scripts/verify-runtime.cjs, scripts/bootstrap-cli-jaw-home.cjs,
# src/index.ts, src/sdk.ts, package.json)
```

### Slice B — CI strengthening

**Class: C2** (two workflow files, ordinary product slice)

| Action | File |
|--------|------|
| MODIFY | `.github/workflows/ci.yml` |
| MODIFY | `.github/workflows/release.yml` |

#### ci.yml additions

1. **Canonical JWC release validation** — run `bun run validate:jwc-release` or the same named gate set after bundle/build.
2. **Packed install smoke** — run `node packages/jwc/scripts/smoke-packed-sdk.mjs`, including temp `CLI_JAW_HOME`, package-local Bun proof, `jwc --version`, `jwc --help`, and bootstrap assertions.
3. **Pack size guard** — fail if packed tarball exceeds 15MB unless the release plan explicitly revises the ceiling.
4. **Pack file count guard** — fail if file count exceeds 15 (current bootstrap target ~10).
5. **Dual-runtime check** — verify `bin/jwc.js` can at least parse under Node (syntax check) and the package-local Bun resolver path is covered by packed smoke.

#### release.yml additions

1. **Canonical JWC release validation** before publish/dry-run, including packed smoke and bootstrap gates.
2. **Pack size + file-count validation** before publish.
3. **Version verification** before publish.
4. **Provenance** — keep `--provenance` flag for npm publish (supply chain security).


### Slice C — 340 bootstrap/release-readiness additions

**Class: C4** (release surface + install behavior)

| Action | File |
|---|---|
| MODIFY | `scripts/jwc-release-validation.ts` |
| MODIFY | `.github/workflows/ci.yml` |
| MODIFY | `.github/workflows/release.yml` |
| MODIFY | `scripts/ci-release-publish.ts` if the jwc preBuild contract diverges |
| ADD/MODIFY | focused bootstrap/pack contract tests |

Required gates:

- first-install cli-jaw home bootstrap test;
- pack allowlist/size/count contract;
- postinstall mode matrix (`normal`, `CI=true`, `JWC_SAFE=1`, `JWC_SKIP_CLI_JAW_BOOTSTRAP=1`);
- PATH-scrubbed package-local Bun proof;
- registry-faithful install mode;
- macOS arm64 native probes with explicit blocking/report-only semantics;
- reproducible non-secret baseline assertions.

`bun` dependency postinstall remains a separate upstream install risk: if the `bun` package installer fails before `jawcode` postinstall, `jawcode` cannot make that failure non-fatal. The release plan must document remediation (`JWC_BUN_PATH` or compatible system Bun) and keep launcher errors clear.
### Slice D — devlog record

**Class: C0** (documentation only)

| Action | File |
|--------|------|
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/240_publish_readiness_plan.md` |

Update this document with execution evidence and final pack output.

## Execution Order

```
Slice A (files + bootstrap artifacts) → verify pack allowlist
Slice B/C (CI + release readiness gates) → verify canonical validation
Slice D (record evidence) → commit
```

## Risks

- Bundle size (~48MB unpacked) is large but inherent — the coding agent + all prompts are bundled. This plan doesn't address bundle size itself, only unnecessary extra files.
- `check-no-github-workflows.ts` now allows workflows with GitHub-hosted runners only; CI files are permitted.
