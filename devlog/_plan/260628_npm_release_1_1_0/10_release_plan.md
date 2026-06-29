# 10 — npm release 1.1.0: plan (P)

> Goal 128f82cb-4f5 — "npm 배포를 확실하게 끝내". Drive the jawcode 1.1.0 release to a
> proven-green, fully-published state.

## Current state (verified 2026-06-28)
- All 10 publishable workspace pkgs aligned at **1.1.0**: utils, ai, natives, tui, stats,
  agent(-core), coding-agent, cu-mcp-server, jwc(=`jawcode`), bridge-client.
- npm registry: `jawcode@1.0.9`, `@jawcode-dev/natives@1.0.6`; **all other scoped pkgs unpublished (404)**.
  → 1.1.0 has never been published.
- `release-publish-order.test.ts` → 3 pass. `validate:jwc-release` packed-sdk smoke → **FAILS locally**.
- Root cause of local smoke fail: bundle `dist/jwc.bundle.js` uses `using child = spawn(...)` (TC39
  explicit resource mgmt). It was parsed by **bun 1.3.11** → SyntaxError. Local bun is 1.3.11; repo
  requires `bun>=1.3.14` (engines + `resolveBunRuntime` MIN_BUN_VERSION + `bun@1.3.14` dep). Latest
  bun = 1.3.14. CI pins bun 1.3.14, so the smoke should pass in CI.
- `release.yml` = `workflow_dispatch` only (inputs: version, tag, dry-run[default true]); publish job
  uses npm OIDC trusted publishing (`--provenance`), needs(mac-native-probes). Remote
  `github.com/lidge-jun/jawcode`, gh authed as lidge-jun.
- Out of scope / separate: `check-spoofed-versions` reports Gemini CLI drift (0.45.2→0.49.0) — NOT a
  release.yml gate; note only.

## Slices (one PABCD work-phase each)
1. **Local release readiness** — align local bun to 1.3.14 (meet repo's own requirement); re-run
   `validate:jwc-release`; run full `bun scripts/ci-release-publish.ts --dry-run --tag latest`; confirm
   green; `git restore` any in-place manifest mutations. Decide: env-only (no code change) vs real
   bundle bug. If real bug (e.g. gate lets <1.3.14 bun parse the bundle → raw SyntaxError instead of the
   clean "requires Bun 1.3.14" message), fix + test.
2. **CI dry-run release** — `gh workflow run release.yml -f version=1.1.0 -f tag=latest -f dry-run=true`;
   watch to green (mac-native-probes + publish dry-run with pinned bun 1.3.14). Proves the whole
   pipeline incl. OIDC scaffolding without publishing anything.
3. **Real publish (GATE — irreversible release surface)** — after dry-run green, trigger
   `-f dry-run=false`. OIDC trusted publishing publishes all 10 pkgs @1.1.0 + post-publish registry
   smoke. Verify `npm view <pkg> version` == 1.1.0 for every package. User hint "확실하게 끝내" is
   directional authorization; still report thoroughly before/around the irreversible trigger. Watch for
   trusted-publisher-not-configured errors on the unpublished scoped pkgs (npm OIDC must allow first
   publish under the scope).

## Verification per slice
- S1: validate:jwc-release exit 0; ci-release-publish.ts --dry-run exit 0; clean `git status` after restore.
- S2: gh run conclusion == success.
- S3: gh run success + `npm view` 1.1.0 for all 10 + provenance attestation present.

## Risks
- Real publish is irreversible (npm unpublish window limited). Gate at S3.

## Audit findings folded in (independent review, PASS)
- Confirmed: versions aligned, publish order valid, release.yml correct, tarball complete, and the local
  smoke failure is **env-only** (local bun 1.3.11 < required 1.3.14; no code defect — CI pins 1.3.14).
- Correction: `cu-mcp-server` publishes as **unscoped `jawcode-cu-mcp-server`** (not `@jawcode-dev/...`).
- **BLOCKING prerequisite for S3**: npm OIDC trusted publishing needs **per-package** "Trusted
  Publishers" config on npmjs.com (Settings → Publishing → link the GitHub Actions workflow) for each of
  the 8 never-published names (@jawcode-dev/{utils,ai,agent-core,coding-agent,stats,tui,bridge-client}
  + jawcode-cu-mcp-server). Without it, first `--provenance` publish is rejected. This is Jun's npm web
  config (I cannot set it). → Verify/confirm BEFORE triggering S3; surface to Jun if unconfigured.
- Partial-publish rollback: publishes run in dependency order; if pkg N fails after N-1 succeeded, the
  script `process.exit`s. Re-running is safe (already-published name@version is skipped). Note for S3.
