# Investigation Synthesis

Date: 2026-06-16
Sources: CiTimingBreakdown, GjcRemnantAudit, PublishPipelineAudit, CiCacheStrategy (4 parallel subagents)

## 1. gjc/0.4.4 Root Cause (CRITICAL)

### Direct Cause
`packages/jwc/package.json` has `"@gajae-code/natives": "0.4.4"` hardcoded. The publish rewriter (`resolvePublishDependency`) only rewrites `workspace:*` and `catalog:` specs — bare semver passes through unchanged.

### Consequence Chain
1. `npm pack` → tarball contains dep `@gajae-code/natives: 0.4.4`
2. `npm install jawcode.tgz natives-1.0.0.tgz` → npm sees version mismatch (0.4.4 ≠ 1.0.0)
3. npm fetches `@gajae-code/natives@0.4.4` from registry as nested dep
4. Old upstream 0.4.4 has `APP_NAME = "gjc"` hardcoded (pre-fork)
5. Smoke test fails: `gjc/0.4.4` ≠ `jwc/1.0.0`

### Published State
- `jawcode@1.0.0` is LIVE on npm with broken dep (natives@0.4.4)
- `@gajae-code/natives@1.0.0` does NOT exist on npm (latest: 0.5.3)
- npm disallows republishing same version → need `1.0.1`

### Fix Requirements
1. Change dep to `workspace:*` (not bare `1.0.0` — bare version breaks on future bumps)
2. Restructure publish script: rewrite manifest BEFORE preBuild smoke tests
3. Publish `@gajae-code/natives@1.0.0` first, then `jawcode@1.0.1`

### Smoke Test Chicken-and-Egg
- `--registry-faithful` mode runs in preBuild BEFORE manifest rewrite
- After fix to `workspace:*`, `npm pack` would include literal `workspace:*` which npm can't resolve
- Solution: run manifest rewrite before preBuild, or split preBuild into pre/post-rewrite phases

## 2. CI Timing Analysis

### Current: ~12min wall clock, ~30min compute

| Job | Key Steps | Time |
|---|---|---|
| check | bun install (85s) + build:native (1-2min cached) + ci:check:full (2-3min) + smoke (30s) | ~8-10min |
| package (needs check) | bun install (85s) + build:native (3-5min NO CACHE) + validate:jwc-release (3-5min) + bundle (30s) + pack guards | ~8-12min |
| mac-native-probes (needs check) | bun install (85s) + build:native (3-5min NO CACHE) + bundle (30s) + native-probes (30s) | ~8-12min |

### Duplication Matrix

| Operation | check | package | mac-probes | release/publish | Total |
|---|---|---|---|---|---|
| bun install | ✓ | ✓ | ✓ | ✓ | 4× |
| build:native | ✓ (cached) | ✓ (NO CACHE!) | ✓ (NO CACHE!) | ✓ (NO CACHE!) | 4× |
| bundle | via validate | ✓ + validate | ✓ | ✓ + validate | 6× |
| ci:check:full | ✓ | – | – | ✓ (REDUNDANT!) | 2× |

### Missing from ci.yml (present in dev-ci.yml)
- ❌ Bun dependency cache
- ❌ Concurrency cancel-in-progress
- ❌ Swatinem/rust-cache (uses manual actions/cache instead)
- ❌ Artifact sharing between jobs

### Optimization Target: ~6-7min (from ~12min)

| Change | Savings |
|---|---|
| Merge check+package → one job (or artifact sharing) | 4-6min |
| Add bun cache | 1-2min |
| Add concurrency cancel-in-progress | prevents waste |
| Swatinem/rust-cache | better incremental builds |

## 3. Release Timing Analysis

### Current: ~16min (sequential: mac-probes → publish)

- mac-native-probes: builds everything from scratch (~8-12min)
- publish: re-runs ci:check:full + build:native + validate + bundle (~10-16min)
- `ci:check:full` in publish is completely redundant (CI already passed)

### Optimization Target: ~8-10min
- Remove ci:check:full from publish: -2min
- Add Cargo + bun cache: -4min
- Remove redundant bundle (validate already bundles): -0.5min

## 4. gjc Remnant Classification

| Category | Count | Action |
|---|---|---|
| REMOVE (CI/install/user-facing) | 11 | Fix in this plan |
| REMOVE (benchmark) | 2 | Depends on gjc-rpc rename (out of scope) |
| REMOVE (robojwc) | 9 | Partial fix (compose, Dockerfile, UI text) |
| KEEP-COMPAT | 6 | Backward-compat fallback chains, API headers |
| KEEP-INTERNAL | 4 | ENGINE_NAME, log paths, sandbox dirs |
| KEEP-UPSTREAM | 5 | Migration tools, gate scripts |

### Priority Removals (in scope)
- P0: packages/jwc/package.json deps → workspace:*
- P1: install test scripts gjc → jwc
- P2: Dockerfile shim /usr/local/bin/gjc → jwc
- P3: robojwc compose ~/.gjc/ → ~/.jwc/
- P4: Docker image name gajae-code/pi:dev → jawcode/pi:dev

## 5. Additional Issues Found

### Published Types Broken
`packages/jwc` kind is `"manifest"` in publish script → uses `rewriteNativeManifest` which only rewrites deps. Does NOT rewrite `exports.types` from `./src/*.ts` to `./dist/types/*.d.ts`. Published `jawcode` has raw `.ts` source as types, not `.d.ts`.

### validate:jwc-release Double Execution
Steps 1-7 of validate:jwc-release overlap almost exactly with preBuild array in ci-release-publish.ts. Both run bundle, smoke tests. ~5min wasted per publish.

## Decisions Needed

1. **Merge check+package vs artifact sharing** — merge is simpler, artifact sharing gives failure isolation
2. **Scope of gjc cleanup** — CI/install only, or include robojwc/Dockerfile/benchmark?
3. **Version bump strategy** — 1.0.1 patch, or semver differently?
4. **Type rewriting for jwc** — change kind to "typescript" or add rewriting to "manifest"?
5. **Registry-faithful smoke timing** — rewrite manifest before preBuild, or skip in CI?
